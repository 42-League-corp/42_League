import { api, AuthError } from '../lib/api.js';
import { authBridge } from '../lib/auth-bridge.js';

const stateEl = document.getElementById('state') as HTMLDivElement;
const avatarEl = document.getElementById('avatar') as HTMLDivElement;
const loginLabel = document.getElementById('login-label') as HTMLDivElement;
const eloLabel = document.getElementById('elo-label') as HTMLDivElement;
const actionBtn = document.getElementById('action') as HTMLButtonElement;
const openOptions = document.getElementById('open-options') as HTMLButtonElement;
const openIntra = document.getElementById('open-intra') as HTMLButtonElement;
const openDefis = document.getElementById('open-defis') as HTMLButtonElement;
const openLeaderboard = document.getElementById('open-leaderboard') as HTMLButtonElement;
const errorEl = document.getElementById('error') as HTMLDivElement;

type Mode = 'anon' | 'connecting' | 'connected';

function setMode(mode: Mode) {
  stateEl.className = `auth-state ${mode}`;
}

function setAction(label: string, opts: { busy?: boolean; onClick?: () => void } = {}) {
  actionBtn.innerHTML = '';
  actionBtn.disabled = !!opts.busy;
  if (opts.busy) {
    const s = document.createElement('span');
    s.className = 'spinner';
    actionBtn.appendChild(s);
  }
  actionBtn.appendChild(document.createTextNode(label));
  actionBtn.onclick = opts.onClick ?? null;
}

async function openOptionsAt(anchor: string) {
  const url = chrome.runtime.getURL(`src/options/index.html#${anchor}`);
  const tabs = await chrome.tabs.query({
    url: chrome.runtime.getURL('src/options/index.html*'),
  });
  const existing = tabs[0];
  if (existing && existing.id != null) {
    await chrome.tabs.update(existing.id, { active: true, url });
    if (existing.windowId != null) {
      await chrome.windows.update(existing.windowId, { focused: true });
    }
  } else {
    await chrome.tabs.create({ url });
  }
}

openOptions.onclick = () => chrome.runtime.openOptionsPage();
openIntra.onclick = () => chrome.tabs.create({ url: 'https://profile.intra.42.fr/' });
openDefis.onclick = () => openOptionsAt('defis');
openLeaderboard.onclick = () => openOptionsAt('leaderboard');

function setAvatar(login: string | null, imageUrl: string | null) {
  avatarEl.innerHTML = '';
  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = login ?? '';
    img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block';
    img.onerror = () => {
      avatarEl.textContent = (login?.[0] ?? '?').toUpperCase();
    };
    avatarEl.appendChild(img);
  } else {
    avatarEl.textContent = (login?.[0] ?? '?').toUpperCase();
  }
}

async function showConnected(login: string) {
  setMode('connected');
  setAvatar(login, null);
  loginLabel.textContent = login;
  eloLabel.style.display = 'none';
  setAction('Se déconnecter', {
    onClick: async () => {
      await authBridge.logout();
      await render();
    },
  });
  try {
    const me = await api.me();
    setAvatar(login, me.user?.imageUrl ?? null);
    if (me.user?.elo != null) {
      eloLabel.textContent = `${me.user.elo} ELO`;
      eloLabel.style.display = 'block';
    }
  } catch {
    // ignore — UI still shows the logged-in state
  }
}

function showAnon() {
  setMode('anon');
  avatarEl.innerHTML = '';
  avatarEl.textContent = '42';
  loginLabel.textContent = 'Non connecté';
  eloLabel.style.display = 'none';
  setAction('Se connecter avec 42', { onClick: startLogin });
}

function showConnecting() {
  setMode('connecting');
  avatarEl.innerHTML = '';
  avatarEl.textContent = '42';
  loginLabel.textContent = 'Connexion en cours…';
  eloLabel.style.display = 'none';
  setAction('Connexion…', { busy: true });
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

render();
