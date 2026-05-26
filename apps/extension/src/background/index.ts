import { getApiBase } from '../lib/config.js';
import { clearToken, getToken, setToken } from '../lib/storage.js';
// Ajoute l'import de rawRequest et AuthError
import { rawRequest, AuthError } from '../lib/api.js'; 

type Message =
  | { type: 'auth:login' }
  | { type: 'auth:logout' }
  | { type: 'auth:status' }
  | { type: 'api:proxy'; path: string; init?: RequestInit; options?: { auth?: boolean } }; // Ajout du type


async function startLoginFlow(): Promise<AuthStatus> {
  const redirectUri = chrome.identity.getRedirectURL();
  const base = await getApiBase();
  const authUrl = new URL(`${base}/auth/extension/login`);
  authUrl.searchParams.set('ext_redirect', redirectUri);

  const finalUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  });
  if (!finalUrl) {
    throw new Error('OAuth flow returned no redirect URL');
  }

  const parsed = new URL(finalUrl);
  const token = parsed.searchParams.get('token');
  const login = parsed.searchParams.get('login');
  if (!token || !login) {
    throw new Error('OAuth redirect missing token or login');
  }

  await setToken(token, login);
  return { authenticated: true, login };
}

async function getStatus(): Promise<AuthStatus> {
  const token = await getToken();
  if (!token) return { authenticated: false, login: null };
  try {
    const base = await getApiBase();
    const res = await fetch(`${base}/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      await clearToken();
      return { authenticated: false, login: null };
    }
    const data = (await res.json()) as { login?: string };
    return { authenticated: true, login: data.login ?? null };
  } catch {
    return { authenticated: false, login: null };
  }
}

chrome.runtime.onMessage.addListener(
  (msg: Message, _sender, sendResponse: (r: unknown) => void) => {
    (async () => {
      try {
        if (msg.type === 'auth:login') {
          sendResponse({ ok: true, data: await startLoginFlow() });
        } else if (msg.type === 'auth:logout') {
          await clearToken();
          sendResponse({ ok: true, data: { authenticated: false, login: null } });
        } else if (msg.type === 'auth:status') {
          sendResponse({ ok: true, data: await getStatus() });
        
        // ---- NOUVELLE INTERCEPTION PROXY ----
        } else if (msg.type === 'api:proxy') {
          try {
            const data = await rawRequest(msg.path, msg.init, msg.options);
            sendResponse({ ok: true, data });
          } catch (err) {
            sendResponse({
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        // -------------------------------------

        } else {
          sendResponse({ ok: false, error: 'unknown message type' });
        }
      } catch (err) {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return true; // Obligatoire pour garder le channel ouvert pour un appel asynchrone
  },
);
