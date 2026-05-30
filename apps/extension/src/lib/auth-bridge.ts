export interface AuthStatus {
  authenticated: boolean;
  login: string | null;
}

interface BgResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function send<T>(type: string): Promise<T> {
  const res = (await chrome.runtime.sendMessage({ type })) as BgResponse<T>;
  if (!res?.ok) throw new Error(res?.error ?? 'background message failed');
  return res.data as T;
}

export const authBridge = {
  login: () => send<AuthStatus>('auth:login'),
  logout: () => send<AuthStatus>('auth:logout'),
  status: () => send<AuthStatus>('auth:status'),
};
