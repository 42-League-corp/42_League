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
const NOTIF_ID = 'league-42-notif-banner';
const NOTIF_STYLE_ID = 'league-42-notif-style';
const REFRESH_MS = 30_000;

const ANCHOR_KEYWORDS = ['évaluations', 'evaluations'];

const WEB_APP_URL =
  (import.meta.env.VITE_WEB_APP_URL as string | undefined)?.replace(/\/$/, '') ??
  'https://oneleague.fr';

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
  document.getElementById(NOTIF_ID)?.remove();
  document.getElementById(NOTIF_STYLE_ID)?.remove();
}

// ─── Notification banner ──────────────────────────────────────────────────────

function notifStyleOnce() {
  if (document.getElementById(NOTIF_STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = NOTIF_STYLE_ID;
  s.textContent = `
    @keyframes l42nb-in {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes l42nb-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255, 183, 27, 0.4); }
      50%       { box-shadow: 0 0 0 6px rgba(255, 183, 27, 0); }
    }
    #${NOTIF_ID} {
      position: fixed;
      top: 16px; right: 16px;
      z-index: 2147483646;
      width: 320px;
      background: #0b0f17;
      border: 1px solid rgba(255, 183, 27, 0.5);
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(255,183,27,0.15);
      font-family: 'Inter', system-ui, sans-serif;
      animation: l42nb-in 220ms ease-out, l42nb-pulse 2s ease-in-out 500ms 3;
      overflow: hidden;
    }
    #${NOTIF_ID} .l42nb-header {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px 8px;
      border-bottom: 1px solid rgba(255,183,27,0.2);
    }
    #${NOTIF_ID} .l42nb-icon { font-size: 14px; }
    #${NOTIF_ID} .l42nb-title {
      flex: 1;
      font-size: 10px; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.15em;
      color: #ffb71b;
    }
    #${NOTIF_ID} .l42nb-close {
      background: none; border: none; cursor: pointer;
      color: #6b7689; font-size: 16px; line-height: 1;
      width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 3px;
      transition: color 120ms, background 120ms;
    }
    #${NOTIF_ID} .l42nb-close:hover { color: #e6ecf5; background: rgba(255,255,255,0.08); }
    #${NOTIF_ID} .l42nb-match {
      padding: 10px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    #${NOTIF_ID} .l42nb-match:last-child { border-bottom: none; }
    #${NOTIF_ID} .l42nb-meta {
      display: flex; align-items: center; gap: 6px;
      margin-bottom: 8px;
      font-size: 12px; color: #95a3b8;
    }
    #${NOTIF_ID} .l42nb-declarer {
      color: #ffb71b; font-weight: 700;
    }
    #${NOTIF_ID} .l42nb-score {
      font-weight: 800; font-variant-numeric: tabular-nums;
      font-size: 18px; color: #ffffff;
      letter-spacing: 0.05em;
    }
    #${NOTIF_ID} .l42nb-score-sep { color: #6b7689; margin: 0 4px; font-size: 16px; }
    #${NOTIF_ID} .l42nb-hint {
      font-size: 10px; color: #6b7689;
    }
    #${NOTIF_ID} .l42nb-actions {
      display: flex; gap: 6px; margin-top: 8px;
    }
    #${NOTIF_ID} .l42nb-btn-confirm {
      flex: 1; padding: 7px 12px;
      background: linear-gradient(180deg, #00d9dc, #00babc);
      color: #001416; font-weight: 800;
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
      border: none; border-radius: 5px; cursor: pointer;
      transition: filter 120ms, transform 80ms;
    }
    #${NOTIF_ID} .l42nb-btn-confirm:hover { filter: brightness(1.1); }
    #${NOTIF_ID} .l42nb-btn-confirm:active { transform: scale(0.97); }
    #${NOTIF_ID} .l42nb-btn-confirm:disabled { opacity: 0.4; cursor: default; }
    #${NOTIF_ID} .l42nb-btn-contest {
      padding: 7px 12px;
      background: transparent;
      color: #95a3b8; font-weight: 700;
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
      border: 1px solid #243044; border-radius: 5px; cursor: pointer;
      transition: color 120ms, border-color 120ms, background 120ms;
    }
    #${NOTIF_ID} .l42nb-btn-contest:hover {
      color: #ff3b5c; border-color: rgba(255,59,92,0.5);
      background: rgba(255,59,92,0.06);
    }
    #${NOTIF_ID} .l42nb-btn-contest:disabled { opacity: 0.4; cursor: default; }
  `;
  document.head.appendChild(s);
}

function paintNotifBanner() {
  const toConfirm = pending.filter((p) => p.opponentLogin === myLogin);

  // Remove banner if nothing to confirm
  if (toConfirm.length === 0) {
    document.getElementById(NOTIF_ID)?.remove();
    return;
  }

  notifStyleOnce();

  // Remove existing and rebuild
  document.getElementById(NOTIF_ID)?.remove();
  const banner = document.createElement('div');
  banner.id = NOTIF_ID;

  // Header
  const header = document.createElement('div');
  header.className = 'l42nb-header';
  const icon = document.createElement('span');
  icon.className = 'l42nb-icon';
  icon.textContent = '⚡';
  const title = document.createElement('span');
  title.className = 'l42nb-title';
  title.textContent = `${toConfirm.length} game${toConfirm.length > 1 ? 's' : ''} à confirmer`;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'l42nb-close';
  closeBtn.textContent = '×';
  closeBtn.title = 'Fermer (réapparaît au prochain refresh)';
  closeBtn.onclick = () => banner.remove();
  header.append(icon, title, closeBtn);
  banner.append(header);

  // One row per match
  for (const p of toConfirm) {
    const row = document.createElement('div');
    row.className = 'l42nb-match';

    const meta = document.createElement('div');
    meta.className = 'l42nb-meta';
    const decl = document.createElement('span');
    decl.className = 'l42nb-declarer';
    decl.textContent = p.declarerLogin;
    meta.append(decl, document.createTextNode(' a déclaré :'));

    const scoreWrap = document.createElement('div');
    scoreWrap.style.cssText = 'display:flex;align-items:baseline;gap:0;margin:2px 0;';
    const scoreEl = document.createElement('span');
    scoreEl.className = 'l42nb-score';
    const sep = document.createElement('span');
    sep.className = 'l42nb-score-sep';
    sep.textContent = '–';
    const s1 = document.createElement('span');
    s1.textContent = String(p.scoreDeclarer);
    const s2 = document.createElement('span');
    s2.textContent = String(p.scoreOpponent);
    scoreEl.append(s1, sep, s2);
    const hint = document.createElement('span');
    hint.className = 'l42nb-hint';
    hint.textContent = '(eux – toi)';
    scoreWrap.append(scoreEl, hint);
    scoreWrap.style.cssText = 'display:flex;align-items:baseline;gap:8px;margin:4px 0;';

    const actions = document.createElement('div');
    actions.className = 'l42nb-actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'l42nb-btn-confirm';
    confirmBtn.textContent = '✓ Confirmer';
    confirmBtn.disabled = busy.has(p.id);
    confirmBtn.onclick = async () => {
      // Direct confirm with same scores as declared (fastest flow)
      confirmBtn.disabled = true;
      contestBtn.disabled = true;
      busy.add(p.id);
      try {
        // Confirm with same scores that were declared (opponent=self, declarer=opp)
        await api.confirmMatch(p.id, p.scoreOpponent, p.scoreDeclarer);
        showToast('Match confirmé ✓', 'ok');
        draftConfirmScores.delete(p.id);
      } catch (err) {
        if (isContextInvalidated(err)) return shutdown();
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('409') || msg.toLowerCase().includes('différents')) {
          draftConfirmScores.delete(p.id);
          showToast('Scores différents · match annulé, à redéclarer');
        } else {
          showToast('Erreur de validation');
        }
      } finally {
        busy.delete(p.id);
        refresh();
      }
    };

    const contestBtn = document.createElement('button');
    contestBtn.className = 'l42nb-btn-contest';
    contestBtn.textContent = 'Contester';
    contestBtn.disabled = busy.has(p.id);
    contestBtn.onclick = () => contestMatchDialog(p);

    actions.append(confirmBtn, contestBtn);
    row.append(meta, scoreWrap, actions);
    banner.append(row);
  }

  document.body.append(banner);
}

// ─── Contest dialog for extension ────────────────────────────────────────────

const CONTEST_HOST_ID = 'league-42-contest-host';
const CONTEST_STYLE_ID = 'league-42-contest-style';

function ensureContestStyle() {
  if (document.getElementById(CONTEST_STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = CONTEST_STYLE_ID;
  s.textContent = `
    @keyframes l42ct-in  { from { opacity: 0 } to { opacity: 1 } }
    @keyframes l42ct-pop { from { transform: scale(0.92); opacity: 0 } to { transform: scale(1); opacity: 1 } }
    #${CONTEST_HOST_ID} {
      position: fixed; inset: 0;
      z-index: 2147483647;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.65);
      backdrop-filter: blur(6px);
      animation: l42ct-in 150ms ease-out;
      font-family: 'Inter', system-ui, sans-serif;
      padding: 16px;
    }
    #${CONTEST_HOST_ID} .l42ct-card {
      background: #0b0f17;
      border: 1px solid rgba(255,59,92,0.35);
      border-radius: 10px;
      padding: 20px 20px 18px;
      width: 400px; max-width: calc(100vw - 32px);
      box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(255,59,92,0.1);
      animation: l42ct-pop 180ms ease-out;
    }
    #${CONTEST_HOST_ID} .l42ct-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 14px;
    }
    #${CONTEST_HOST_ID} .l42ct-title {
      font-size: 10px; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.18em;
      color: #ff3b5c; margin-bottom: 3px;
    }
    #${CONTEST_HOST_ID} .l42ct-sub {
      font-size: 11px; color: #6b7689;
    }
    #${CONTEST_HOST_ID} .l42ct-close {
      background: none; border: none; cursor: pointer;
      color: #6b7689; font-size: 18px; line-height: 1;
      width: 24px; height: 24px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 4px; transition: color 120ms, background 120ms;
    }
    #${CONTEST_HOST_ID} .l42ct-close:hover { color: #e6ecf5; background: rgba(255,255,255,0.08); }
    #${CONTEST_HOST_ID} .l42ct-warn {
      background: rgba(255,59,92,0.07);
      border: 1px solid rgba(255,59,92,0.25);
      color: #ff8095; border-radius: 6px;
      padding: 8px 10px; font-size: 11px; line-height: 1.4;
      margin-bottom: 14px;
    }
    #${CONTEST_HOST_ID} .l42ct-label {
      font-size: 9px; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.12em;
      color: #6b7689; margin-bottom: 6px;
    }
    #${CONTEST_HOST_ID} .l42ct-reasons {
      display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
      margin-bottom: 12px;
    }
    #${CONTEST_HOST_ID} .l42ct-reason {
      padding: 10px 10px 8px;
      background: #111827; border: 1px solid #243044;
      border-radius: 6px; cursor: pointer; text-align: left;
      transition: border-color 120ms, background 120ms;
    }
    #${CONTEST_HOST_ID} .l42ct-reason:hover { border-color: rgba(255,59,92,0.4); background: rgba(255,59,92,0.04); }
    #${CONTEST_HOST_ID} .l42ct-reason.l42ct-selected {
      border-color: rgba(255,59,92,0.6); background: rgba(255,59,92,0.08);
    }
    #${CONTEST_HOST_ID} .l42ct-reason-icon { font-size: 16px; margin-bottom: 4px; display: block; }
    #${CONTEST_HOST_ID} .l42ct-reason-text {
      font-size: 11px; font-weight: 600; color: #e6ecf5; line-height: 1.3;
    }
    #${CONTEST_HOST_ID} .l42ct-textarea {
      width: 100%; box-sizing: border-box;
      padding: 9px 10px;
      background: #0b0f17; border: 1px solid #243044;
      border-radius: 6px; resize: none;
      font-family: inherit; font-size: 12px; color: #e6ecf5;
      line-height: 1.5; outline: none;
      transition: border-color 120ms;
    }
    #${CONTEST_HOST_ID} .l42ct-textarea:focus { border-color: rgba(255,59,92,0.5); }
    #${CONTEST_HOST_ID} .l42ct-counter {
      text-align: right; font-size: 10px; color: #6b7689;
      margin-top: 4px; margin-bottom: 14px;
    }
    #${CONTEST_HOST_ID} .l42ct-actions {
      display: flex; gap: 8px; justify-content: flex-end;
    }
    #${CONTEST_HOST_ID} .l42ct-cancel {
      padding: 8px 16px;
      background: transparent; border: 1px solid #243044;
      color: #95a3b8; border-radius: 5px; cursor: pointer;
      font-family: inherit; font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em;
      transition: color 120ms, border-color 120ms;
    }
    #${CONTEST_HOST_ID} .l42ct-cancel:hover { color: #fff; border-color: #6b7689; }
    #${CONTEST_HOST_ID} .l42ct-submit {
      padding: 8px 18px;
      background: linear-gradient(180deg, #ff3b5c, #c8203f);
      color: #fff; border: none; border-radius: 5px; cursor: pointer;
      font-family: inherit; font-size: 11px; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.08em;
      transition: filter 120ms, box-shadow 120ms;
    }
    #${CONTEST_HOST_ID} .l42ct-submit:hover:not(:disabled) {
      filter: brightness(1.1);
      box-shadow: 0 0 14px rgba(255,59,92,0.5);
    }
    #${CONTEST_HOST_ID} .l42ct-submit:disabled { opacity: 0.35; cursor: default; }
  `;
  document.head.appendChild(s);
}

function contestMatchDialog(p: PendingMatch): void {
  ensureContestStyle();
  document.getElementById(CONTEST_HOST_ID)?.remove();

  let selectedReason: 'never_played' | 'wrong_score' | null = null;

  const host = document.createElement('div');
  host.id = CONTEST_HOST_ID;

  const card = document.createElement('div');
  card.className = 'l42ct-card';

  // Header
  const header = document.createElement('div');
  header.className = 'l42ct-header';
  const titleWrap = document.createElement('div');
  const titleEl = document.createElement('div');
  titleEl.className = 'l42ct-title';
  titleEl.textContent = 'Contester ce score';
  const subEl = document.createElement('div');
  subEl.className = 'l42ct-sub';
  subEl.innerHTML = `<strong style="color:#e6ecf5">${p.declarerLogin}</strong> a déclaré <strong style="color:#e6ecf5">${p.scoreDeclarer}–${p.scoreOpponent}</strong>`;
  titleWrap.append(titleEl, subEl);
  const closeX = document.createElement('button');
  closeX.className = 'l42ct-close';
  closeX.textContent = '×';
  closeX.onclick = () => host.remove();
  header.append(titleWrap, closeX);

  // Warning
  const warn = document.createElement('div');
  warn.className = 'l42ct-warn';
  warn.innerHTML = '⚠ Ce système est basé sur la <strong>confiance</strong>. Une contestation injustifiée nuit à la communauté.';

  // Reason
  const reasonLabel = document.createElement('div');
  reasonLabel.className = 'l42ct-label';
  reasonLabel.textContent = 'Motif';
  const reasons = document.createElement('div');
  reasons.className = 'l42ct-reasons';

  const makeReason = (value: 'never_played' | 'wrong_score', icon: string, text: string) => {
    const btn = document.createElement('button');
    btn.className = 'l42ct-reason';
    btn.dataset.value = value;
    const iconEl = document.createElement('span');
    iconEl.className = 'l42ct-reason-icon';
    iconEl.textContent = icon;
    const textEl = document.createElement('span');
    textEl.className = 'l42ct-reason-text';
    textEl.textContent = text;
    btn.append(iconEl, textEl);
    btn.onclick = () => {
      reasons.querySelectorAll('.l42ct-reason').forEach((el) => el.classList.remove('l42ct-selected'));
      btn.classList.add('l42ct-selected');
      selectedReason = value;
      updateSubmit();
    };
    return btn;
  };
  reasons.append(
    makeReason('never_played', '🚫', "La game n'a jamais eu lieu"),
    makeReason('wrong_score', '❌', 'Le score est incorrect'),
  );

  // Message
  const msgLabel = document.createElement('div');
  msgLabel.className = 'l42ct-label';
  msgLabel.textContent = 'Explique-toi *';
  const textarea = document.createElement('textarea');
  textarea.className = 'l42ct-textarea';
  textarea.rows = 3;
  textarea.placeholder = 'Décris ce qui s\'est passé (min. 10 caractères)…';
  const counter = document.createElement('div');
  counter.className = 'l42ct-counter';
  counter.textContent = '0 / 500';
  textarea.oninput = () => {
    if (textarea.value.length > 500) textarea.value = textarea.value.slice(0, 500);
    counter.textContent = `${textarea.value.length} / 500`;
    updateSubmit();
  };

  // Actions
  const actions = document.createElement('div');
  actions.className = 'l42ct-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'l42ct-cancel';
  cancelBtn.textContent = 'Annuler';
  cancelBtn.onclick = () => host.remove();
  const submitBtn = document.createElement('button');
  submitBtn.className = 'l42ct-submit';
  submitBtn.textContent = 'Envoyer la contestation';
  submitBtn.disabled = true;
  actions.append(cancelBtn, submitBtn);

  const updateSubmit = () => {
    submitBtn.disabled = !selectedReason || textarea.value.trim().length < 10;
  };

  submitBtn.onclick = async () => {
    if (!selectedReason || textarea.value.trim().length < 10) return;
    submitBtn.disabled = true;
    cancelBtn.disabled = true;
    busy.add(p.id);
    try {
      await api.rejectMatch(p.id, selectedReason, textarea.value.trim());
      host.remove();
      showToast('Contestation envoyée', 'ok');
    } catch (err) {
      if (isContextInvalidated(err)) return shutdown();
      showToast('Erreur lors de la contestation');
    } finally {
      busy.delete(p.id);
      refresh();
    }
  };

  host.onclick = (e) => { if (e.target === host) host.remove(); };
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { host.remove(); document.removeEventListener('keydown', onKey); }
  });

  card.append(header, warn, reasonLabel, reasons, msgLabel, textarea, counter, actions);
  host.append(card);
  document.body.append(host);
  setTimeout(() => textarea.focus(), 50);
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
  paintNotifBanner();
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
  // Open the full contest dialog instead of simple confirm
  contestMatchDialog(p);
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
          margin: 0;
        }
        #${LINK_ID} {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 50px; /* Adapté à la taille native des boutons de l'intra */
          width: 100%;
          cursor: pointer;
          text-decoration: none;
          transition: background-color 0.2s;
        }
        #${LINK_ID}:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }
        #league-42-icon {
          width: 28px; /* Ajusté pour s'aligner parfaitement avec les icônes de l'intra */
          height: 28px;
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
    a.href = WEB_APP_URL;
    a.target = '_blank';
    a.rel = 'noreferrer noopener';
    a.title = 'Aller sur 42 League';

    const iconDiv = document.createElement('div');
    iconDiv.id = 'league-42-icon';
    a.appendChild(iconDiv);

    const li = document.createElement('li');
    li.id = WRAP_ID;
    li.appendChild(a);

    // 6. Injection juste en dessous du Shop / Cadis
    // On repère le lien du shop via son attribut href qui contient "/shop"
    const shopLink = document.querySelector('a[href*="/shop"]');
    const shopLi = shopLink?.closest('li');

    if (shopLi && shopLi.parentNode) {
      // En Javascript natif, il n'y a pas de "insertAfter".
      // On insert donc "avant le petit frère" (nextSibling) du logo shop.
      shopLi.parentNode.insertBefore(li, shopLi.nextSibling);
    } else if (listContainer) {
      // Fallback si le Shop n'est pas trouvé (ça peut arriver si un jour l'intra change)
      // On l'ajoute à la fin de la liste
      listContainer.appendChild(li);
    } else {
      container.appendChild(li);
    }

  }, 1000);
}

// ==========================================
// INJECTION STATS USER (ELO + Rang + W/L) dans .user-infos-sub
// ==========================================
function startUserStatsInjector() {
  const MARKER_CLASS = 'league-42-user-stat';
  const STYLE_ID = 'league-42-user-stats-style';

  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      /* ── Aligner et uniformiser le padding de TOUTES les stats natives ── */
      .user-infos-sub .user-inline-stat:not(.hidden) {
        padding-top: 3px !important;
        padding-bottom: 3px !important;
        padding-left: 16px !important;
        padding-right: 16px !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        box-sizing: border-box !important;
      }
      /* ── Ajuster la hauteur du bloc pour s'aligner avec le bas du bloc level ── */
      .user-infos-sub {
        padding-bottom: 6px !important;
      }
      /* ── Nos stats injectées — même taille/padding que les natives ── */
      .${MARKER_CLASS} {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        width: 100% !important;
        padding: 3px 16px !important;
        margin: 0 !important;
        color: inherit !important;
        text-decoration: none !important;
        font-size: 13px !important;
        line-height: 1.4 !important;
        cursor: pointer;
        transition: background-color 120ms;
        box-sizing: border-box;
      }
      .${MARKER_CLASS}:hover { background-color: rgba(255, 255, 255, 0.045); }
      .${MARKER_CLASS}:first-of-type {
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        margin-top: 3px !important;
        padding-top: 4px !important;
      }
      .${MARKER_CLASS} .l42-label {
        opacity: 0.82;
        font-weight: 400;
      }
      .${MARKER_CLASS} .l42-icon { opacity: 0.7; margin-right: 5px; font-size: 12px; }
      .${MARKER_CLASS} .l42-value {
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .${MARKER_CLASS}[data-l42-stat="elo"]  .l42-value { color: #00d9dc; }
      .${MARKER_CLASS}[data-l42-stat="rank"] .l42-value { color: #ffb71b; }
      .${MARKER_CLASS} .l42-w { color: #ffb71b; }
      .${MARKER_CLASS} .l42-l { color: #ff3b5c; margin-left: 3px; }
      .${MARKER_CLASS} .l42-sep { opacity: 0.5; margin: 0 3px; font-weight: 400; }
    `;
    document.head.appendChild(s);
  }

  setInterval(() => {
    const container = document.querySelector('.user-infos-sub');
    if (!container) return;
    if (!myLogin) return;

    // On a profile page (/users/<login>), show that user's stats, not ours
    const profileMatch = location.pathname.match(/^\/users\/([a-z0-9_-]+)(?:\/|$)/i);
    const targetLogin = profileMatch?.[1]?.toLowerCase() ?? myLogin;

    const target = leaderboard.find((u) => u.login === targetLogin);
    if (!target) return;

    const targetMatches = allPlayed.filter(
      (m) => m.playerALogin === targetLogin || m.playerBLogin === targetLogin,
    );
    const wins = targetMatches.filter((m) => {
      const isA = m.playerALogin === targetLogin;
      return (isA && m.winner === 'A') || (!isA && m.winner === 'B');
    }).length;
    const losses = targetMatches.length - wins;

    const dataKey = `${target.elo}|${target.rank}|${wins}|${losses}`;
    const existing = container.querySelector<HTMLElement>(`.${MARKER_CLASS}`);
    if (existing && existing.dataset.dataKey === dataKey) return;
    container.querySelectorAll(`.${MARKER_CLASS}`).forEach((n) => n.remove());

    const href = `${WEB_APP_URL}/joueur/${encodeURIComponent(targetLogin)}`;
    const isOtherProfile = targetLogin !== myLogin;

    const mkStat = (
      kind: 'elo' | 'rank' | 'record',
      label: string,
      valueHtml: string,
      isFirst = false,
    ): HTMLAnchorElement => {
      const a = document.createElement('a');
      a.className = MARKER_CLASS;
      a.dataset.l42Stat = kind;
      a.href = href;
      a.target = '_blank';
      a.rel = 'noreferrer noopener';
      a.title = isOtherProfile
        ? `42 League — voir la fiche de ${targetLogin}`
        : '42 League — voir ma fiche';
      if (isFirst) a.dataset.dataKey = dataKey;
      a.innerHTML =
        `<span class="l42-label">${label}</span>` +
        `<span class="l42-value">${valueHtml}</span>`;
      return a;
    };

    container.append(
      mkStat('elo', '<span class="l42-icon">⚔</span>42 League', String(target.elo), true),
      mkStat('rank', 'Rang', `#${target.rank}`),
      mkStat(
        'record',
        'Bilan',
        `<span class="l42-w">${wins}</span>W<span class="l42-sep">·</span><span class="l42-l">${losses}</span>L`,
      ),
    );
  }, 1000);
}

// ==========================================
// BOOTSTRAP DE L'EXTENSION
// ==========================================
async function bootstrap() {
  // Lancement du logo !
  startLogoInjector();
  startUserStatsInjector();

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