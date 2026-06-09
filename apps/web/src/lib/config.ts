import { getApiBaseOverride } from './storage';

export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? '?';
export const APP_BUILD_DATE: string = import.meta.env.VITE_APP_DATE ?? '?';

// Vrai si on tourne sur l'environnement de staging (staging.oneleague.fr).
// Sert à réserver l'accès aux superadmins (le backend l'impose aussi, APP_ENV=staging).
export const IS_STAGING: boolean =
  typeof window !== 'undefined' && window.location.hostname.startsWith('staging.');

const DEFAULT_API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:3000';

export function getApiBase(): string {
  return getApiBaseOverride() ?? DEFAULT_API_BASE;
}

export function getWebOrigin(): string {
  return window.location.origin;
}
