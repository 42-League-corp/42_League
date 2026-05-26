import {
  api,
  AuthError,
  type Challenge,
  type LeaderboardEntry,
  type PendingMatch,
  type PlayedMatch,
} from '../lib/api.js';
import { authBridge } from '../lib/auth-bridge.js';
import { attachTooltip, setTooltipData } from '../lib/tooltip.js';
import { confirmDialog } from '../lib/confirm.js';

const BLOCK_ID = 'league-42-pending-block';
const STYLE_ID = 'league-42-pending-style';
const REFRESH_MS = 30_000;

const ANCHOR_KEYWORDS = ['évaluations', 'evaluations'];

let myLogin: string | null = null;
let challenges: Challenge[] = [];
let pending: PendingMatch[] = [];
let leaderboard: LeaderboardEntry[] = [];
let allPlayed: PlayedMatch[] = [];
let pollTimer: ReturnType<typeof setInterval> | null = null;
const busy = new Set<string>();
const recordingFor = new Set<string>();
const draftConfirmScores = new Map<string, { mine: string; opp: string }>();

function showToast(message: string, kind: 'ok' | 'error' = 'error') {
  const id = 'league-42-toast';
  document.getElementById(id)?.remove();
  const t = document.createElement('div');
  t.id = id;
  t.textContent = message;
  t.style.cssText = `
    position: fixed; top: 16px; right: 16px;
    z-index: 2147483647;
    background: ${kind === 'ok' ? '#e6f9fa' : '#fbeaec'};
    color: ${kind === 'ok' ? '#00a3a5' : '#b00020'};
    border: 1px solid ${kind === 'ok' ? '#00babc' : '#b00020'};
    padding: 10px 14px; border-radius: 4px;
    font-family: system-ui, sans-serif; font-size: 13px;
    font-weight: 600;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    max-width: 340px;
    animation: l42-toast-in 200ms ease-out;
  `;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 5000);
}

function isContextInvalidated(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('Extension context invalidated');
}

function shutdown() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  document.getElementById(BLOCK_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
}

function styleOnce() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    #${BLOCK_ID} {
      display: flex; flex-direction: column;
      padding: 0;
      margin: 0 0 6px 0;
    }
    #${BLOCK_ID}:not(:empty) {
      border-bottom: 1px solid #e8e8e8;
      padding-bottom: 4px;
      margin-bottom: 6px;
    }
    #${BLOCK_ID} .l42-line {
      display: flex; align-items: center; gap: 5px;
      font: inherit; font-size: 12px; line-height: 1.4;
      font-weight: 400;
      padding: 3px 4px;
      color: #555;
      flex-wrap: wrap;
    }
    #${BLOCK_ID} .l42-emoji { font-size: 12px; }
    #${BLOCK_ID} .l42-text { color: #555; }
    #${BLOCK_ID} .l42-badge {
      font-size: 9px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em;
      padding: 2px 6px; border-radius: 2px;
      margin-right: 4px;
    }
    #${BLOCK_ID} .l42-badge.l42-bg-pending {
      background: rgba(255, 183, 27, 0.15); color: #b8860b;
      border: 1px solid rgba(184, 134, 11, 0.4);
    }
    #${BLOCK_ID} .l42-badge.l42-bg-accepted {
      background: rgba(0, 186, 188, 0.12); color: #00a3a5;
      border: 1px solid rgba(0, 163, 165, 0.4);
    }
    #${BLOCK_ID} .l42-badge.l42-bg-confirm {
      background: rgba(176, 0, 32, 0.08); color: #b00020;
      border: 1px solid rgba(176, 0, 32, 0.3);
    }
    #${BLOCK_ID} .l42-badge.l42-bg-played {
      background: rgba(120, 120, 120, 0.1); color: #666;
      border: 1px solid rgba(120, 120, 120, 0.3);
    }
    #${BLOCK_ID} .l42-opp {
      color: #00babc; text-decoration: none; font-weight: 500;
    }
    #${BLOCK_ID} .l42-opp:hover { text-decoration: underline; color: #00a3a5; }
    #${BLOCK_ID} .l42-score {
      font-variant-numeric: tabular-nums;
      font-size: 11px; font-weight: 600;
      display: inline-flex; align-items: baseline;
    }
    #${BLOCK_ID} .l42-w { color: #c9a227; }
    #${BLOCK_ID} .l42-l { color: #b00020; }
    #${BLOCK_ID} .l42-suffix { font-size: 9px; margin-left: 1px; }
    #${BLOCK_ID} .l42-dash { color: #bbb; margin: 0 4px; font-size: 11px; }
    #${BLOCK_ID} .l42-when {
      color: #888; font-size: 11px; font-style: italic;
    }
    #${BLOCK_ID} .l42-when.l42-late { color: #b00020; font-style: normal; font-weight: 500; }
    #${BLOCK_ID} .l42-actions { margin-left: auto; display: inline-flex; gap: 2px; align-items: center; }
    #${BLOCK_ID} .l42-btn {
      cursor: pointer; border: none; background: transparent;
      width: 20px; height: 20px;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 3px;
      transition: background 120ms, transform 80ms;
    }
    #${BLOCK_ID} .l42-btn i { font-size: 12px; line-height: 1; }
    #${BLOCK_ID} .l42-btn:disabled { opacity: 0.4; cursor: default; }
    #${BLOCK_ID} .l42-btn:active:not(:disabled) { transform: scale(0.9); }
    #${BLOCK_ID} .l42-ok { color: #00babc; }
    #${BLOCK_ID} .l42-ok:hover:not(:disabled) { background: #e6f9fa; color: #00a3a5; }
    #${BLOCK_ID} .l42-no { color: #b00020; }
    #${BLOCK_ID} .l42-no:hover:not(:disabled) { background: #fbeaec; }
    #${BLOCK_ID} .l42-wait { color: #999; font-size: 11px; font-style: italic; }
    #${BLOCK_ID} .l42-cta {
      cursor: pointer; border: 1px solid #00babc; background: transparent;
      color: #00babc; font-size: 11px; font-weight: 600;
      padding: 2px 8px; border-radius: 3px;
      transition: background 120ms, color 120ms;
    }
    #${BLOCK_ID} .l42-cta:hover { background: #00babc; color: #fff; }
    #${BLOCK_ID} .l42-cta:disabled { opacity: 0.4; cursor: default; }
    #${BLOCK_ID} .l42-record {
      display: flex; align-items: stretch; gap: 6px;
      flex-basis: 100%;
      margin-top: 4px;
      padding: 0;
      background: transparent;
    }
    #${BLOCK_ID} .l42-record input {
      flex: 1;
      min-width: 0;
      padding: 8px 10px; font-size: 13px; font-weight: 600;
      border: 1px solid #d8d8d8; border-radius: 3px;
      text-align: center; font-variant-numeric: tabular-nums;
      background: transparent;
      color: inherit;
    }
    #${BLOCK_ID} .l42-record input:focus { outline: none; border-color: #00babc; box-shadow: 0 0 0 2px rgba(0,186,188,0.15); }
    #${BLOCK_ID} .l42-record .l42-mini {
      display: flex; align-items: center; justify-content: center;
      color: #aaa; font-size: 14px; font-weight: 600;
      padding: 0 2px;
    }
    #${BLOCK_ID} .l42-record .l42-cta {
      padding: 6px 14px; font-size: 12px;
    }
    #${BLOCK_ID} .l42-record .l42-btn {
      width: 30px; height: auto;
    }
  `;
  document.head.appendChild(s);
}

function findEvalContent(): HTMLElement | null {
  const direct = document.getElementById('collapseEvaluations');
  if (direct) return direct;
  const headings = Array.from(
    document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, .profile-title'),
  );
  for (const h of headings) {
    const txt = (h.textContent ?? '').trim().toLowerCase();
    if (!txt) continue;
    if (ANCHOR_KEYWORDS.some((k) => txt.includes(k))) {
      const card = h.closest('.container-inner-item, .boxed, section, article');
      if (card) {
        const overflow = card.querySelector<HTMLElement>('.overflowable-item');
        return overflow ?? (card as HTMLElement);
      }
      return h.parentElement;
    }
  }
  return null;
}

function ensureBlock(): HTMLElement | null {
  let block = document.getElementById(BLOCK_ID) as HTMLElement | null;
  if (block && block.isConnected) return block;
  const target = findEvalContent();
  if (!target) return null;
  if (!block) {
    block = document.createElement('div');
    block.id = BLOCK_ID;
  }
  target.prepend(block);
  return block;
}

function profileUrl(login: string): string {
  return `https://profile.intra.42.fr/users/${encodeURIComponent(login)}`;
}

function scorePart(score: number, won: boolean): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'l42-score ' + (won ? 'l42-w' : 'l42-l');
  const n = document.createElement('span');
  n.textContent = String(score);
  const suf = document.createElement('span');
  suf.className = 'l42-suffix';
  suf.textContent = won ? 'W' : 'L';
  wrap.append(n, suf);
  return wrap;
}

function fmtRelative(iso: string): { text: string; late: boolean } {
  const diff = new Date(iso).getTime() - Date.now();
  const absMin = Math.round(Math.abs(diff) / 60_000);
  if (diff >= 0) {
    if (absMin < 1) return { text: 'maintenant', late: false };
    if (absMin === 1) return { text: 'dans 1 minute', late: false };
    if (absMin < 60) return { text: `dans ${absMin} minutes`, late: false };
    const h = Math.floor(absMin / 60);
    return { text: h === 1 ? 'dans 1 heure' : `dans ${h} heures`, late: false };
  }
  if (absMin < 1) return { text: "à l'instant", late: false };
  if (absMin === 1) return { text: 'il y a 1 minute', late: true };
  if (absMin < 60) return { text: `il y a ${absMin} minutes`, late: true };
  const h = Math.floor(absMin / 60);
  return { text: h === 1 ? 'il y a 1 heure' : `il y a ${h} heures`, late: true };
}

function makeButton(opts: {
  cls: string;
  title: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
}): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = `l42-btn ${opts.cls}`;
  b.title = opts.title;
  b.disabled = !!opts.disabled;
  b.onclick = opts.onClick;
  const i = document.createElement('i');
  i.className = `fal ${opts.icon}`;
  b.appendChild(i);
  return b;
}

function makeBaseLine(opts: {
  emoji: string;
  text: string;
  opponent: string;
  badge?: { label: string; cls: string };
}): HTMLElement {
  const line = document.createElement('div');
  line.className = 'l42-line';

  const emoji = document.createElement('span');
  emoji.className = 'l42-emoji';
  emoji.textContent = opts.emoji;
  line.append(emoji);

  if (opts.badge) {
    const badge = document.createElement('span');
    badge.className = `l42-badge ${opts.badge.cls}`;
    badge.textContent = opts.badge.label;
    line.append(badge);
  }

  const text = document.createElement('span');
  text.className = 'l42-text';
  text.textContent = opts.text;

  const opp = document.createElement('a');
  opp.className = 'l42-opp';
  opp.href = profileUrl(opts.opponent);
  opp.target = '_blank';
  opp.rel = 'noreferrer noopener';
  opp.textContent = opts.opponent;
  opp.dataset.login = opts.opponent;
  attachTooltip(opp, opts.opponent);

  line.append(text, opp);
  return line;
}

function appendScores(line: HTMLElement, winnerScore: number, loserScore: number) {
  const dash = document.createElement('span');
  dash.className = 'l42-dash';
  dash.textContent = '–';
  line.append(scorePart(winnerScore, true), dash, scorePart(loserScore, false));
}

function appendWhen(line: HTMLElement, iso: string) {
  const when = document.createElement('span');
  const r = fmtRelative(iso);
  when.className = 'l42-when' + (r.late ? ' l42-late' : '');
  when.textContent = r.text;
  line.append(when);
}

function renderChallengeLine(ch: Challenge): HTMLElement {
  const iAmOpponent = ch.opponentLogin === myLogin;
  const opponent = iAmOpponent ? ch.challengerLogin : ch.opponentLogin;
  const labelText =
    ch.status === 'pending'
      ? iAmOpponent
        ? 'Défi reçu de'
        : 'Défi envoyé à'
      : 'Match planifié vs';
  const badge =
    ch.status === 'pending'
      ? { label: 'À ACCEPTER', cls: 'l42-bg-pending' }
      : { label: 'ACCEPTÉ · À JOUER', cls: 'l42-bg-accepted' };
  const line = makeBaseLine({ emoji: '⚔️', text: labelText, opponent, badge });

  appendWhen(line, ch.scheduledAt);

  const actions = document.createElement('span');
  actions.className = 'l42-actions';

  if (ch.status === 'pending' && iAmOpponent) {
    actions.append(
      makeButton({
        cls: 'l42-ok',
        title: 'Accepter ce défi',
        icon: 'fa-check',
        disabled: busy.has(ch.id),
        onClick: () => acceptChallenge(ch),
      }),
      makeButton({
        cls: 'l42-no',
        title: 'Refuser ce défi',
        icon: 'fa-times',
        disabled: busy.has(ch.id),
        onClick: () => declineChallenge(ch),
      }),
    );
  } else if (ch.status === 'pending') {
    const wait = document.createElement('span');
    wait.className = 'l42-wait';
    wait.textContent = 'en attente';
    actions.append(
      wait,
      makeButton({
        cls: 'l42-no',
        title: 'Annuler ce défi',
        icon: 'fa-times',
        disabled: busy.has(ch.id),
        onClick: () => declineChallenge(ch),
      }),
    );
  } else if (ch.status === 'accepted') {
    if (recordingFor.has(ch.id)) {
      line.append(buildRecordForm(ch));
      return line;
    }
    actions.append(
      (() => {
        const btn = document.createElement('button');
        btn.className = 'l42-cta';
        btn.textContent = 'Saisir le score';
        btn.disabled = busy.has(ch.id);
        btn.onclick = () => {
          recordingFor.add(ch.id);
          paint();
        };
        return btn;
      })(),
      makeButton({
        cls: 'l42-no',
        title: 'Annuler ce match',
        icon: 'fa-times',
        disabled: busy.has(ch.id),
        onClick: () => declineChallenge(ch),
      }),
    );
  }
  line.append(actions);
  return line;
}

function buildRecordForm(ch: Challenge): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'l42-record';
  const iAmOpponent = ch.opponentLogin === myLogin;
  const oppLogin = iAmOpponent ? ch.challengerLogin : ch.opponentLogin;

  const me = document.createElement('input');
  me.type = 'number';
  me.min = '0';
  me.max = '10';
  me.placeholder = 'Ton score';
  const dash = document.createElement('span');
  dash.className = 'l42-mini';
  dash.textContent = '–';
  const opp = document.createElement('input');
  opp.type = 'number';
  opp.min = '0';
  opp.max = '10';
  opp.placeholder = `Score ${oppLogin}`;

  const send = document.createElement('button');
  send.className = 'l42-cta';
  send.textContent = 'Envoyer';
  send.disabled = busy.has(ch.id);
  send.onclick = async () => {
    const a = Number(me.value);
    const b = Number(opp.value);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;
    await recordResult(ch, a, b);
  };

  const cancel = document.createElement('button');
  cancel.className = 'l42-btn l42-no';
  cancel.title = 'Annuler la saisie';
  const ci = document.createElement('i');
  ci.className = 'fal fa-times';
  cancel.appendChild(ci);
  cancel.onclick = () => {
    recordingFor.delete(ch.id);
    paint();
  };

  wrap.append(me, dash, opp, send, cancel);
  return wrap;
}

function renderPendingLine(p: PendingMatch): HTMLElement {
  const youConfirm = p.opponentLogin === myLogin;
  const opponentLogin = youConfirm ? p.declarerLogin : p.opponentLogin;

  const line = makeBaseLine({
    emoji: '⚔️',
    text: youConfirm
      ? `Score à confirmer (déclaré par ${opponentLogin})`
      : 'Score envoyé, en attente de',
    opponent: opponentLogin,
    badge: { label: 'SCORE À CONFIRMER', cls: 'l42-bg-confirm' },
  });

  if (!youConfirm) {
    const winnerScore = Math.max(p.scoreDeclarer, p.scoreOpponent);
    const loserScore = Math.min(p.scoreDeclarer, p.scoreOpponent);
    appendScores(line, winnerScore, loserScore);
    const wait = document.createElement('span');
    wait.className = 'l42-wait';
    wait.style.cssText = 'margin-left: auto;';
    wait.textContent = 'en attente adversaire';
    line.append(wait);
    line.dataset.id = p.id;
    return line;
  }

  const draft =
    draftConfirmScores.get(p.id) ??
    (() => {
      const d = { mine: String(p.scoreOpponent), opp: String(p.scoreDeclarer) };
      draftConfirmScores.set(p.id, d);
      return d;
    })();

  const form = document.createElement('span');
  form.className = 'l42-record';

  const me = document.createElement('input');
  me.type = 'number';
  me.min = '0';
  me.max = '10';
  me.placeholder = 'Ton score';
  me.value = draft.mine;
  me.oninput = () => {
    draft.mine = me.value;
  };

  const dash = document.createElement('span');
  dash.className = 'l42-mini';
  dash.textContent = '–';

  const opp = document.createElement('input');
  opp.type = 'number';
  opp.min = '0';
  opp.max = '10';
  opp.placeholder = `Score ${opponentLogin}`;
  opp.value = draft.opp;
  opp.oninput = () => {
    draft.opp = opp.value;
  };

  const ok = document.createElement('button');
  ok.className = 'l42-cta';
  ok.textContent = 'Valider';
  ok.disabled = busy.has(p.id);
  ok.onclick = () => confirmMatch(p, Number(draft.mine), Number(draft.opp));

  const no = document.createElement('button');
  no.className = 'l42-btn l42-no';
  no.title = 'Refuser ce score';
  no.disabled = busy.has(p.id);
  no.onclick = () => rejectMatch(p);
  const ni = document.createElement('i');
  ni.className = 'fal fa-times';
  no.appendChild(ni);

  form.append(me, dash, opp, ok, no);
  line.append(form);
  line.dataset.id = p.id;
  return line;
}

function paint() {
  styleOnce();
  const block = ensureBlock();
  if (!block) return;
  block.innerHTML = '';
  for (const ch of challenges) block.appendChild(renderChallengeLine(ch));
  for (const p of pending) block.appendChild(renderPendingLine(p));
}

async function confirmMatch(p: PendingMatch, scoreSelf: number, scoreOpponent: number) {
  if (!Number.isFinite(scoreSelf) || !Number.isFinite(scoreOpponent)) {
    showToast('Score invalide');
    return;
  }
  busy.add(p.id);
  paint();
  try {
    await api.confirmMatch(p.id, scoreSelf, scoreOpponent);
    draftConfirmScores.delete(p.id);
    showToast('Match validé', 'ok');
  } catch (err) {
    if (isContextInvalidated(err)) return shutdown();
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('409') || msg.toLowerCase().includes('différents')) {
      draftConfirmScores.delete(p.id);
      showToast('Scores différents · match annulé, à redéclarer');
    } else {
      console.warn('[42 League] confirm failed', err);
      showToast('Erreur de validation');
    }
  } finally {
    busy.delete(p.id);
    refresh();
  }
}

async function rejectMatch(p: PendingMatch) {
  const opp = p.declarerLogin === myLogin ? p.opponentLogin : p.declarerLogin;
  const ok = await confirmDialog({
    title: 'Refuser ce score ?',
    message: `Tu refuses le score déclaré par ${opp} (${p.scoreDeclarer}–${p.scoreOpponent}). Le match ne comptera pas et devra être re-déclaré.`,
    confirmLabel: 'Refuser le score',
    cancelLabel: 'Garder',
    danger: true,
  });
  if (!ok) return;
  busy.add(p.id);
  paint();
  try {
    await api.rejectMatch(p.id);
  } catch (err) {
    if (isContextInvalidated(err)) return shutdown();
    console.warn('[42 League] reject failed', err);
  } finally {
    busy.delete(p.id);
    refresh();
  }
}

async function acceptChallenge(ch: Challenge) {
  busy.add(ch.id);
  paint();
  try {
    await api.acceptChallenge(ch.id);
  } catch (err) {
    if (isContextInvalidated(err)) return shutdown();
    console.warn('[42 League] accept failed', err);
  } finally {
    busy.delete(ch.id);
    refresh();
  }
}

async function declineChallenge(ch: Challenge) {
  const iAmChallenger = ch.challengerLogin === myLogin;
  const opp = iAmChallenger ? ch.opponentLogin : ch.challengerLogin;
  const wasAccepted = ch.status === 'accepted';
  const ok = await confirmDialog({
    title: wasAccepted ? 'Fuir ce match ?' : iAmChallenger ? 'Annuler ce défi ?' : 'Refuser ce défi ?',
    message: wasAccepted
      ? `Le match contre ${opp} était accepté par les deux. Si tu annules maintenant, c'est considéré comme une fuite.`
      : iAmChallenger
        ? `Annuler ton défi envoyé à ${opp} ?`
        : `Refuser le défi de ${opp} ?`,
    warning: wasAccepted
      ? '⚠ Pénalité : -10 ELO + 1 fuite marquée sur ton profil.'
      : undefined,
    confirmLabel: wasAccepted ? 'Confirmer la fuite' : iAmChallenger ? 'Annuler' : 'Refuser',
    cancelLabel: 'Garder',
    danger: true,
  });
  if (!ok) return;
  busy.add(ch.id);
  paint();
  try {
    await api.declineChallenge(ch.id);
  } catch (err) {
    if (isContextInvalidated(err)) return shutdown();
    console.warn('[42 League] decline failed', err);
  } finally {
    busy.delete(ch.id);
    refresh();
  }
}

async function recordResult(ch: Challenge, scoreSelf: number, scoreOpponent: number) {
  busy.add(ch.id);
  paint();
  try {
    await api.recordChallengeResult(ch.id, scoreSelf, scoreOpponent);
    recordingFor.delete(ch.id);
  } catch (err) {
    if (isContextInvalidated(err)) return shutdown();
    console.warn('[42 League] record failed', err);
  } finally {
    busy.delete(ch.id);
    refresh();
  }
}

async function refresh() {
  try {
    const [me, chs, list, played, lb] = await Promise.all([
      api.me(),
      api.challenges(),
      api.pendingMatches(),
      api.playedMatches(),
      api.leaderboard(),
    ]);
    myLogin = me.login;
    challenges = chs;
    pending = list.filter(
      (p) => p.opponentLogin === myLogin || p.declarerLogin === myLogin,
    );
    allPlayed = played;
    leaderboard = lb;
    const ops = await api.opsList().catch(() => []);
    setTooltipData(leaderboard, allPlayed, ops);
    paint();
  } catch (err) {
    if (isContextInvalidated(err)) return shutdown();
    if (err instanceof AuthError) {
      challenges = [];
      pending = [];
      allPlayed = [];
      leaderboard = [];
      document.getElementById(BLOCK_ID)?.remove();
      return;
    }
    console.warn('[42 League] refresh failed', err);
  }
}

// ==========================================
// CODE INJECTION LOGO BABY INTRA
// ==========================================


function startLogoInjector() {
  const WRAP_ID = 'league-42-sidebar-wrap';
  const LINK_ID = 'league-42-sidebar-link';
  const STYLE_ID = 'league-42-sidebar-style';

  setInterval(() => {
    // 1. Si on l'a déjà injecté, on s'arrête
    if (document.getElementById(WRAP_ID)) return;

    // 2. On cherche la barre latérale
    const sidebar = document.querySelector('.main-left-navbar');
    if (!sidebar) return; 

    // 3. On cherche la liste des menus
    const listContainer = sidebar.querySelector('.main-left-menu') || sidebar.querySelector('ul');
    const container = listContainer || sidebar;

    const defaultIconUrl = chrome.runtime.getURL('icons/baby-raccourci-logo-intra.png');
    const hoverIconUrl = chrome.runtime.getURL('icons/baby-raccourci-logo-intra-hover.png');

    // 4. Style pour le centrage et la taille
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        #${WRAP_ID} {
          display: block;
          width: 100%;
          text-align: center;
          padding: 0;
        }
        #${LINK_ID} {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 55px; 
          width: 100%;
          cursor: pointer;
          text-decoration: none;
          transition: background-color 0.2s;
        }
        #${LINK_ID}:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }
        #league-42-icon {
          width: 34px; 
          height: 34px;
          margin: 0 auto; 
          background-image: url('${defaultIconUrl}');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          transition: transform 0.1s ease, background-image 0.1s ease;
        }
        #${LINK_ID}:hover #league-42-icon {
          background-image: url('${hoverIconUrl}');
          transform: scale(1.1); 
        }
      `;
      document.head.appendChild(style);
    }

    // 5. Création des balises
    const a = document.createElement('a');
    a.id = LINK_ID;
    a.href = 'http://localhost:5173'; // ⚠️ Remplacer par ton URL
    a.target = '_blank';
    a.rel = 'noreferrer noopener';
    a.title = 'Aller sur 42 League';

    const iconDiv = document.createElement('div');
    iconDiv.id = 'league-42-icon';
    a.appendChild(iconDiv);

    // 6. L'ASTUCE EST ICI 👇
    if (listContainer) {
      const li = document.createElement('li');
      li.id = WRAP_ID;
      li.appendChild(a);
      
      // On insère notre logo en 3ème position (index 2)
      // Ça le mettra en haut, juste avec les logos principaux !
      if (listContainer.children.length >= 2) {
        listContainer.insertBefore(li, listContainer.children[2]);
      } else {
        listContainer.appendChild(li);
      }
    } else {
      a.id = WRAP_ID;
      container.appendChild(a);
    }

  }, 1000);
}

// ==========================================
// BOOTSTRAP DE L'EXTENSION
// ==========================================
async function bootstrap() {
  // Lancement du logo !
  startLogoInjector();

  const observer = new MutationObserver(() => {
    const block = document.getElementById(BLOCK_ID);
    if (!block || !block.isConnected) paint();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const status = await authBridge.status().catch(() => ({
    authenticated: false,
    login: null as string | null,
  }));
  
  if (!status.authenticated) return;

  await refresh();
  pollTimer = setInterval(refresh, REFRESH_MS);
}

bootstrap().catch((err) => console.error('[42 League] bootstrap failed', err));