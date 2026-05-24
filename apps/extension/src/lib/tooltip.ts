import type { LeaderboardEntry, Ops, PlayedMatch } from './api.js';

const TOOLTIP_ID = 'league-42-hover-tooltip';
const STYLE_ID = 'league-42-tooltip-style';

export interface PlayerStats {
  login: string;
  imageUrl: string | null;
  title: string | null;
  elo: number;
  rank: number | null;
  wins: number;
  losses: number;
  trophies: number;
  dodges: number;
}

let leaderboardRef: LeaderboardEntry[] = [];
let matchesRef: PlayedMatch[] = [];
let opsRef: Ops[] = [];
let hideTimer: ReturnType<typeof setTimeout> | null = null;

export function setTooltipData(
  leaderboard: LeaderboardEntry[],
  matches: PlayedMatch[],
  ops: Ops[] = [],
) {
  leaderboardRef = leaderboard;
  matchesRef = matches;
  opsRef = ops;
}

function computeStats(login: string): PlayerStats {
  const lb = leaderboardRef.find((u) => u.login === login);
  const my = matchesRef.filter(
    (m) => m.playerALogin === login || m.playerBLogin === login,
  );
  const wins = my.filter((m) => {
    const isA = m.playerALogin === login;
    return (isA && m.winner === 'A') || (!isA && m.winner === 'B');
  }).length;
  const losses = my.length - wins;
  return {
    login,
    imageUrl: lb?.imageUrl ?? null,
    title: lb?.title ?? null,
    elo: lb?.elo ?? 1000,
    rank: lb?.rank ?? null,
    wins,
    losses,
    trophies: lb?.tournamentsWon ?? 0,
    dodges: lb?.dodgeCount ?? 0,
  };
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    #${TOOLTIP_ID} {
      position: fixed;
      z-index: 2147483647;
      background: #0b0f17;
      border: 1px solid #007577;
      border-radius: 4px;
      padding: 12px;
      width: 240px;
      box-shadow: 0 6px 24px rgba(0,0,0,0.5), 0 0 16px rgba(0, 217, 220, 0.25);
      font-family: 'Inter', system-ui, sans-serif;
      color: #e6ecf5;
      font-size: 12px;
      pointer-events: auto;
      animation: l42-tip-in 120ms ease-out;
    }
    @keyframes l42-tip-in {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    #${TOOLTIP_ID} .l42tt-head {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid #243044;
    }
    #${TOOLTIP_ID} .l42tt-av {
      width: 44px; height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, #007577, #00d9dc);
      color: #001416;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 18px; text-transform: uppercase;
      border: 2px solid #00d9dc;
      box-shadow: 0 0 12px rgba(0, 217, 220, 0.4);
      overflow: hidden; flex-shrink: 0;
    }
    #${TOOLTIP_ID} .l42tt-av img {
      width: 100%; height: 100%; object-fit: cover; display: block;
    }
    #${TOOLTIP_ID} .l42tt-name {
      font-weight: 800; font-size: 14px;
      color: #fff; line-height: 1.2;
    }
    #${TOOLTIP_ID} .l42tt-sub {
      color: #6b7689; font-size: 10px;
      text-transform: uppercase; letter-spacing: 0.1em;
      margin-top: 2px;
    }
    #${TOOLTIP_ID} .l42tt-title {
      color: #ffb71b; font-size: 11px;
      font-style: italic; font-weight: 600;
      margin-top: 4px;
      text-shadow: 0 0 6px rgba(255, 183, 27, 0.4);
    }
    #${TOOLTIP_ID} .l42tt-ops {
      color: #ff3b5c; font-size: 11px;
      font-weight: 700;
      margin-top: 4px;
      letter-spacing: 0.04em;
      text-shadow: 0 0 6px rgba(255, 59, 92, 0.4);
    }
    #${TOOLTIP_ID} .l42tt-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    #${TOOLTIP_ID} .l42tt-stat {
      background: #111827;
      border: 1px solid #243044;
      border-radius: 3px;
      padding: 8px;
      text-align: center;
    }
    #${TOOLTIP_ID} .l42tt-stat-v {
      font-size: 18px; font-weight: 800;
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }
    #${TOOLTIP_ID} .l42tt-stat-l {
      font-size: 9px; color: #95a3b8;
      text-transform: uppercase; letter-spacing: 0.1em;
      margin-top: 4px; font-weight: 600;
    }
    #${TOOLTIP_ID} .v-elo   { color: #00d9dc; }
    #${TOOLTIP_ID} .v-trophy{ color: #ffb71b; }
    #${TOOLTIP_ID} .v-win   { color: #ffb71b; }
    #${TOOLTIP_ID} .v-loss  { color: #ff3b5c; }
  `;
  document.head.appendChild(s);
}

function ensureNode(): HTMLElement {
  let node = document.getElementById(TOOLTIP_ID) as HTMLElement | null;
  if (node) return node;
  node = document.createElement('div');
  node.id = TOOLTIP_ID;
  node.addEventListener('mouseenter', () => {
    if (hideTimer) clearTimeout(hideTimer);
  });
  node.addEventListener('mouseleave', scheduleHide);
  document.body.appendChild(node);
  return node;
}

function fillNode(node: HTMLElement, s: PlayerStats) {
  node.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'l42tt-head';
  const av = document.createElement('div');
  av.className = 'l42tt-av';
  if (s.imageUrl) {
    const img = document.createElement('img');
    img.src = s.imageUrl;
    img.alt = s.login;
    img.onerror = () => {
      av.innerHTML = '';
      av.textContent = (s.login[0] ?? '?').toUpperCase();
    };
    av.appendChild(img);
  } else {
    av.textContent = (s.login[0] ?? '?').toUpperCase();
  }
  const id = document.createElement('div');
  const name = document.createElement('div');
  name.className = 'l42tt-name';
  name.textContent = s.login;
  const sub = document.createElement('div');
  sub.className = 'l42tt-sub';
  sub.textContent = s.rank != null ? `42 League · #${s.rank}` : '42 League · non classé';
  id.append(name, sub);
  if (s.title) {
    const title = document.createElement('div');
    title.className = 'l42tt-title';
    title.textContent = `« ${s.title} »`;
    id.append(title);
  }
  const targetedBy = opsRef.find((o) => o.targetLogin === s.login);
  const owning = opsRef.find((o) => o.ownerLogin === s.login);
  if (targetedBy) {
    const t = document.createElement('div');
    t.className = 'l42tt-ops';
    t.textContent = `☠ Ops de ${targetedBy.ownerLogin}`;
    id.append(t);
  }
  if (owning) {
    const t = document.createElement('div');
    t.className = 'l42tt-ops';
    t.textContent = `☠ Traque ${owning.targetLogin}`;
    id.append(t);
  }
  head.append(av, id);

  const stats = document.createElement('div');
  stats.className = 'l42tt-stats';
  stats.append(
    stat(String(s.elo), 'ELO', 'v-elo'),
    stat(String(s.trophies), 'Tournois', 'v-trophy'),
    stat(String(s.wins), 'Wins', 'v-win'),
    stat(String(s.losses), 'Losses', 'v-loss'),
  );
  node.append(head, stats);
}

function stat(value: string, label: string, valueCls: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'l42tt-stat';
  const v = document.createElement('div');
  v.className = `l42tt-stat-v ${valueCls}`;
  v.textContent = value;
  const l = document.createElement('div');
  l.className = 'l42tt-stat-l';
  l.textContent = label;
  wrap.append(v, l);
  return wrap;
}

function position(node: HTMLElement, anchor: HTMLElement) {
  const r = anchor.getBoundingClientRect();
  const tipW = 240;
  const tipH = node.offsetHeight || 160;
  let left = r.left;
  // Default: above the anchor
  let top = r.top - tipH - 6;
  // Fallback: below if no space above
  if (top < 8) top = r.bottom + 6;
  if (left + tipW > window.innerWidth - 8) left = window.innerWidth - tipW - 8;
  if (left < 8) left = 8;
  if (top + tipH > window.innerHeight - 8) top = window.innerHeight - tipH - 8;
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
}

function show(anchor: HTMLElement, login: string) {
  ensureStyle();
  const node = ensureNode();
  node.style.display = 'block';
  fillNode(node, computeStats(login));
  // measure after fill
  requestAnimationFrame(() => position(node, anchor));
}

function scheduleHide() {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    const n = document.getElementById(TOOLTIP_ID);
    if (n) n.style.display = 'none';
  }, 150);
}

export function attachTooltip(anchor: HTMLElement, login: string) {
  anchor.addEventListener('mouseenter', () => {
    if (hideTimer) clearTimeout(hideTimer);
    show(anchor, login);
  });
  anchor.addEventListener('mouseleave', scheduleHide);
}
