import { getApiBase, getWebOrigin } from './config';
import { clearToken, setToken } from './storage';

const AUTH_RETURN_PATH = '/auth/return';

export function buildLoginUrl(): string {
  const returnTo = `${getWebOrigin()}${AUTH_RETURN_PATH}`;
  const url = new URL(`${getApiBase()}/auth/web/login`);
  url.searchParams.set('return_to', returnTo);
  return url.toString();
}

export function redirectToLogin(): void {
  window.location.href = buildLoginUrl();
}

export interface AuthReturnResult {
  ok: boolean;
  login: string | null;
  error: string | null;
}

export function consumeAuthReturn(): AuthReturnResult {
  const search = new URLSearchParams(window.location.search);
  // Token dans le fragment (#) — non transmis aux serveurs ni logué (RGPD Art. 32)
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const token = hash.get('token');
  const login = search.get('login');
  const error = search.get('error');

  if (error) {
    return { ok: false, login: login ?? null, error };
  }
  if (token && login) {
    setToken(token, login);
    // Efface le fragment pour éviter qu'il reste dans l'historique du navigateur
    if (window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    return { ok: true, login, error: null };
  }
  return { ok: false, login: null, error: 'missing token or login' };
}

export function logout(): void {
  clearToken();
}
