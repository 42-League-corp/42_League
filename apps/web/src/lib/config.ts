import { getApiBaseOverride } from './storage';

export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? '?';
export const APP_BUILD_DATE: string = import.meta.env.VITE_APP_DATE ?? '?';

const DEFAULT_API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:3000';

export function getApiBase(): string {
  return getApiBaseOverride() ?? DEFAULT_API_BASE;
}

export function getWebOrigin(): string {
  return window.location.origin;
}
