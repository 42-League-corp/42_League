import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';

// =========================================================================
// RATE-LIMITING — fenêtre fixe en mémoire, par IP
// =========================================================================
// Suffisant pour une bêta mono-instance derrière Caddy : c'est un garde-fou
// anti-abus / anti-spam, pas un quota fin. Pour scaler horizontalement il
// faudra un store partagé (Redis), mais le backend tourne en single replica.
//
// Chaque limiteur isole ses compteurs via `name`, ce qui permet d'avoir
// plusieurs budgets indépendants (global vs auth vs écriture) sur une même IP.

type Bucket = { count: number; resetAt: number };

export interface RateLimitOptions {
  /** Identifiant du limiteur — isole ses compteurs des autres. */
  name: string;
  /** Largeur de la fenêtre en millisecondes. */
  windowMs: number;
  /** Nombre maximum de requêtes comptées autorisées par fenêtre. */
  max: number;
  /**
   * Renvoie `true` pour ne PAS compter ni bloquer la requête (ex. ignorer les
   * méthodes non mutantes sur un limiteur d'écriture).
   */
  skip?: (c: Context) => boolean;
}

const store = new Map<string, Bucket>();

// Balayage périodique : sans ça les clés expirées mais jamais relues
// resteraient en mémoire indéfiniment (fuite lente sur des IP éphémères).
let sweeper: ReturnType<typeof setInterval> | null = null;
function ensureSweeper(): void {
  if (sweeper) return;
  sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of store) {
      if (bucket.resetAt <= now) store.delete(key);
    }
  }, 60_000);
  // Ne pas maintenir le process en vie juste pour ce timer (tests, arrêt propre).
  sweeper.unref?.();
}

/**
 * Extrait l'IP cliente. Derrière Caddy/nginx la vraie IP est dans
 * `X-Forwarded-For` (premier maillon de la chaîne).
 */
export function clientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = c.req.header('x-real-ip');
  if (real) return real.trim();
  return c.req.header('cf-connecting-ip')?.trim() ?? 'unknown';
}

export function rateLimit(opts: RateLimitOptions) {
  ensureSweeper();
  return async (c: Context, next: Next) => {
    if (opts.skip?.(c)) {
      await next();
      return;
    }

    const key = `${opts.name}:${clientIp(c)}`;
    const now = Date.now();
    let bucket = store.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      store.set(key, bucket);
    }
    bucket.count++;

    const remaining = Math.max(0, opts.max - bucket.count);
    c.header('X-RateLimit-Limit', String(opts.max));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > opts.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      c.header('Retry-After', String(retryAfter));
      throw new HTTPException(429, { message: 'too many requests — slow down' });
    }

    await next();
  };
}

/** Réinitialise tous les compteurs — réservé aux tests. */
export function __resetRateLimitStore(): void {
  store.clear();
}
