export const DEFAULT_API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:3000';

export const STORAGE_TOKEN_KEY = 'league_token';
export const STORAGE_LOGIN_KEY = 'league_login';
export const STORAGE_API_BASE_KEY = 'league_api_base';

export async function getApiBase(): Promise<string> {
  const res = await chrome.storage.local.get(STORAGE_API_BASE_KEY);
  const v = res[STORAGE_API_BASE_KEY];
  return typeof v === 'string' && v.trim() ? v.replace(/\/$/, '') : DEFAULT_API_BASE_URL;
}

export async function setApiBase(url: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_API_BASE_KEY]: url.replace(/\/$/, '') });
}

export async function resetApiBase(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_API_BASE_KEY);
}
