import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { rateLimit, clientIp, __resetRateLimitStore } from './rate-limit.js';

function makeApp(opts: Parameters<typeof rateLimit>[0]) {
  const app = new Hono();
  app.use('*', rateLimit(opts));
  app.get('/', (c) => c.text('ok'));
  app.post('/', (c) => c.text('ok'));
  return app;
}

function req(ip = '1.2.3.4', method: 'GET' | 'POST' = 'GET') {
  return new Request('http://localhost/', {
    method,
    headers: { 'x-forwarded-for': ip },
  });
}

describe('rateLimit', () => {
  beforeEach(() => {
    __resetRateLimitStore();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('laisse passer jusqu’à `max` requêtes puis renvoie 429', async () => {
    const app = makeApp({ name: 't', windowMs: 60_000, max: 3 });
    for (let i = 0; i < 3; i++) {
      const res = await app.request(req());
      expect(res.status).toBe(200);
    }
    const blocked = await app.request(req());
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
  });

  it('expose les en-têtes X-RateLimit-*', async () => {
    const app = makeApp({ name: 't', windowMs: 60_000, max: 5 });
    const res = await app.request(req());
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('4');
    expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });

  it('réinitialise le compteur après la fenêtre', async () => {
    const app = makeApp({ name: 't', windowMs: 60_000, max: 1 });
    expect((await app.request(req())).status).toBe(200);
    expect((await app.request(req())).status).toBe(429);
    vi.advanceTimersByTime(60_001);
    expect((await app.request(req())).status).toBe(200);
  });

  it('isole les compteurs par IP', async () => {
    const app = makeApp({ name: 't', windowMs: 60_000, max: 1 });
    expect((await app.request(req('1.1.1.1'))).status).toBe(200);
    expect((await app.request(req('1.1.1.1'))).status).toBe(429);
    // une autre IP a son propre budget
    expect((await app.request(req('2.2.2.2'))).status).toBe(200);
  });

  it('isole les compteurs par `name` sur une même IP', async () => {
    const a = makeApp({ name: 'a', windowMs: 60_000, max: 1 });
    const b = makeApp({ name: 'b', windowMs: 60_000, max: 1 });
    expect((await a.request(req())).status).toBe(200);
    expect((await a.request(req())).status).toBe(429);
    // le limiteur `b` n’est pas affecté par la consommation de `a`
    expect((await b.request(req())).status).toBe(200);
  });

  it('skip() ne compte ni ne bloque la requête', async () => {
    const app = makeApp({
      name: 't',
      windowMs: 60_000,
      max: 1,
      skip: (c) => c.req.method === 'GET',
    });
    // 5 GET ignorés
    for (let i = 0; i < 5; i++) {
      expect((await app.request(req('9.9.9.9', 'GET'))).status).toBe(200);
    }
    // le premier POST passe, le second est bloqué
    expect((await app.request(req('9.9.9.9', 'POST'))).status).toBe(200);
    expect((await app.request(req('9.9.9.9', 'POST'))).status).toBe(429);
  });
});

describe('clientIp', () => {
  it('prend le premier maillon de x-forwarded-for', () => {
    const c = {
      req: { header: (h: string) => (h === 'x-forwarded-for' ? '3.3.3.3, 4.4.4.4' : undefined) },
    } as never;
    expect(clientIp(c)).toBe('3.3.3.3');
  });

  it('retombe sur x-real-ip', () => {
    const c = {
      req: { header: (h: string) => (h === 'x-real-ip' ? '5.5.5.5' : undefined) },
    } as never;
    expect(clientIp(c)).toBe('5.5.5.5');
  });

  it('renvoie "unknown" sans en-tête d’IP', () => {
    const c = { req: { header: () => undefined } } as never;
    expect(clientIp(c)).toBe('unknown');
  });
});
