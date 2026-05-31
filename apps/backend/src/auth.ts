import { Hono, type Context } from 'hono';
import { getSignedCookie, setSignedCookie, deleteCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { randomBytes } from 'node:crypto';
import { issueToken, verifyToken } from './tokens.js';

const FT_AUTH_URL = 'https://api.intra.42.fr/oauth/authorize';
const FT_TOKEN_URL = 'https://api.intra.42.fr/oauth/token';
const FT_ME_URL = 'https://api.intra.42.fr/v2/me';

const SESSION_COOKIE = 'league_session';
const STATE_COOKIE = 'league_oauth_state';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const STATE_MAX_AGE = 60 * 10; // 10 minutes

// `Secure` en prod uniquement : le cookie n'est alors transmis que sur HTTPS.
// En dev/test (HTTP localhost), Secure empêcherait le navigateur de stocker le
// cookie, donc on le laisse à false. La terminaison TLS est faite par Caddy ;
// l'attribut Set-Cookie reste correct même si le backend reçoit du HTTP en interne.
const COOKIE_SECURE = process.env.NODE_ENV === 'production';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new HTTPException(500, { message: `missing env var ${name}` });
  return v;
}

// Échappe toute valeur interpolée dans le HTML des pages de callback. Le login
// et le campus viennent du profil 42 (a priori sains), mais on ne fait jamais
// confiance à une donnée externe rendue en HTML — défense en profondeur (XSS).
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface FtProfile {
  login: string;
  ftId: number;
  campus: string | null;
  imageUrl: string | null;
}

interface FtMeResponse {
  id: number;
  login: string;
  campus?: Array<{ name: string }>;
  image?: {
    link?: string | null;
    versions?: { small?: string | null; medium?: string | null } | null;
  } | null;
}

interface OauthStateCookie {
  nonce: string;
  ext?: string;
  web?: string;
}

function isValidExtRedirect(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    // Chrome : https://<id>.chromiumapp.org/
    // Firefox : https://<uuid>.extensions.allizom.org/
    return (
      u.hostname.endsWith('.chromiumapp.org') ||
      u.hostname.endsWith('.extensions.allizom.org')
    );
  } catch {
    return false;
  }
}

export function getAllowedWebOrigins(): string[] {
  const raw = process.env.WEB_APP_URLS ?? 'http://localhost:5173';
  return raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function isValidWebRedirect(url: string): boolean {
  try {
    const u = new URL(url);
    return getAllowedWebOrigins().includes(u.origin);
  } catch {
    return false;
  }
}

export function createAuthRouter(
  onLogin: (profile: FtProfile) => Promise<void> | void,
) {
  const router = new Hono();

  async function startOauth(
    c: Context,
    opts: { ext?: string; web?: string } = {},
  ) {
    const uid = requireEnv('FT_OAUTH_UID');
    const redirectUri = requireEnv('FT_OAUTH_REDIRECT_URI');
    const secret = requireEnv('SESSION_SECRET');
    const nonce = randomBytes(16).toString('hex');
    const state: OauthStateCookie = { nonce, ...opts };

    await setSignedCookie(c, STATE_COOKIE, JSON.stringify(state), secret, {
      maxAge: STATE_MAX_AGE,
      httpOnly: true,
      sameSite: 'Lax',
      secure: COOKIE_SECURE,
      path: '/',
    });

    const url = new URL(FT_AUTH_URL);
    url.searchParams.set('client_id', uid);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'public');
    url.searchParams.set('state', nonce);

    return c.redirect(url.toString());
  }

  router.get('/login', (c) => startOauth(c));

  router.get('/extension/login', (c) => {
    const ext = c.req.query('ext_redirect');
    if (!ext || !isValidExtRedirect(ext)) {
      throw new HTTPException(400, {
        message:
          'ext_redirect must be a https://*.chromiumapp.org (Chrome) or https://*.extensions.allizom.org (Firefox) URL',
      });
    }
    return startOauth(c, { ext });
  });

  router.get('/web/login', (c) => {
    const web = c.req.query('return_to');
    if (!web || !isValidWebRedirect(web)) {
      throw new HTTPException(400, {
        message: `return_to must match one of WEB_APP_URLS (${getAllowedWebOrigins().join(', ') || 'none configured'})`,
      });
    }
    return startOauth(c, { web });
  });

  router.get('/callback', async (c) => {
    const secret = requireEnv('SESSION_SECRET');
    const code = c.req.query('code');
    const stateParam = c.req.query('state');
    const oauthError = c.req.query('error');

    if (oauthError) {
      throw new HTTPException(400, { message: `oauth error: ${oauthError}` });
    }
    if (!code || !stateParam) {
      throw new HTTPException(400, { message: 'missing code or state' });
    }

    const storedRaw = await getSignedCookie(c, secret, STATE_COOKIE);
    if (!storedRaw) {
      throw new HTTPException(400, { message: 'missing state cookie' });
    }
    let stored: OauthStateCookie;
    try {
      stored = JSON.parse(storedRaw) as OauthStateCookie;
    } catch {
      throw new HTTPException(400, { message: 'corrupted state cookie' });
    }
    if (stored.nonce !== stateParam) {
      throw new HTTPException(400, { message: 'invalid state — possible CSRF' });
    }
    deleteCookie(c, STATE_COOKIE, { path: '/' });

    const tokenRes = await fetch(FT_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: requireEnv('FT_OAUTH_UID'),
        client_secret: requireEnv('FT_OAUTH_SECRET'),
        code,
        redirect_uri: requireEnv('FT_OAUTH_REDIRECT_URI'),
      }),
    });
    if (!tokenRes.ok) {
      const body = (await tokenRes.text()).slice(0, 120);
      throw new HTTPException(502, {
        message: `token exchange failed: ${tokenRes.status} ${body}`,
      });
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenJson.access_token;
    if (!accessToken) {
      throw new HTTPException(502, { message: 'no access_token in response' });
    }

    const meRes = await fetch(FT_ME_URL, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!meRes.ok) {
      throw new HTTPException(502, {
        message: `fetch /v2/me failed: ${meRes.status}`,
      });
    }
    const me = (await meRes.json()) as FtMeResponse;

    const profile: FtProfile = {
      login: me.login,
      ftId: me.id,
      campus: me.campus?.[0]?.name ?? null,
      imageUrl:
        me.image?.versions?.medium ??
        me.image?.versions?.small ??
        me.image?.link ??
        null,
    };

    await onLogin(profile);

    const externalReturn = stored.ext ?? stored.web;
    if (externalReturn) {
      const leagueToken = issueToken(profile.login, secret);
      const redirect = new URL(externalReturn);
      // Token dans le fragment (#) — non transmis aux serveurs, absent des logs (RGPD Art. 32)
      redirect.hash = new URLSearchParams({ token: leagueToken }).toString();
      redirect.searchParams.set('login', profile.login);
      if (profile.campus) redirect.searchParams.set('campus', profile.campus);
      return c.redirect(redirect.toString());
    }

    await setSignedCookie(c, SESSION_COOKIE, profile.login, secret, {
      maxAge: SESSION_MAX_AGE,
      httpOnly: true,
      sameSite: 'Lax',
      secure: COOKIE_SECURE,
      path: '/',
    });

    return c.html(`<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><title>42 League — connecté</title>
<style>body{font-family:system-ui;max-width:480px;margin:4rem auto;padding:1rem;text-align:center}</style>
</head>
<body>
<h2>Connecté en tant que <code>${escapeHtml(profile.login)}</code></h2>
<p>Campus : ${profile.campus ? escapeHtml(profile.campus) : '—'}</p>
<p>Tu peux fermer cette fenêtre.</p>
</body></html>`);
  });

  router.post('/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  return router;
}

export async function getSessionLogin(c: Context): Promise<string | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const authHeader = c.req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    const login = verifyToken(token, secret);
    if (login) return login;
  }

  const cookieLogin = await getSignedCookie(c, secret, SESSION_COOKIE);
  return cookieLogin ? cookieLogin : null;
}
