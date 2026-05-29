import { getApiBaseOverride } from './storage';

export const APP_VERSION: string = __APP_VERSION__;
export const APP_BUILD_DATE: string = __APP_DATE__;

const DEFAULT_API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:3000';

export function getApiBase(): string {
  return getApiBaseOverride() ?? DEFAULT_API_BASE;
}

export function getWebOrigin(): string {
  return window.location.origin;
}
