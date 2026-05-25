const KEY_TOKEN = 'league:token';
const KEY_LOGIN = 'league:login';
const KEY_LANG = 'league:lang';
const KEY_API_BASE_OVERRIDE = 'league:api_base_override';

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota / private mode — silent */
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

export function getToken(): string | null {
  return safeGet(KEY_TOKEN);
}

export function setToken(token: string, login: string): void {
  safeSet(KEY_TOKEN, token);
  safeSet(KEY_LOGIN, login);
}

export function clearToken(): void {
  safeRemove(KEY_TOKEN);
  safeRemove(KEY_LOGIN);
}

export function getStoredLogin(): string | null {
  return safeGet(KEY_LOGIN);
}

export function getStoredLang(): string | null {
  return safeGet(KEY_LANG);
}

export function setStoredLang(lang: string): void {
  safeSet(KEY_LANG, lang);
}

export function getApiBaseOverride(): string | null {
  return safeGet(KEY_API_BASE_OVERRIDE);
}

export function setApiBaseOverride(url: string): void {
  safeSet(KEY_API_BASE_OVERRIDE, url.replace(/\/$/, ''));
}

export function clearApiBaseOverride(): void {
  safeRemove(KEY_API_BASE_OVERRIDE);
}
