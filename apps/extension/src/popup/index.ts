import { api, AuthError } from '../lib/api.js';
import { authBridge } from '../lib/auth-bridge.js';

const WEB_APP_URL =
  (import.meta.env.VITE_WEB_APP_URL as string | undefined)?.replace(/\/$/, '') ??
  'https://oneleague.fr';

const stateEl = document.getElementById('state') as HTMLDivElement;
const avatarEl = document.getElementById('avatar') as HTMLDivElement;
const loginLabel = document.getElementById('login-label') as HTMLDivElement;
const eloLabel = document.getElementById('elo-label') as HTMLDivElement;
const openWebBtn = document.getElementById('open-web') as HTMLButtonElement;
const authActionBtn = document.getElementById('auth-action') as HTMLButtonElement;
const openIntraBtn = document.getElementById('open-intra') as HTMLButtonElement;
const errorEl = document.getElementById('error') as HTMLDivElement;
const urlLabel = document.getElementById('url-label') as HTMLElement;

urlLabel.textContent = WEB_APP_URL.replace(/^https?:\/\//, '');

type Mode = 'anon' | 'connecting' | 'connected';

function setMode(m: Mode) {
  stateEl.className = `auth-state ${m}`;
}

function setAvatar(login: string | null, imageUrl: string | null) {
  avatarEl.innerHTML = '';
  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = login ?? '';
    img.onerror = () => {
      avatarEl.textContent = (login?.[0] ?? '?').toUpperCase();
    };
    avatarEl.appendChild(img);
  } else {
    avatarEl.textContent = (login?.[0] ?? '?').toUpperCase();
  }
}

function setAuthAction(label: string, onClick: () => void, danger = false) {
  authActionBtn.innerHTML = '';
  authActionBtn.className = danger ? 'danger' : 'ghost';
  authActionBtn.disabled = false;
  authActionBtn.appendChild(document.createTextNode(label));
  authActionBtn.onclick = onClick;
}

function setAuthBusy(label: string) {
  authActionBtn.innerHTML = '';
  authActionBtn.className = 'ghost';
  authActionBtn.disabled = true;
  const s = document.createElement('span');
  s.className = 'spinner';
  authActionBtn.appendChild(s);
  authActionBtn.appendChild(document.createTextNode(' ' + label));
}

async function openWebApp() {
  const matchPattern = `${WEB_APP_URL}/*`;
  try {
    const tabs = await chrome.tabs.query({ url: matchPattern });
    const existing = tabs[0];
    if (existing?.id != null) {
      await chrome.tabs.update(existing.id, { active: true });
      if (existing.windowId != null) {
        await chrome.windows.update(existing.windowId, { focused: true });
      }
    } else {
      await chrome.tabs.create({ url: WEB_APP_URL });
    }
    window.close();
  } catch {
    await chrome.tabs.create({ url: WEB_APP_URL });
    window.close();
  }
}

openWebBtn.onclick = openWebApp;
openIntraBtn.onclick = async () => {
  await chrome.tabs.create({ url: 'https://profile.intra.42.fr/' });
  window.close();
};

async function showConnected(login: string) {
  setMode('connected');
  setAvatar(login, null);
  loginLabel.textContent = login;
  eloLabel.style.display = 'none';
  setAuthAction(
    'Se déconnecter',
    async () => {
      await authBridge.logout();
      await render();
    },
    true,
  );
  try {
    const me = await api.me();
    setAvatar(login, me.user?.imageUrl ?? null);
    if (me.user?.elo != null) {
      eloLabel.textContent = `${me.user.elo} ELO`;
      eloLabel.style.display = 'block';
    }
  } catch {
    /* still show logged-in state even if /me fails */
  }
}

function showAnon() {
  setMode('anon');
  avatarEl.innerHTML = '';
  avatarEl.textContent = '42';
  loginLabel.textContent = 'Non connecté';
  eloLabel.style.display = 'none';
  setAuthAction('Se connecter', startLogin);
}

function showConnecting() {
  setMode('connecting');
  avatarEl.innerHTML = '';
  avatarEl.textContent = '42';
  loginLabel.textContent = 'Connexion en cours…';
  eloLabel.style.display = 'none';
  setAuthBusy('Connexion…');
}

async function startLogin() {
  errorEl.textContent = '';
  showConnecting();
  try {
    const res = await authBridge.login();
    if (res.authenticated && res.login) {
      await showConnected(res.login);
    } else {
      showAnon();
    }
  } catch (err) {
    errorEl.textContent = err instanceof Error ? err.message : String(err);
    showAnon();
  }
}

async function render() {
  errorEl.textContent = '';
  try {
    const s = await authBridge.status();
    if (s.authenticated && s.login) {
      await showConnected(s.login);
    } else {
      showAnon();
    }
  } catch (err) {
    if (err instanceof AuthError) {
      showAnon();
    } else {
      errorEl.textContent = err instanceof Error ? err.message : String(err);
      showAnon();
    }
  }
}

void render();
