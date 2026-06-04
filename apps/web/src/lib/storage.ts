const KEY_TOKEN = 'league:token';
const KEY_LOGIN = 'league:login';
// Sauvegarde du token de l'admin pendant qu'il « teste en mode user » (compte
// tester). Permet de revenir à son compte sans repasser par OAuth.
const KEY_IMP_TOKEN = 'league:imp_token';
const KEY_IMP_LOGIN = 'league:imp_login';
const KEY_LANG = 'league:lang';
const KEY_API_BASE_OVERRIDE = 'league:api_base_override';
const KEY_GOAT_INTRO_SEEN = 'league:goat_intro_seen';

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
  // Un logout efface aussi toute session d'impersonation en cours.
  safeRemove(KEY_IMP_TOKEN);
  safeRemove(KEY_IMP_LOGIN);
}

// ── Impersonation « tester » (staging, admins) ─────────────────────────────
// Bascule sur le compte `tester` en mémorisant le token courant pour le retour.
export function startImpersonation(testerToken: string, testerLogin: string): void {
  const curToken = safeGet(KEY_TOKEN);
  const curLogin = safeGet(KEY_LOGIN);
  if (curToken && curLogin) {
    safeSet(KEY_IMP_TOKEN, curToken);
    safeSet(KEY_IMP_LOGIN, curLogin);
  }
  setToken(testerToken, testerLogin);
}

// Restaure le compte d'origine. Renvoie false si aucune impersonation en cours.
export function stopImpersonation(): boolean {
  const token = safeGet(KEY_IMP_TOKEN);
  const login = safeGet(KEY_IMP_LOGIN);
  if (!token || !login) return false;
  setToken(token, login);
  safeRemove(KEY_IMP_TOKEN);
  safeRemove(KEY_IMP_LOGIN);
  return true;
}

// Login de l'admin sauvegardé si une impersonation est en cours, sinon null.
export function getImpersonatorLogin(): string | null {
  return safeGet(KEY_IMP_LOGIN);
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

// Intro G.O.A.T : affichée une seule fois (puis rappelable via le bouton « ? »).
export function hasSeenGoatIntro(): boolean {
  return safeGet(KEY_GOAT_INTRO_SEEN) === '1';
}

export function markGoatIntroSeen(): void {
  safeSet(KEY_GOAT_INTRO_SEEN, '1');
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
