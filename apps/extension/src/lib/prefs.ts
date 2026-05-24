export type Theme = 'dark' | 'light' | 'system';
export type Lang = 'fr' | 'en';

const KEY_THEME = 'l42:theme';
const KEY_LANG = 'l42:lang';

const listeners = new Set<() => void>();

let cachedTheme: Theme = 'dark';
let cachedLang: Lang = 'fr';

export function subscribePrefs(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn();
}

export async function loadPrefs(): Promise<{ theme: Theme; lang: Lang }> {
  const out = await chrome.storage.local.get([KEY_THEME, KEY_LANG]);
  cachedTheme = (out[KEY_THEME] as Theme) ?? 'dark';
  cachedLang = (out[KEY_LANG] as Lang) ?? 'fr';
  return { theme: cachedTheme, lang: cachedLang };
}

export function currentTheme(): Theme {
  return cachedTheme;
}

export function currentLang(): Lang {
  return cachedLang;
}

export async function setTheme(t: Theme) {
  cachedTheme = t;
  await chrome.storage.local.set({ [KEY_THEME]: t });
  applyTheme();
  notify();
}

export async function setLang(l: Lang) {
  cachedLang = l;
  await chrome.storage.local.set({ [KEY_LANG]: l });
  notify();
}

export function resolvedTheme(): 'dark' | 'light' {
  if (cachedTheme === 'system') {
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return dark ? 'dark' : 'light';
  }
  return cachedTheme;
}

export function applyTheme() {
  document.documentElement.dataset.theme = resolvedTheme();
}

export function watchSystemTheme() {
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (!mq) return;
  mq.addEventListener('change', () => {
    if (cachedTheme === 'system') {
      applyTheme();
      notify();
    }
  });
}
