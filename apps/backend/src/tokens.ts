import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
// Token éphémère dédié au flux SSE : transmis en query string (?token=…), donc
// susceptible de fuiter dans les logs d'accès / l'historique / le header Referer.
// On limite drastiquement sa durée de vie + son périmètre (lecture SSE seule).
const STREAM_TOKEN_TTL_SECONDS = 60; // 60 s — le front en redemande un à chaque (re)connexion

// 'auth'  : credential complet du compte (Bearer) — toutes les routes API.
// 'sse'   : éphémère, n'autorise QUE l'ouverture du flux /events (lecture).
type TokenScope = 'auth' | 'sse';

interface TokenPayload {
  login: string;
  iat: number;
  exp: number;
  // Absent sur les tokens historiques → traité comme 'auth' (rétro-compat).
  scope?: TokenScope;
}

function b64urlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(data: string, secret: string): string {
  return b64urlEncode(createHmac('sha256', secret).update(data).digest());
}

function issue(login: string, secret: string, ttl: number, scope: TokenScope): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    login,
    iat: now,
    exp: now + ttl,
    // On omet le scope pour les tokens 'auth' → format identique aux tokens
    // historiques (rétro-compat des sessions déjà émises).
    ...(scope === 'auth' ? {} : { scope }),
  };
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

// Vérifie la signature + l'expiration et renvoie le payload, sans juger du scope.
function decodeVerified(token: string, secret: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts as [string, string];
  const expected = sign(payloadB64, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8')) as TokenPayload;
    if (typeof payload.login !== 'string' || typeof payload.exp !== 'number') return null;
    if (Math.floor(Date.now() / 1000) >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function issueToken(login: string, secret: string): string {
  return issue(login, secret, TOKEN_TTL_SECONDS, 'auth');
}

// Token éphémère pour ouvrir le flux SSE en query string sans exposer le Bearer.
export function issueStreamToken(login: string, secret: string): string {
  return issue(login, secret, STREAM_TOKEN_TTL_SECONDS, 'sse');
}

// Credential complet (Bearer). Refuse les tokens de scope 'sse' : un token de
// stream qui aurait fuité (logs, Referer…) ne doit JAMAIS muter le compte.
export function verifyToken(token: string, secret: string): string | null {
  const payload = decodeVerified(token, secret);
  if (!payload) return null;
  if (payload.scope && payload.scope !== 'auth') return null;
  return payload.login;
}

// N'autorise QUE les tokens de scope 'sse' (ouverture du flux /events).
export function verifyStreamToken(token: string, secret: string): string | null {
  const payload = decodeVerified(token, secret);
  if (!payload) return null;
  if (payload.scope !== 'sse') return null;
  return payload.login;
}
