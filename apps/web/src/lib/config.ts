import { getApiBaseOverride } from './storage';

export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? '?';
export const APP_BUILD_DATE: string = import.meta.env.VITE_APP_DATE ?? '?';

// Vrai si on tourne sur l'environnement de staging (staging.oneleague.fr).
// Sert à réserver l'accès aux superadmins (le backend l'impose aussi, APP_ENV=staging).
export const IS_STAGING: boolean =
  typeof window !== 'undefined' && window.location.hostname.startsWith('staging.');

// Fallback de build/SSR uniquement (pas de window). En dev `npm run dev`, le proxy
// vite sur /api cible cette valeur ; en prod l'API est servie same-origin (voir
// getApiBase). VITE_API_BASE_URL n'est donc PAS la source de vérité en navigateur.
const DEFAULT_API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:3000';

export function getApiBase(): string {
  // Override explicite (outil de debug / GOD sync) : on respecte la valeur posée,
  // en la résolvant en URL absolue si elle est relative (pour new URL/EventSource).
  const override = getApiBaseOverride();
  if (override) {
    return override.startsWith('/') && typeof window !== 'undefined'
      ? `${window.location.origin}${override}`
      : override;
  }
  // Navigateur : TOUJOURS same-origin sous /api. Reverse-proxy Caddy en prod,
  // proxy vite en dev. Domaine-agnostique (aucun domaine baké → survit au rebrand
  // 42league.fr → oneleague.fr), pas de CORS ni de redirection cross-domaine (sinon
  // le preflight OPTIONS bute sur un 301 → « NetworkError »), compatible CSP
  // `connect-src 'self'`. URL absolue → OK pour `new URL(...)` (auth) et EventSource.
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`;
  }
  // SSR / build (pas de window) : fallback sur la valeur de build.
  return DEFAULT_API_BASE;
}

export function getWebOrigin(): string {
  return window.location.origin;
}
