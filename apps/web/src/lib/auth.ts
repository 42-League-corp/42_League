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
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const login = params.get('login');
  const error = params.get('error');

  if (error) {
    return { ok: false, login: login ?? null, error };
  }
  if (token && login) {
    setToken(token, login);
    return { ok: true, login, error: null };
  }
  return { ok: false, login: null, error: 'missing token or login' };
}

export function logout(): void {
  clearToken();
}
