import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Context } from 'hono';

// getSessionLogin lit un cookie signé via hono/cookie. On mocke uniquement cette
// couche ; le chemin Bearer s'appuie sur le vrai issueToken/verifyToken (tokens.ts).
const { getSignedCookie } = vi.hoisted(() => ({ getSignedCookie: vi.fn() }));
vi.mock('hono/cookie', () => ({
  getSignedCookie,
  setSignedCookie: vi.fn(),
  deleteCookie: vi.fn(),
}));

import { getSessionLogin, getAllowedWebOrigins } from './auth.js';
import { issueToken } from './tokens.js';

const SECRET = 'test-session-secret';

/** Faux Context Hono minimal : seuls les en-têtes lus par getSessionLogin importent. */
function ctx(headers: Record<string, string> = {}): Context {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    req: { header: (name: string) => lower[name.toLowerCase()] },
  } as unknown as Context;
}

let savedSecret: string | undefined;
let savedWebUrls: string | undefined;

beforeEach(() => {
  getSignedCookie.mockReset();
  getSignedCookie.mockResolvedValue(undefined);
  savedSecret = process.env.SESSION_SECRET;
  savedWebUrls = process.env.WEB_APP_URLS;
  process.env.SESSION_SECRET = SECRET;
});

afterEach(() => {
  if (savedSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = savedSecret;
  if (savedWebUrls === undefined) delete process.env.WEB_APP_URLS;
  else process.env.WEB_APP_URLS = savedWebUrls;
});

// ───────────────────────────── getSessionLogin ──────────────────────────────

describe('getSessionLogin — secret manquant', () => {
  it('retourne null si SESSION_SECRET n’est pas défini, même avec un Bearer', async () => {
    const token = issueToken('alice', SECRET);
    delete process.env.SESSION_SECRET;
    expect(await getSessionLogin(ctx({ authorization: `Bearer ${token}` }))).toBeNull();
    // Sans secret, on n'essaie même pas de lire le cookie.
    expect(getSignedCookie).not.toHaveBeenCalled();
  });
});

describe('getSessionLogin — chemin Bearer', () => {
  it('accepte un token valide et n’interroge pas le cookie', async () => {
    const token = issueToken('bob', SECRET);
    expect(await getSessionLogin(ctx({ authorization: `Bearer ${token}` }))).toBe('bob');
    expect(getSignedCookie).not.toHaveBeenCalled();
  });

  it('bascule sur le cookie si le token Bearer est invalide', async () => {
    getSignedCookie.mockResolvedValue('cookie-user');
    const res = await getSessionLogin(ctx({ authorization: 'Bearer not-a-real-token' }));
    expect(res).toBe('cookie-user');
    expect(getSignedCookie).toHaveBeenCalledOnce();
  });

  it('bascule sur le cookie si le token est signé avec un autre secret', async () => {
    const foreign = issueToken('mallory', 'un-autre-secret');
    getSignedCookie.mockResolvedValue('cookie-user');
    expect(await getSessionLogin(ctx({ authorization: `Bearer ${foreign}` }))).toBe(
      'cookie-user',
    );
  });

  it('ignore un en-tête Authorization sans préfixe "Bearer "', async () => {
    const token = issueToken('carol', SECRET);
    getSignedCookie.mockResolvedValue('cookie-user');
    // "Basic ..." ou token nu → pas le chemin Bearer, on tombe sur le cookie.
    expect(await getSessionLogin(ctx({ authorization: token }))).toBe('cookie-user');
    expect(await getSessionLogin(ctx({ authorization: `Basic ${token}` }))).toBe(
      'cookie-user',
    );
  });
});

describe('getSessionLogin — chemin cookie', () => {
  it('retourne le login du cookie signé en l’absence de Bearer', async () => {
    getSignedCookie.mockResolvedValue('dave');
    expect(await getSessionLogin(ctx())).toBe('dave');
  });

  it('retourne null quand le cookie est absent/invalide (false)', async () => {
    getSignedCookie.mockResolvedValue(false);
    expect(await getSessionLogin(ctx())).toBeNull();
  });

  it('retourne null sans aucune authentification', async () => {
    getSignedCookie.mockResolvedValue(undefined);
    expect(await getSessionLogin(ctx())).toBeNull();
  });

  it('le Bearer valide a priorité sur un cookie présent', async () => {
    const token = issueToken('bearer-wins', SECRET);
    getSignedCookie.mockResolvedValue('cookie-loser');
    expect(await getSessionLogin(ctx({ authorization: `Bearer ${token}` }))).toBe(
      'bearer-wins',
    );
    expect(getSignedCookie).not.toHaveBeenCalled();
  });
});

// ──────────────────────────── getAllowedWebOrigins ──────────────────────────

describe('getAllowedWebOrigins', () => {
  it('renvoie le localhost par défaut quand WEB_APP_URLS est absent', () => {
    delete process.env.WEB_APP_URLS;
    expect(getAllowedWebOrigins()).toEqual(['http://localhost:5173']);
  });

  it('découpe sur les virgules, trim et retire le slash final', () => {
    process.env.WEB_APP_URLS = 'https://a.com/, http://b.com , https://c.com/';
    expect(getAllowedWebOrigins()).toEqual([
      'https://a.com',
      'http://b.com',
      'https://c.com',
    ]);
  });

  it('élimine les entrées vides (virgules superflues)', () => {
    process.env.WEB_APP_URLS = 'https://a.com,,, ,https://b.com';
    expect(getAllowedWebOrigins()).toEqual(['https://a.com', 'https://b.com']);
  });

  it('ne retire qu’un seul slash final (pas le chemin)', () => {
    process.env.WEB_APP_URLS = 'https://a.com/app/';
    expect(getAllowedWebOrigins()).toEqual(['https://a.com/app']);
  });
});
