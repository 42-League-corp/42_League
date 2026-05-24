import { STORAGE_LOGIN_KEY, STORAGE_TOKEN_KEY } from './config.js';

export async function getToken(): Promise<string | null> {
  const res = await chrome.storage.local.get(STORAGE_TOKEN_KEY);
  const value = res[STORAGE_TOKEN_KEY];
  return typeof value === 'string' ? value : null;
}

export async function setToken(token: string, login: string): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_TOKEN_KEY]: token,
    [STORAGE_LOGIN_KEY]: login,
  });
}

export async function clearToken(): Promise<void> {
  await chrome.storage.local.remove([STORAGE_TOKEN_KEY, STORAGE_LOGIN_KEY]);
}

export async function getLogin(): Promise<string | null> {
  const res = await chrome.storage.local.get(STORAGE_LOGIN_KEY);
  const value = res[STORAGE_LOGIN_KEY];
  return typeof value === 'string' ? value : null;
}
