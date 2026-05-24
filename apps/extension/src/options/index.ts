import {
  api,
  AuthError,
  type Challenge,
  type LeaderboardEntry,
  type MeResponse,
  type Ops,
  type OpsMeResponse,
  type OpsUserResponse,
  type PendingMatch,
  type PlayedMatch,
  type Tournament,
  type TournamentMatch,
  type UserProfile,
} from '../lib/api.js';
import { authBridge } from '../lib/auth-bridge.js';
import { attachTooltip, setTooltipData } from '../lib/tooltip.js';
import { confirmDialog } from '../lib/confirm.js';
import {
  applyTheme,
  currentLang,
  currentTheme,
  loadPrefs,
  setLang,
  setTheme,
  watchSystemTheme,
  type Lang,
  type Theme,
} from '../lib/prefs.js';
import { t } from '../lib/i18n.js';

type Section =
  | 'defis'
  | 'tournois'
  | 'leaderboard'
  | 'trophees'
  | 'profil'
  | 'historique'
  | 'reglages'
  | 'player';

interface State {
  loading: boolean;
  authenticated: boolean;
  me: MeResponse | null;
  matches: PlayedMatch[];
  pending: PendingMatch[];
  challenges: Challenge[];
  leaderboard: LeaderboardEntry[];
  flash: string | null;
  error: string | null;
  connecting: boolean;
  section: Section;
  playerLogin: string | null;
  playerData: UserProfile | null;
  playerLoading: boolean;
  tournaments: Tournament[];
  selectedTournamentId: string | null;
  selectedTournament: Tournament | null;
  tournamentLoading: boolean;
  opsMe: OpsMeResponse | null;
  opsForPlayer: OpsUserResponse | null;
  allOps: Ops[];
}

const state: State = {
  loading: true,
  authenticated: false,
  me: null,
  matches: [],
  pending: [],
  challenges: [],
  leaderboard: [],
  flash: null,
  error: null,
  connecting: false,
  section: 'defis',
  playerLogin: null,
  playerData: null,
  playerLoading: false,
  tournaments: [],
  selectedTournamentId: null,
  selectedTournament: null,
  tournamentLoading: false,
  opsMe: null,
  opsForPlayer: null,
  allOps: [],
};

const root = document.getElementById('root') as HTMLElement;
const sidebar = document.getElementById('sidebar') as HTMLElement;
const topbarLogin = document.getElementById('topbar-login') as HTMLElement;

function sectionDefs(): { id: Section; labelKey: string; icon: string }[] {
  return [
    { id: 'defis', labelKey: 'nav.defis', icon: '⚔' },
    { id: 'tournois', labelKey: 'nav.tournois', icon: '🏟' },
    { id: 'leaderboard', labelKey: 'nav.leaderboard', icon: '★' },
    { id: 'trophees', labelKey: 'nav.trophees', icon: '🏆' },
    { id: 'profil', labelKey: 'nav.profil', icon: '◆' },
    { id: 'historique', labelKey: 'nav.historique', icon: '▣' },
    { id: 'reglages', labelKey: 'nav.reglages', icon: '⚙' },
  ];
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') node.className = v as string;
    else if (v !== undefined) (node as unknown as Record<string, unknown>)[k] = v;
  }
  for (const c of children) {
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function spinner(dark = false) {
  return el('span', { className: dark ? 'spinner dark' : 'spinner' });
}

function playerHref(login: string): string {
  return `#player=${encodeURIComponent(login)}`;
}

function playerLink(
  login: string,
  inner: (Node | string)[],
  cls = 'player-link',
): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = cls;
  a.href = playerHref(login);
  for (const c of inner) {
    a.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  attachTooltip(a, login);
  return a;
}

function avatarEl(login: string, imageUrl: string | null, className: string): HTMLElement {
  const box = el('div', { className });
  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = login;
    img.onerror = () => {
      box.innerHTML = '';
      box.textContent = (login[0] ?? '?').toUpperCase();
    };
    box.appendChild(img);
  } else {
    box.textContent = (login[0] ?? '?').toUpperCase();
  }
  return box;
}

function parseHash(): {
  section: Section;
  playerLogin: string | null;
  tournamentId: string | null;
} {
  const h = location.hash.replace('#', '');
  if (h.startsWith('player=')) {
    const login = decodeURIComponent(h.slice('player='.length));
    return { section: 'player', playerLogin: login || null, tournamentId: null };
  }
  if (h.startsWith('tournoi=')) {
    const id = decodeURIComponent(h.slice('tournoi='.length));
    return { section: 'tournois', playerLogin: null, tournamentId: id || null };
  }
  const section = (sectionDefs().find((s) => s.id === h)?.id ?? 'defis') as Section;
  return { section, playerLogin: null, tournamentId: null };
}

function fmtRelative(iso: string): { text: string; late: boolean } {
  const diff = new Date(iso).getTime() - Date.now();
  const absMin = Math.round(Math.abs(diff) / 60_000);
  if (diff >= 0) {
    if (absMin < 1) return { text: 'maintenant', late: false };
    if (absMin === 1) return { text: 'dans 1 minute', late: false };
    if (absMin < 60) return { text: `dans ${absMin} min`, late: false };
    const h = Math.floor(absMin / 60);
    return { text: h === 1 ? 'dans 1 heure' : `dans ${h} h`, late: false };
  }
  if (absMin < 1) return { text: "à l'instant", late: false };
  if (absMin === 1) return { text: 'il y a 1 minute', late: true };
  if (absMin < 60) return { text: `il y a ${absMin} min`, late: true };
  const h = Math.floor(absMin / 60);
  return { text: h === 1 ? 'il y a 1 heure' : `il y a ${h} h`, late: true };
}

function flash(msg: string) {
  state.flash = msg;
  render();
  setTimeout(() => {
    state.flash = null;
    render();
  }, 2500);
}

function isoLocalNowPlusMinutes(mins: number): string {
  const d = new Date(Date.now() + mins * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ============ SIDEBAR ============ */
function renderSidebar() {
  sidebar.innerHTML = '';
  for (const s of sectionDefs()) {
    const link = el('a', {
      className: 'nav-item' + (state.section === s.id ? ' active' : ''),
      href: `#${s.id}`,
    });
    link.append(
      el('span', { className: 'nav-icon' }, s.icon),
      el('span', {}, t(s.labelKey)),
    );
    sidebar.appendChild(link);
  }
}

/* ============ PANELS ============ */
function panel(title: string, sub?: string): { wrap: HTMLElement; body: HTMLElement } {
  const wrap = el('section', { className: 'panel' });
  const h = el('h2', { className: 'panel-title' }, title);
  if (sub) h.append(el('span', { className: 'panel-sub' }, sub));
  wrap.appendChild(h);
  return { wrap, body: wrap };
}

/* ============ DEFIS ============ */
function renderDefis(): HTMLElement {
  const { wrap } = panel('Défis', 'Lance un duel — sois honoré.');
  const me = state.me?.login;

  const incoming = state.challenges.filter(
    (c) => c.opponentLogin === me && c.status === 'pending',
  );
  const outgoing = state.challenges.filter(
    (c) => c.challengerLogin === me && c.status === 'pending',
  );
  const accepted = state.challenges.filter((c) => c.status === 'accepted');

  if (incoming.length + outgoing.length + accepted.length > 0) {
    if (incoming.length) {
      wrap.append(
        el(
          'div',
          {
            className: 'panel-sub',
            // @ts-expect-error inline
            style: 'margin: 8px 0 6px;',
          },
          'Défis reçus',
        ),
      );
      for (const c of incoming) wrap.appendChild(renderChallengeRow(c, 'incoming'));
    }
    if (accepted.length) {
      wrap.append(
        el(
          'div',
          {
            className: 'panel-sub',
            // @ts-expect-error inline
            style: 'margin: 16px 0 6px;',
          },
          'Matchs planifiés',
        ),
      );
      for (const c of accepted) wrap.appendChild(renderChallengeRow(c, 'accepted'));
    }
    if (outgoing.length) {
      wrap.append(
        el(
          'div',
          {
            className: 'panel-sub',
            // @ts-expect-error inline
            style: 'margin: 16px 0 6px;',
          },
          'Défis envoyés',
        ),
      );
      for (const c of outgoing) wrap.appendChild(renderChallengeRow(c, 'outgoing'));
    }
  }

  /* ----- Form: défier quelqu'un ----- */
  wrap.append(
    el(
      'div',
      {
        className: 'panel-sub',
        // @ts-expect-error inline
        style: 'margin: 24px 0 6px;',
      },
      'Défier un joueur de la league',
    ),
  );

  const others = state.leaderboard.filter((u) => u.login !== me);
  if (others.length === 0) {
    wrap.appendChild(
      el('div', { className: 'empty' }, 'Aucun autre joueur inscrit pour le moment.'),
    );
    return wrap;
  }

  const grid = el('div', { className: 'defi-grid' });
  for (const u of others) {
    const card = el('div', { className: 'defi-card' });
    const linkSide = playerLink(
      u.login,
      [
        avatarEl(u.login, u.imageUrl, 'av'),
        (() => {
          const info = el('div', { className: 'info' });
          info.append(
            el('div', { className: 'login' }, u.login),
            el(
              'div',
              { className: 'meta' },
              el('span', { className: 'elo' }, String(u.elo)),
              ' ELO · #' + u.rank,
            ),
          );
          return info;
        })(),
      ],
      'player-link defi-card-link',
    );
    const btn = el(
      'button',
      {
        className: 'sm',
        onclick: () => openChallengeForm(card, u.login),
      },
      'Défier',
    );
    card.append(linkSide, btn);
    grid.append(card);
  }
  wrap.append(grid);

  return wrap;
}

function renderChallengeRow(c: Challenge, kind: 'incoming' | 'outgoing' | 'accepted'): HTMLElement {
  const me = state.me?.login;
  const opp = c.challengerLogin === me ? c.opponentLogin : c.challengerLogin;
  const row = el('div', { className: 'defi-list-row' });
  const icon = el('span', { className: 'icon' }, '⚔');
  const txt = el(
    'span',
    {},
    kind === 'incoming' ? 'Défi de ' : kind === 'outgoing' ? 'Défi à ' : 'Match vs ',
  );
  const player = playerLink(opp, [opp], 'player-link player');
  const r = fmtRelative(c.scheduledAt);
  const when = el('span', { className: 'at' + (r.late ? ' ago-late' : '') }, r.text);

  row.append(icon, txt, player, when);

  if (kind === 'incoming') {
    const ok = el(
      'button',
      {
        className: 'sm',
        onclick: () => doChallenge(c.id, 'accept'),
      },
      'Accepter',
    );
    const no = el(
      'button',
      {
        className: 'sm ghost',
        onclick: () => doChallenge(c.id, 'decline'),
      },
      'Refuser',
    );
    row.append(ok, no);
  } else if (kind === 'outgoing') {
    const cancel = el(
      'button',
      {
        className: 'sm ghost',
        onclick: () => doChallenge(c.id, 'decline'),
      },
      'Annuler',
    );
    row.append(cancel);
  } else {
    const enter = el(
      'button',
      {
        className: 'sm',
        onclick: () => openRecordForm(row, c),
      },
      'Saisir score',
    );
    const cancel = el(
      'button',
      {
        className: 'sm ghost',
        onclick: () => doChallenge(c.id, 'decline'),
      },
      'Annuler',
    );
    row.append(enter, cancel);
  }

  return row;
}

function openChallengeForm(card: HTMLElement, opponentLogin: string) {
  card.querySelector('.defi-form-inline')?.remove();
  const form = el('div', { className: 'defi-form-inline' });
  form.style.cssText = 'flex-basis: 100%; margin-top: 8px;';

  const when = el('input', { type: 'datetime-local' }) as HTMLInputElement;
  when.value = isoLocalNowPlusMinutes(30);

  const send = el(
    'button',
    {
      className: 'sm',
      onclick: async () => {
        const v = when.value;
        if (!v) return;
        const iso = new Date(v).toISOString();
        try {
          await api.createChallenge({ opponentLogin, scheduledAt: iso });
          flash(`Défi envoyé à @${opponentLogin}`);
          await load();
        } catch (err) {
          state.error = err instanceof Error ? err.message : String(err);
          render();
        }
      },
    },
    'Envoyer',
  );

  const cancel = el(
    'button',
    {
      className: 'sm ghost',
      onclick: () => form.remove(),
    },
    'Annuler',
  );

  const inner = el('div', { className: 'defi-form' });
  inner.append(when, send, cancel);
  form.append(inner);
  card.append(form);
  when.focus();
}

function openRecordForm(row: HTMLElement, c: Challenge) {
  row.querySelector('.defi-form-inline')?.remove();
  const meLogin = state.me?.login;
  const oppLogin =
    c.challengerLogin === meLogin ? c.opponentLogin : c.challengerLogin;
  const form = el('div', { className: 'defi-form-inline' });
  form.style.cssText = 'flex-basis: 100%; margin-top: 8px;';

  const me = el('input', {
    type: 'number',
    placeholder: 'Ton score',
  }) as HTMLInputElement;
  me.min = '0';
  me.max = '10';
  const opp = el('input', {
    type: 'number',
    placeholder: `Score ${oppLogin}`,
  }) as HTMLInputElement;
  opp.min = '0';
  opp.max = '10';

  const send = el(
    'button',
    {
      className: 'sm',
      onclick: async () => {
        const a = Number(me.value);
        const b = Number(opp.value);
        if (!Number.isFinite(a) || !Number.isFinite(b)) return;
        try {
          await api.recordChallengeResult(c.id, a, b);
          flash('Score envoyé — en attente de confirmation');
          await load();
        } catch (err) {
          state.error = err instanceof Error ? err.message : String(err);
          render();
        }
      },
    },
    'Envoyer',
  );

  const cancel = el(
    'button',
    {
      className: 'sm ghost',
      onclick: () => form.remove(),
    },
    'Annuler',
  );

  const grid = el('div', { className: 'defi-form' });
  grid.append(me, opp, send);
  form.append(grid, cancel);
  row.append(form);
  me.focus();
}

async function doChallenge(id: string, action: 'accept' | 'decline') {
  if (action === 'decline') {
    const ch = state.challenges.find((c) => c.id === id);
    const me = state.me?.login;
    const iAmChallenger = ch?.challengerLogin === me;
    const opp = ch
      ? iAmChallenger
        ? ch.opponentLogin
        : ch.challengerLogin
      : '';
    const wasAccepted = ch?.status === 'accepted';
    const ok = await confirmDialog({
      title: wasAccepted
        ? 'Fuir ce match ?'
        : iAmChallenger
          ? 'Annuler ce défi ?'
          : 'Refuser ce défi ?',
      message: wasAccepted
        ? `Le match contre ${opp} était accepté par les deux. Si tu annules maintenant, c'est considéré comme une fuite.`
        : iAmChallenger
          ? `Annuler ton défi envoyé à ${opp} ?`
          : `Refuser le défi de ${opp} ?`,
      warning: wasAccepted ? '⚠ Pénalité : -10 ELO + 1 fuite marquée sur ton profil.' : undefined,
      confirmLabel: wasAccepted
        ? 'Confirmer la fuite'
        : iAmChallenger
          ? 'Annuler'
          : 'Refuser',
      cancelLabel: 'Garder',
      danger: true,
    });
    if (!ok) return;
  }
  try {
    if (action === 'accept') {
      await api.acceptChallenge(id);
      flash('Défi accepté');
    } else {
      await api.declineChallenge(id);
      flash('Défi clos');
    }
    await load();
  } catch (err) {
    state.error = err instanceof Error ? err.message : String(err);
    render();
  }
}

/* ============ LEADERBOARD ============ */
function renderLeaderboard(): HTMLElement {
  const { wrap } = panel('Classement', `${state.leaderboard.length} joueurs · saison en cours`);
  if (state.leaderboard.length === 0) {
    wrap.append(el('div', { className: 'empty' }, 'Personne n\'a encore joué.'));
    return wrap;
  }
  const me = state.me?.login;
  const lastLogin =
    state.leaderboard.length > 1
      ? state.leaderboard[state.leaderboard.length - 1]?.login
      : null;
  const table = el('table', { className: 'lb-table' });
  const thead = el('thead');
  thead.append(
    el(
      'tr',
      {},
      el('th', {}, '#'),
      el('th', {}, 'Joueur'),
      el('th', {}, 'ELO'),
      el('th', {}, 'W'),
      el('th', {}, 'L'),
      el('th', { className: 'actions' }, ''),
    ),
  );
  const tbody = el('tbody');
  for (const u of state.leaderboard) {
    const userMatches = state.matches.filter(
      (m) => m.playerALogin === u.login || m.playerBLogin === u.login,
    );
    const wins = userMatches.filter((m) => {
      const isA = m.playerALogin === u.login;
      return (isA && m.winner === 'A') || (!isA && m.winner === 'B');
    }).length;
    const losses = userMatches.length - wins;

    const rankCls =
      u.rank === 1 ? 'rank top1' : u.rank === 2 ? 'rank top2' : u.rank === 3 ? 'rank top3' : 'rank';
    const classes = [
      u.login === me ? 'me' : '',
      u.login === lastLogin ? 'lb-last' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const tr = el('tr', { className: classes });
    const playerCell = el('td', { className: 'player' });
    const link = playerLink(
      u.login,
      [avatarEl(u.login, u.imageUrl, 'lb-av'), u.login],
      'player-link lb-name-wrap',
    );
    playerCell.append(link);
    const targetedBy = state.allOps.find((o) => o.targetLogin === u.login);
    if (targetedBy) {
      playerCell.append(
        el(
          'span',
          {
            className: 'ops-tag',
            title: `Ops de ${targetedBy.ownerLogin}`,
          } as Record<string, unknown>,
          '☠ OPS',
        ),
      );
    }
    if (u.title) {
      const titleEl = el('div', { className: 'lb-title' }, `« ${u.title} »`);
      titleEl.style.cssText =
        'display: block; font-size: 10px; color: var(--gold); font-style: italic; margin-top: 2px; margin-left: 34px;';
      playerCell.append(titleEl);
    }
    tr.append(
      el('td', { className: rankCls }, `#${u.rank}`),
      playerCell,
      el('td', { className: 'elo' }, String(u.elo)),
      el('td', { className: 'wl-w' }, String(wins)),
      el('td', { className: 'wl-l' }, String(losses)),
      el(
        'td',
        { className: 'actions' },
        u.login === me
          ? document.createTextNode('')
          : el(
              'button',
              {
                className: 'sm ghost',
                onclick: () => {
                  state.section = 'defis';
                  history.pushState(null, '', '#defis');
                  render();
                  requestAnimationFrame(() => {
                    const card = root.querySelectorAll<HTMLElement>('.defi-card');
                    for (const c of card) {
                      if (c.textContent?.includes(u.login)) {
                        openChallengeForm(c, u.login);
                        c.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        break;
                      }
                    }
                  });
                },
              },
              'Défier',
            ),
      ),
    );
    tbody.append(tr);
  }
  table.append(thead, tbody);
  wrap.append(table);
  return wrap;
}

/* ============ PROFIL ============ */
function statsCompute() {
  const meUser = state.me?.user;
  const myLogin = state.me?.login;
  const myMatches = state.matches.filter(
    (m) => m.playerALogin === myLogin || m.playerBLogin === myLogin,
  );
  const wins = myMatches.filter((m) => {
    const youAreA = m.playerALogin === myLogin;
    return (youAreA && m.winner === 'A') || (!youAreA && m.winner === 'B');
  }).length;
  const total = myMatches.length;
  const winRate = total === 0 ? 0 : Math.round((wins / total) * 100);
  const eloMoves = myMatches
    .filter((m) => m.countedForElo)
    .map((m) => (m.playerALogin === myLogin ? m.deltaA : m.deltaB));
  const totalDelta = eloMoves.reduce((s, d) => s + d, 0);
  return {
    elo: meUser?.elo ?? 1000,
    matchesPlayed: meUser?.matchesPlayed ?? 0,
    total,
    wins,
    losses: total - wins,
    winRate,
    totalDelta,
  };
}

function statCard(value: string, label: string, mod: string = '') {
  return el(
    'div',
    { className: 'stat ' + mod },
    el('div', { className: 'value' }, value),
    el('div', { className: 'label' }, label),
  );
}

function renderProfil(): HTMLElement {
  const { wrap } = panel('Profil', 'Tes stats actuelles');
  const login = state.me?.login ?? '—';
  const campus = state.me?.user?.campus ?? '—';
  const imageUrl = state.me?.user?.imageUrl ?? null;
  const s = statsCompute();

  const hero = el('div', { className: 'hero' });
  const ident = el('div', { className: 'ident' });
  const meta = el('div', { className: 'meta' });
  meta.append(
    document.createTextNode(`Campus · ${campus}`),
    el('span', { className: 'elo-badge' }, `${s.elo} ELO`),
  );
  ident.append(el('div', { className: 'login' }, login), meta);
  hero.append(avatarEl(login, imageUrl, 'avatar'), ident);
  wrap.append(hero);

  const grid = el('div', { className: 'stats' });
  grid.style.cssText = 'margin-top: 22px;';
  grid.append(
    statCard(String(s.elo), 'ELO', 'teal'),
    statCard(String(s.matchesPlayed), 'Matchs ELO', 'teal'),
    statCard(`${s.winRate}%`, 'Win rate', s.winRate >= 50 ? 'win' : 'loss'),
    statCard(`${s.totalDelta >= 0 ? '+' : ''}${s.totalDelta}`, 'Δ ELO', s.totalDelta >= 0 ? 'win' : 'loss'),
  );
  wrap.append(grid);

  const kv = el('div', {});
  kv.style.cssText = 'margin-top: 18px;';
  kv.append(
    el(
      'div',
      { className: 'kv-row' },
      el('span', { className: 'k' }, 'Victoires'),
      el('span', { className: 'v', style: 'color: var(--gold)' } as Record<string, unknown>, String(s.wins)),
    ),
    el(
      'div',
      { className: 'kv-row' },
      el('span', { className: 'k' }, 'Défaites'),
      el('span', { className: 'v', style: 'color: var(--red)' } as Record<string, unknown>, String(s.losses)),
    ),
  );
  wrap.append(kv);

  /* OPS widget */
  wrap.append(renderOpsWidget());

  return wrap;
}

function fmtCountdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'terminé';
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}j ${hours}h`;
  const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
}

function renderOpsWidget(): HTMLElement {
  const wrap = el('div', { className: 'ops-widget' });
  const head = el('div', { className: 'ops-head' });
  head.append(
    el('span', { className: 'ops-skull' }, '☠'),
    el('span', { className: 'ops-label' }, 'OPS · ton ennemi juré'),
  );
  wrap.append(head);

  const ops = state.opsMe;
  if (!ops) {
    wrap.append(
      el(
        'div',
        { className: 'ops-empty' },
        "Va sur la fiche d'un joueur (depuis le classement) pour le déclarer comme ton ops.",
      ),
    );
    return wrap;
  }

  if (ops.current) {
    const target = ops.current.targetLogin;
    const av = avatarEl(
      ops.current.target?.login ?? target,
      ops.current.target?.imageUrl ?? null,
      'ops-av',
    );
    const info = el('div', { className: 'ops-info' });
    info.append(
      el('div', { className: 'ops-name' }, target),
      el(
        'div',
        { className: 'ops-meta' },
        `traque jusqu'au ${new Date(ops.current.expiresAt).toLocaleDateString('fr-FR')} · ${fmtCountdown(ops.current.expiresAt)} restant`,
      ),
    );
    const row = playerLink(target, [av, info], 'player-link ops-current');
    wrap.append(row);
  } else if (ops.canDeclareAt) {
    wrap.append(
      el(
        'div',
        { className: 'ops-cooldown' },
        `⏳ Cooldown actif · prochain ops dispo dans ${fmtCountdown(ops.canDeclareAt)}`,
      ),
    );
  } else {
    wrap.append(
      el(
        'div',
        { className: 'ops-empty' },
        'Aucun ops actif. Va sur une fiche joueur pour en déclarer un.',
      ),
    );
  }

  if (ops.targetedBy) {
    const owner = ops.targetedBy.ownerLogin;
    const av = avatarEl(
      ops.targetedBy.owner?.login ?? owner,
      ops.targetedBy.owner?.imageUrl ?? null,
      'ops-av',
    );
    const info = el('div', { className: 'ops-info' });
    info.append(
      el('div', { className: 'ops-name' }, owner),
      el(
        'div',
        { className: 'ops-meta' },
        `te traque · libère dans ${fmtCountdown(ops.targetedBy.expiresAt)}`,
      ),
    );
    const row = playerLink(owner, [av, info], 'player-link ops-targeted');
    wrap.append(
      el(
        'div',
        {
          className: 'ops-sublabel',
          style: 'margin-top: 12px;',
        } as Record<string, unknown>,
        'Tu es la cible de :',
      ),
      row,
    );
  }

  return wrap;
}

/* ============ TOURNOIS ============ */
function tournamentStatusLabel(s: Tournament['status']): string {
  switch (s) {
    case 'registration':
      return 'INSCRIPTIONS';
    case 'in_progress':
      return 'EN COURS';
    case 'finished':
      return 'TERMINÉ';
    case 'cancelled':
      return 'ANNULÉ';
  }
}

function renderTournois(): HTMLElement {
  if (state.selectedTournamentId) return renderTournoiDetail();
  return renderTournoisList();
}

function renderTournoisList(): HTMLElement {
  const { wrap } = panel('Tournois', 'Brackets · single-élim');

  /* Create form */
  const isMyAdmin = !!state.me?.isAdmin;
  let currentKind: 'friendly' | 'official' = 'friendly';

  const createWrap = el('div', {});
  createWrap.style.cssText = 'margin-bottom: 20px;';

  const kindRow = el('div', {});
  kindRow.style.cssText = 'margin-bottom: 8px;';
  const kindPills = pillSelector<'friendly' | 'official'>({
    value: currentKind,
    choices: isMyAdmin
      ? [
          { value: 'friendly', label: 'Amical' },
          { value: 'official', label: 'Officiel' },
        ]
      : [{ value: 'friendly', label: 'Amical' }],
    onChange: (v) => {
      currentKind = v;
    },
  });
  kindRow.append(kindPills);
  if (!isMyAdmin) {
    kindRow.append(
      el(
        'span',
        {
          style:
            'margin-left: 10px; font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em;',
        } as Record<string, unknown>,
        'Officiel : réservé aux admins',
      ),
    );
  }

  const nameInput = el('input', {
    type: 'text',
    placeholder: 'Nom du tournoi (ex. Coupe du Havre)',
  }) as HTMLInputElement;
  const capSel = el('select', {}) as HTMLSelectElement;
  capSel.style.cssText =
    'padding: 9px 12px; background: var(--bg-2); color: var(--text); border: 1px solid var(--border); border-radius: 3px; font-family: inherit; font-size: 13px;';
  capSel.append(
    Object.assign(document.createElement('option'), { value: '4', textContent: '4 joueurs' }),
    Object.assign(document.createElement('option'), { value: '8', textContent: '8 joueurs' }),
  );
  const submit = el(
    'button',
    {
      onclick: async () => {
        const name = nameInput.value.trim();
        const capacity = Number(capSel.value) as 4 | 8;
        if (!name) {
          state.error = 'Nom requis';
          render();
          return;
        }
        try {
          const tNew = await api.createTournament({
            name,
            capacity,
            kind: currentKind,
          });
          flash(`Tournoi "${tNew.name}" créé`);
          location.hash = `tournoi=${tNew.id}`;
        } catch (err) {
          state.error = err instanceof Error ? err.message : String(err);
          render();
        }
      },
    },
    'Créer',
  );
  const grid = el('div', {});
  grid.style.cssText = 'display: grid; grid-template-columns: 1fr auto auto; gap: 8px;';
  grid.append(nameInput, capSel, submit);
  createWrap.append(
    el(
      'div',
      {
        className: 'panel-sub',
        style: 'margin-bottom: 6px;',
      } as Record<string, unknown>,
      'Créer un tournoi',
    ),
    kindRow,
    grid,
  );
  wrap.append(createWrap);

  if (state.tournaments.length === 0) {
    wrap.append(el('div', { className: 'empty' }, 'Aucun tournoi pour le moment.'));
    return wrap;
  }

  const list = el('div', {});
  list.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';
  for (const t of state.tournaments) {
    const card = el('a', {
      className: 'tournoi-card',
      href: `#tournoi=${t.id}`,
    });
    const head = el('div', { className: 'tournoi-head' });
    const nameWrap = el('div', {});
    nameWrap.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    nameWrap.append(
      el('div', { className: 'tournoi-name' }, t.name),
      el(
        'span',
        { className: `tournoi-kind tournoi-kind-${t.kind}` },
        t.kind === 'official' ? '★ OFFICIEL' : 'AMICAL',
      ),
    );
    const badges = el('div', {});
    badges.append(
      el(
        'span',
        { className: `tournoi-badge tournoi-st-${t.status}` },
        tournamentStatusLabel(t.status),
      ),
    );
    head.append(nameWrap, badges);
    const meta = el('div', { className: 'tournoi-meta' });
    const count = t.entries?.length ?? 0;
    meta.append(
      document.createTextNode(`${count}/${t.capacity} joueurs · org. `),
      el(
        'span',
        { style: 'color: var(--text-strong)' } as Record<string, unknown>,
        t.createdByLogin,
      ),
    );
    if (t.winner) {
      meta.append(
        document.createTextNode(' · vainqueur '),
        el(
          'span',
          { style: 'color: var(--gold); font-weight:700' } as Record<string, unknown>,
          t.winner.login,
        ),
      );
    }
    card.append(head, meta);
    list.append(card);
  }
  wrap.append(list);
  return wrap;
}

function renderTournoiDetail(): HTMLElement {
  const tn = state.selectedTournament;
  const kindLabel = tn ? (tn.kind === 'official' ? '★ OFFICIEL' : 'AMICAL') : '';
  const { wrap } = panel(
    tn?.name ?? 'Tournoi',
    tn ? `${kindLabel} · ${tn.entries?.length ?? 0}/${tn.capacity} · ${tournamentStatusLabel(tn.status)}` : '',
  );

  const back = el(
    'a',
    {
      href: '#tournois',
      style: 'color: var(--muted-2); font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; text-decoration: none; margin-bottom: 12px; display: inline-block;',
    } as Record<string, unknown>,
    '← Retour aux tournois',
  );
  wrap.append(back);

  if (state.tournamentLoading) {
    wrap.append(el('div', { className: 'loading' }, t('common.loading')));
    return wrap;
  }
  if (!tn) {
    wrap.append(el('div', { className: 'empty' }, 'Tournoi introuvable.'));
    return wrap;
  }

  const me = state.me?.login;
  const isOrganizer = tn.createdByLogin === me;
  const iAmIn = !!tn.entries?.some((e) => e.login === me);

  /* Actions bar */
  if (tn.status === 'registration') {
    const actions = el('div', { className: 'row' });
    actions.style.cssText = 'margin-bottom: 16px; gap: 8px;';
    if (!iAmIn && (tn.entries?.length ?? 0) < tn.capacity) {
      actions.append(
        el(
          'button',
          {
            onclick: async () => {
              try {
                await api.joinTournament(tn.id);
                flash('Inscrit au tournoi');
                await loadTournament(tn.id);
              } catch (err) {
                state.error = err instanceof Error ? err.message : String(err);
                render();
              }
            },
          },
          "S'inscrire",
        ),
      );
    } else if (iAmIn) {
      actions.append(
        el(
          'button',
          {
            className: 'ghost',
            onclick: async () => {
              const ok = await confirmDialog({
                title: 'Quitter ce tournoi ?',
                message: 'Tu te retires des inscriptions.',
                confirmLabel: 'Quitter',
                cancelLabel: 'Rester',
                danger: true,
              });
              if (!ok) return;
              try {
                await api.leaveTournament(tn.id);
                flash('Désinscrit');
                await loadTournament(tn.id);
              } catch (err) {
                state.error = err instanceof Error ? err.message : String(err);
                render();
              }
            },
          },
          'Se retirer',
        ),
      );
    }
    if (isOrganizer && (tn.entries?.length ?? 0) === tn.capacity) {
      actions.append(
        el(
          'button',
          {
            onclick: async () => {
              try {
                await api.startTournament(tn.id);
                flash('Tournoi lancé · bracket généré');
                await loadTournament(tn.id);
              } catch (err) {
                state.error = err instanceof Error ? err.message : String(err);
                render();
              }
            },
          },
          'Lancer le tournoi',
        ),
      );
    }
    if (isOrganizer) {
      actions.append(
        el(
          'button',
          {
            className: 'danger',
            onclick: async () => {
              const ok = await confirmDialog({
                title: 'Annuler ce tournoi ?',
                message: 'Tous les participants seront retirés.',
                confirmLabel: 'Annuler le tournoi',
                cancelLabel: 'Garder',
                danger: true,
              });
              if (!ok) return;
              try {
                await api.cancelTournament(tn.id);
                flash('Tournoi annulé');
                await loadTournament(tn.id);
              } catch (err) {
                state.error = err instanceof Error ? err.message : String(err);
                render();
              }
            },
          },
          'Annuler',
        ),
      );
    }
    wrap.append(actions);

    /* Entries list */
    const ent = el('div', { className: 'panel-sub' }, 'Inscrits');
    ent.style.cssText = 'margin: 6px 0;';
    wrap.append(ent);
    const grid = el('div', { className: 'defi-grid' });
    for (const e of tn.entries ?? []) {
      const card = el('div', { className: 'defi-card' });
      const av = avatarEl(e.login, e.user?.imageUrl ?? null, 'av');
      const info = el('div', { className: 'info' });
      info.append(
        el('div', { className: 'login' }, e.login),
        el(
          'div',
          { className: 'meta' },
          el('span', { className: 'elo' }, String(e.user?.elo ?? '—')),
          ' ELO',
        ),
      );
      const link = playerLink(e.login, [av, info], 'player-link defi-card-link');
      card.append(link);
      grid.append(card);
    }
    for (let i = (tn.entries?.length ?? 0); i < tn.capacity; i++) {
      grid.append(
        el(
          'div',
          {
            className: 'defi-card',
            style: 'opacity: 0.4; border-style: dashed;',
          } as Record<string, unknown>,
          el('div', { className: 'av', style: 'background:transparent;border:1px dashed var(--muted)' } as Record<string, unknown>, '?'),
          el(
            'div',
            { className: 'info' },
            el(
              'div',
              { className: 'login', style: 'color: var(--muted)' } as Record<string, unknown>,
              'Place libre',
            ),
          ),
        ),
      );
    }
    wrap.append(grid);
    return wrap;
  }

  /* in_progress / finished / cancelled — render bracket */
  if (tn.winner && tn.status === 'finished') {
    const champ = el('div', { className: 'tournoi-champion' });
    champ.append(
      el('div', { className: 'tournoi-champion-label' }, '🏆 VAINQUEUR'),
      avatarEl(tn.winner.login, tn.winner.imageUrl ?? null, 'tournoi-champion-av'),
      el('div', { className: 'tournoi-champion-name' }, tn.winner.login),
    );
    wrap.append(champ);
  }

  wrap.append(renderBracket(tn));
  return wrap;
}

function renderBracket(t: Tournament): HTMLElement {
  const bracket = el('div', { className: 'bracket' });
  const me = state.me?.login;
  const matches = t.matches ?? [];
  const rounds = new Map<number, TournamentMatch[]>();
  for (const m of matches) {
    const arr = rounds.get(m.round) ?? [];
    arr.push(m);
    rounds.set(m.round, arr);
  }
  const totalRounds = Math.log2(t.capacity);
  for (let r = 1; r <= totalRounds; r++) {
    const col = el('div', { className: 'bracket-round' });
    const label =
      r === totalRounds
        ? 'FINALE'
        : r === totalRounds - 1
          ? 'DEMI-FINALES'
          : r === totalRounds - 2
            ? 'QUARTS'
            : `TOUR ${r}`;
    col.append(el('div', { className: 'bracket-round-label' }, label));
    for (const m of (rounds.get(r) ?? []).sort((a, b) => a.slot - b.slot)) {
      col.append(renderBracketMatch(t, m, me ?? null));
    }
    bracket.append(col);
  }
  return bracket;
}

function renderBracketMatch(
  t: Tournament,
  m: TournamentMatch,
  me: string | null,
): HTMLElement {
  const card = el('div', { className: 'bracket-match' });
  if (m.confirmedAt) card.classList.add('done');

  const row = (login: string | null, score: number | null, isWinner: boolean) => {
    const r = el('div', { className: 'bm-row' + (isWinner ? ' bm-winner' : '') });
    let nameNode: HTMLElement;
    if (login) {
      nameNode = playerLink(
        login,
        [avatarEl(login, null, 'bm-av'), login],
        'player-link bm-name',
      );
    } else {
      nameNode = el('span', { className: 'bm-name' });
      nameNode.style.color = 'var(--muted)';
      nameNode.textContent = '?';
    }
    const sc = el(
      'span',
      { className: 'bm-score' },
      score != null ? String(score) : '–',
    );
    r.append(nameNode, sc);
    return r;
  };

  const winnerA = m.winnerLogin && m.winnerLogin === m.playerALogin;
  const winnerB = m.winnerLogin && m.winnerLogin === m.playerBLogin;
  card.append(row(m.playerALogin, m.scoreA, !!winnerA));
  card.append(row(m.playerBLogin, m.scoreB, !!winnerB));

  const iAmIn =
    me && (m.playerALogin === me || m.playerBLogin === me);
  if (
    t.status === 'in_progress' &&
    iAmIn &&
    m.playerALogin &&
    m.playerBLogin &&
    !m.confirmedAt
  ) {
    const recorded = m.recordedByLogin != null && m.scoreA != null && m.scoreB != null;
    const iRecorded = recorded && m.recordedByLogin === me;

    if (!recorded) {
      // No score yet → I can record
      const btn = el(
        'button',
        {
          className: 'sm',
          style: 'margin-top: 6px; width: 100%;',
          onclick: () => openBracketRecordForm(card, t, m),
        } as Record<string, unknown>,
        'Saisir le score',
      );
      card.append(btn);
    } else if (iRecorded) {
      const wait = el(
        'div',
        { className: 'bm-pending' },
        `En attente de confirmation par l'adversaire (${m.scoreA}-${m.scoreB})`,
      );
      card.append(wait);
    } else {
      // Opponent recorded, I need to confirm
      const conf = el('div', { style: 'margin-top: 6px;' } as Record<string, unknown>);
      conf.append(
        el(
          'div',
          {
            style: 'font-size: 11px; color: var(--gold); margin-bottom: 4px;',
          } as Record<string, unknown>,
          `Score à confirmer : ${m.scoreA}-${m.scoreB}`,
        ),
      );
      const actions = el('div', { className: 'row', style: 'gap: 6px;' } as Record<string, unknown>);
      actions.append(
        el(
          'button',
          {
            className: 'sm',
            onclick: async () => {
              try {
                const res = await api.confirmTournamentMatch(t.id, m.id, m.scoreA!, m.scoreB!);
                flash(res.finished ? `🏆 ${res.winnerLogin} remporte le tournoi !` : 'Score confirmé');
                await loadTournament(t.id);
              } catch (err) {
                state.error = err instanceof Error ? err.message : String(err);
                render();
              }
            },
          },
          'Confirmer',
        ),
        el(
          'button',
          {
            className: 'sm ghost',
            onclick: async () => {
              const ok = await confirmDialog({
                title: 'Refuser ce score ?',
                message: 'Le score sera reset, à ressaisir.',
                confirmLabel: 'Refuser',
                cancelLabel: 'Garder',
                danger: true,
              });
              if (!ok) return;
              try {
                await api.rejectTournamentMatch(t.id, m.id);
                flash('Score reset');
                await loadTournament(t.id);
              } catch (err) {
                state.error = err instanceof Error ? err.message : String(err);
                render();
              }
            },
          },
          'Refuser',
        ),
      );
      conf.append(actions);
      card.append(conf);
    }
  }
  return card;
}

function openBracketRecordForm(card: HTMLElement, t: Tournament, m: TournamentMatch) {
  card.querySelector('.bm-record-form')?.remove();
  const form = el('div', { className: 'bm-record-form' });
  form.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr auto; gap: 6px; margin-top: 6px;';
  const a = el('input', { type: 'number', placeholder: `${m.playerALogin}` }) as HTMLInputElement;
  a.min = '0'; a.max = '10';
  const b = el('input', { type: 'number', placeholder: `${m.playerBLogin}` }) as HTMLInputElement;
  b.min = '0'; b.max = '10';
  const send = el(
    'button',
    {
      className: 'sm',
      onclick: async () => {
        const sa = Number(a.value); const sb = Number(b.value);
        if (!Number.isFinite(sa) || !Number.isFinite(sb)) return;
        try {
          await api.recordTournamentMatch(t.id, m.id, sa, sb);
          flash("Score enregistré · en attente de confirmation");
          await loadTournament(t.id);
        } catch (err) {
          state.error = err instanceof Error ? err.message : String(err);
          render();
        }
      },
    },
    'OK',
  );
  form.append(a, b, send);
  card.append(form);
  a.focus();
}

async function loadTournaments() {
  try {
    state.tournaments = await api.tournaments();
  } catch (err) {
    if (!(err instanceof AuthError)) {
      console.warn('[42 League] tournaments load failed', err);
    }
  }
}

async function loadTournament(id: string) {
  state.tournamentLoading = true;
  render();
  try {
    state.selectedTournament = await api.tournament(id);
  } catch {
    state.selectedTournament = null;
  } finally {
    state.tournamentLoading = false;
    render();
  }
}

/* ============ TROPHÉES ============ */
type TrophyColor =
  | 'gold'
  | 'red'
  | 'cyan'
  | 'violet'
  | 'magenta'
  | 'bronze'
  | 'crimson'
  | 'green'
  | 'sapphire';

interface TrophyResult {
  emoji: string;
  title: string;
  subtitle: string;
  winner: { login: string; imageUrl: string | null } | null;
  value: string;
  hint?: string;
  color: TrophyColor;
}

function computeTrophies(): TrophyResult[] {
  const lb = state.leaderboard;
  const matches = state.matches;
  const userMap = new Map(lb.map((u) => [u.login, u]));

  // Stats per login
  type Acc = {
    login: string;
    wins: number;
    losses: number;
    played: number;
    maxGap: number;
    maxGapDate: number;
    opponents: Map<string, number>;
    biggestUpsetGap: number;
    biggestUpsetVictim: string | null;
  };
  const acc = new Map<string, Acc>();
  const ensure = (login: string): Acc => {
    let a = acc.get(login);
    if (!a) {
      a = {
        login,
        wins: 0,
        losses: 0,
        played: 0,
        maxGap: -1,
        maxGapDate: 0,
        opponents: new Map(),
        biggestUpsetGap: 0,
        biggestUpsetVictim: null,
      };
      acc.set(login, a);
    }
    return a;
  };
  for (const m of matches) {
    const a = ensure(m.playerALogin);
    const b = ensure(m.playerBLogin);
    a.played++;
    b.played++;
    a.opponents.set(m.playerBLogin, (a.opponents.get(m.playerBLogin) ?? 0) + 1);
    b.opponents.set(m.playerALogin, (b.opponents.get(m.playerALogin) ?? 0) + 1);
    const winner = m.winner === 'A' ? a : b;
    const loser = m.winner === 'A' ? b : a;
    winner.wins++;
    loser.losses++;
    const gap = Math.abs(m.scoreA - m.scoreB);
    const t = new Date(m.playedAt).getTime();
    if (gap > winner.maxGap || (gap === winner.maxGap && t > winner.maxGapDate)) {
      winner.maxGap = gap;
      winner.maxGapDate = t;
    }
    // upset: winner ELO < loser ELO
    const wElo = userMap.get(winner.login)?.elo ?? 1000;
    const lElo = userMap.get(loser.login)?.elo ?? 1000;
    const upsetGap = lElo - wElo;
    if (upsetGap > 0 && upsetGap > winner.biggestUpsetGap) {
      winner.biggestUpsetGap = upsetGap;
      winner.biggestUpsetVictim = loser.login;
    }
  }

  // Most freq opponent across the league (pair)
  let topPair: { a: string; b: string; n: number } | null = null;
  const pairCount = new Map<string, number>();
  for (const m of matches) {
    const [x, y] =
      m.playerALogin < m.playerBLogin
        ? [m.playerALogin, m.playerBLogin]
        : [m.playerBLogin, m.playerALogin];
    const k = `${x}|${y}`;
    pairCount.set(k, (pairCount.get(k) ?? 0) + 1);
  }
  for (const [k, n] of pairCount.entries()) {
    if (!topPair || n > topPair.n) {
      const [a, b] = k.split('|');
      topPair = { a: a ?? '', b: b ?? '', n };
    }
  }

  function avatarOf(login: string | null) {
    if (!login) return null;
    const u = userMap.get(login);
    return { login, imageUrl: u?.imageUrl ?? null };
  }

  function best<T extends Acc>(cmp: (x: T, y: T) => number, minPlayed = 0): T | null {
    let res: T | null = null;
    for (const a of acc.values() as IterableIterator<T>) {
      if (a.played < minPlayed) continue;
      if (!res || cmp(a, res) > 0) res = a;
    }
    return res;
  }

  const topG = best((a, b) => a.wins - b.wins);
  const biggestLoser = best((a, b) => a.losses - b.losses);
  const sniper = best((a, b) => {
    const wrA = a.played ? a.wins / a.played : 0;
    const wrB = b.played ? b.wins / b.played : 0;
    return wrA - wrB;
  }, 3);
  const marathonien = best((a, b) => a.played - b.played);
  const spectacle = best((a, b) => a.maxGap - b.maxGap);
  const pissetteMaster = best((a, b) => a.biggestUpsetGap - b.biggestUpsetGap);

  // Couard (most dodges) — from leaderboard
  const couard = [...lb].sort((a, b) => (b.dodgeCount ?? 0) - (a.dodgeCount ?? 0))[0];
  // Doyen (oldest createdAt) — we don't have createdAt on LeaderboardEntry; skip for now or use first registered = lowest ELO ties broken arbitrary
  // For simplicity, use the user with the most matches as proxy for "old". Or we can fetch /users which has createdAt.

  const out: TrophyResult[] = [];

  if (topG && topG.wins > 0) {
    out.push({
      emoji: '🏆',
      title: 'G.O.A.T',
      subtitle: 'Le plus de victoires',
      winner: avatarOf(topG.login),
      value: `${topG.wins} W`,
      color: 'gold',
    });
  }

  if (biggestLoser && biggestLoser.losses > 0) {
    out.push({
      emoji: '💀',
      title: 'Loooooooooser',
      subtitle: 'Le plus de défaites',
      winner: avatarOf(biggestLoser.login),
      value: `${biggestLoser.losses} L`,
      color: 'red',
    });
  }

  if (sniper && sniper.played >= 3) {
    const wr = Math.round((sniper.wins / sniper.played) * 100);
    out.push({
      emoji: '🎯',
      title: 'Sniper',
      subtitle: 'Meilleur win rate (min 3 matchs)',
      winner: avatarOf(sniper.login),
      value: `${wr}%`,
      hint: `${sniper.wins}/${sniper.played}`,
      color: 'cyan',
    });
  }

  if (marathonien && marathonien.played > 0) {
    out.push({
      emoji: '🔁',
      title: 'Marathonien',
      subtitle: 'Le plus de matchs joués',
      winner: avatarOf(marathonien.login),
      value: `${marathonien.played} matchs`,
      color: 'green',
    });
  }

  if (spectacle && spectacle.maxGap > 0) {
    out.push({
      emoji: '🎪',
      title: 'Spectacle',
      subtitle: 'Plus grosse marge en victoire',
      winner: avatarOf(spectacle.login),
      value: `+${spectacle.maxGap}`,
      color: 'magenta',
    });
  }

  if (pissetteMaster && pissetteMaster.biggestUpsetGap > 0) {
    out.push({
      emoji: '👑',
      title: 'Pissette Master',
      subtitle: 'Plus gros upset ELO',
      winner: avatarOf(pissetteMaster.login),
      value: `+${pissetteMaster.biggestUpsetGap} ELO`,
      hint: pissetteMaster.biggestUpsetVictim
        ? `vs ${pissetteMaster.biggestUpsetVictim}`
        : undefined,
      color: 'violet',
    });
  }

  if (couard && (couard.dodgeCount ?? 0) > 0) {
    out.push({
      emoji: '🏃',
      title: 'Le Couard',
      subtitle: 'Le plus de fuites',
      winner: avatarOf(couard.login),
      value: `${couard.dodgeCount} fuites`,
      color: 'crimson',
    });
  }

  if (topPair && topPair.n >= 2) {
    out.push({
      emoji: '🤝',
      title: 'Rivalité',
      subtitle: 'Paire la plus active',
      winner: null,
      value: `${topPair.a} vs ${topPair.b}`,
      hint: `${topPair.n} matchs`,
      color: 'bronze',
    });
  }

  // King of ELO — direct from leaderboard
  if (lb[0]) {
    out.push({
      emoji: '💎',
      title: "Elo KING",
      subtitle: 'Plus haut ELO actuel',
      winner: avatarOf(lb[0].login),
      value: `${lb[0].elo} ELO`,
      color: 'sapphire',
    });
  }

  return out;
}

function renderTrophees(): HTMLElement {
  const { wrap } = panel('Trophées', 'Récompenses légendaires');
  const trophies = computeTrophies();
  if (trophies.length === 0) {
    wrap.append(
      el(
        'div',
        { className: 'empty' },
        'Pas encore assez de matchs pour décerner des trophées.',
      ),
    );
    return wrap;
  }
  const grid = el('div', { className: 'trophy-grid' });
  for (const t of trophies) {
    const card = el('div', { className: `trophy-card tc-${t.color}` });
    const emoji = el('div', { className: 'trophy-emoji' }, t.emoji);
    const head = el('div', { className: 'trophy-head' });
    head.append(
      el('div', { className: 'trophy-title' }, t.title),
      el('div', { className: 'trophy-sub' }, t.subtitle),
    );
    card.append(emoji, head);

    if (t.winner) {
      const winnerLink = playerLink(
        t.winner.login,
        [
          avatarEl(t.winner.login, t.winner.imageUrl, 'trophy-av'),
          el('span', { className: 'trophy-name' }, t.winner.login),
        ],
        'player-link trophy-winner',
      );
      card.append(winnerLink);
    } else {
      const winner = el('div', { className: 'trophy-winner' });
      winner.append(el('span', { className: 'trophy-name' }, t.value));
      card.append(winner);
    }

    const valueRow = el('div', { className: 'trophy-value-row' });
    if (t.winner) {
      valueRow.append(el('span', { className: 'trophy-value' }, t.value));
    }
    if (t.hint) {
      valueRow.append(el('span', { className: 'trophy-hint' }, t.hint));
    }
    if (valueRow.childNodes.length > 0) card.append(valueRow);
    grid.append(card);
  }
  wrap.append(grid);
  return wrap;
}

/* ============ PLAYER (any league user) ============ */
function renderDeclareOpsBox(playerLogin: string): HTMLElement {
  const wrap = el('div', { className: 'ops-declare' });
  const me = state.me?.login;
  const opsM = state.opsMe;
  const opsP = state.opsForPlayer;

  const head = el('div', { className: 'ops-head' });
  head.append(
    el('span', { className: 'ops-skull' }, '☠'),
    el('span', { className: 'ops-label' }, 'OPS'),
  );
  wrap.append(head);

  if (!me || me === playerLogin) {
    wrap.append(
      el(
        'div',
        { className: 'ops-empty' },
        'Tu ne peux pas te déclarer toi-même comme ops.',
      ),
    );
    return wrap;
  }

  // If I'm already this player's ops owner
  if (opsM?.current && opsM.current.targetLogin === playerLogin) {
    wrap.append(
      el(
        'div',
        { className: 'ops-status ops-active' },
        `☠ ${playerLogin} est ton ops · ${fmtCountdown(opsM.current.expiresAt)} restants`,
      ),
    );
    return wrap;
  }

  // Reasons we can't declare
  const reasons: string[] = [];
  if (opsM?.current) {
    reasons.push(
      `Tu as déjà un ops actif (${opsM.current.targetLogin}) jusqu'au ${new Date(opsM.current.expiresAt).toLocaleDateString('fr-FR')}.`,
    );
  } else if (opsM?.canDeclareAt) {
    reasons.push(
      `Cooldown actif · prochain ops dispo dans ${fmtCountdown(opsM.canDeclareAt)}.`,
    );
  }
  if (opsP?.targetedBy && opsP.targetedBy.ownerLogin !== me) {
    reasons.push(
      `${playerLogin} est déjà l'ops de ${opsP.targetedBy.ownerLogin}.`,
    );
  }
  if (opsP?.owns) {
    reasons.push(
      `${playerLogin} a actuellement ${opsP.owns.targetLogin} comme ops.`,
    );
  }

  const canDeclare = reasons.length === 0;

  if (!canDeclare) {
    for (const r of reasons) {
      wrap.append(el('div', { className: 'ops-blocked' }, r));
    }
    return wrap;
  }

  const desc = el(
    'div',
    { className: 'ops-desc' },
    `Déclarer ${playerLogin} comme ton ops le verrouille pour 1 semaine. Il ne pourra pas avoir d'ops pendant ce temps. Cooldown de 1 semaine après.`,
  );
  const btn = el(
    'button',
    {
      className: 'ops-cta',
      onclick: async () => {
        const ok = await confirmDialog({
          title: `Déclarer ${playerLogin} comme ton ops ?`,
          message: `${playerLogin} sera ton ops pendant 7 jours. Tu seras en cooldown 7 jours après. Action unilatérale, pas d'acceptation requise.`,
          confirmLabel: 'Confirmer',
          cancelLabel: 'Annuler',
        });
        if (!ok) return;
        try {
          await api.declareOps(playerLogin);
          flash(`☠ ${playerLogin} est ton ops`);
          await loadPlayer(playerLogin);
        } catch (err) {
          state.error = err instanceof Error ? err.message : String(err);
          render();
        }
      },
    },
    `☠ Déclarer ${playerLogin} comme mon ops`,
  );
  wrap.append(desc, btn);
  return wrap;
}

function renderPlayer(): HTMLElement {
  const { wrap } = panel(
    state.playerLogin ? state.playerLogin : 'Joueur',
    'Profil 42 League',
  );

  if (!state.playerLogin) {
    wrap.append(el('div', { className: 'empty' }, 'Aucun joueur sélectionné.'));
    return wrap;
  }
  if (state.playerLoading) {
    wrap.append(el('div', { className: 'loading' }, t('common.loading')));
    return wrap;
  }
  if (!state.playerData) {
    wrap.append(
      el(
        'div',
        { className: 'empty' },
        `${state.playerLogin} n'est pas inscrit dans la league (ou erreur réseau).`,
      ),
    );
    return wrap;
  }

  const p = state.playerData;
  const initial = (p.user.login[0] ?? '?').toUpperCase();

  const hero = el('div', { className: 'hero' });
  const ident = el('div', { className: 'ident' });
  const meta = el('div', { className: 'meta' });
  meta.append(
    document.createTextNode(`${t('profil.campus')} · ${p.user.campus ?? '—'}`),
    el('span', { className: 'elo-badge' }, `${p.user.elo} ELO`),
  );
  ident.append(el('div', { className: 'login' }, p.user.login), meta);
  if (p.user.title) {
    ident.append(
      el(
        'div',
        { className: 'player-title' },
        `« ${p.user.title} »`,
      ),
    );
  }
  hero.append(
    p.user.imageUrl
      ? avatarEl(p.user.login, p.user.imageUrl, 'avatar')
      : el('div', { className: 'avatar' }, initial),
    ident,
  );
  wrap.append(hero);

  /* Admin: set/clear title */
  if (state.me?.isAdmin) {
    const titleBox = el('div', {});
    titleBox.style.cssText =
      'margin-top: 18px; padding: 14px; background: var(--bg-2); border: 1px solid var(--border); border-radius: 4px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;';
    titleBox.append(
      el(
        'span',
        {
          style:
            'font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--gold);',
        } as Record<string, unknown>,
        '★ ADMIN · Titre',
      ),
    );
    const titleInput = el('input', {
      type: 'text',
      placeholder: 'ex. Le Maître, Pissette King…',
      value: p.user.title ?? '',
    }) as HTMLInputElement;
    titleInput.style.cssText = 'flex: 1; min-width: 200px;';
    titleInput.maxLength = 40;
    const saveBtn = el(
      'button',
      {
        className: 'sm',
        onclick: async () => {
          try {
            const t = titleInput.value.trim();
            await api.setUserTitle(p.user.login, t || null);
            flash(t ? `Titre défini : « ${t} »` : 'Titre retiré');
            await loadPlayer(p.user.login);
            await load();
          } catch (err) {
            state.error = err instanceof Error ? err.message : String(err);
            render();
          }
        },
      },
      'Enregistrer',
    );
    const clearBtn = el(
      'button',
      {
        className: 'sm ghost',
        onclick: async () => {
          try {
            await api.setUserTitle(p.user.login, null);
            flash('Titre retiré');
            await loadPlayer(p.user.login);
            await load();
          } catch (err) {
            state.error = err instanceof Error ? err.message : String(err);
            render();
          }
        },
      },
      'Effacer',
    );
    titleBox.append(titleInput, saveBtn, clearBtn);
    wrap.append(titleBox);
  }

  /* OPS — declare this player as my ops */
  wrap.append(renderDeclareOpsBox(p.user.login));

  const grid = el('div', { className: 'stats' });
  grid.style.cssText = 'margin-top: 22px;';
  const winRate =
    p.wins + p.losses === 0
      ? 0
      : Math.round((p.wins / (p.wins + p.losses)) * 100);
  grid.append(
    statCard(String(p.rank ?? '—'), 'Rang', 'teal'),
    statCard(String(p.user.matchesPlayed), 'Matchs ELO', 'teal'),
    statCard(`${winRate}%`, 'Win rate', winRate >= 50 ? 'win' : 'loss'),
    statCard(String(p.user.dodgeCount ?? 0), 'Fuites', p.user.dodgeCount ? 'loss' : ''),
  );
  wrap.append(grid);

  const kv = el('div', {});
  kv.style.cssText = 'margin-top: 18px;';
  kv.append(
    el(
      'div',
      { className: 'kv-row' },
      el('span', { className: 'k' }, 'Victoires'),
      el(
        'span',
        { className: 'v', style: 'color: var(--gold)' } as Record<string, unknown>,
        String(p.wins),
      ),
    ),
    el(
      'div',
      { className: 'kv-row' },
      el('span', { className: 'k' }, 'Défaites'),
      el(
        'span',
        { className: 'v', style: 'color: var(--red)' } as Record<string, unknown>,
        String(p.losses),
      ),
    ),
    el(
      'div',
      { className: 'kv-row' },
      el('span', { className: 'k' }, 'Inscrit depuis'),
      el(
        'span',
        { className: 'v' },
        new Date(p.user.createdAt).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
      ),
    ),
  );
  wrap.append(kv);

  if (p.recent.length > 0) {
    const sep = el('div', {});
    sep.style.cssText =
      'border-top: 1px solid var(--border-soft); margin: 24px 0;';
    wrap.append(sep);
    wrap.append(
      el(
        'div',
        {
          className: 'panel-title',
          style: 'margin-bottom: 12px;',
        } as Record<string, unknown>,
        'Derniers matchs',
      ),
    );
    const table = el('table', { className: 'matches-table' });
    const thead = el('thead');
    thead.append(
      el(
        'tr',
        {},
        el('th', {}, 'Date'),
        el('th', {}, 'Adversaire'),
        el('th', {}, 'Score'),
        el('th', {}, 'Résultat'),
      ),
    );
    const tbody = el('tbody');
    for (const m of p.recent.slice(0, 20)) {
      const isA = m.playerALogin === p.user.login;
      const opp = isA ? m.playerBLogin : m.playerALogin;
      const won = (isA && m.winner === 'A') || (!isA && m.winner === 'B');
      const sYou = isA ? m.scoreA : m.scoreB;
      const sOpp = isA ? m.scoreB : m.scoreA;
      const date = new Date(m.playedAt).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      });
      const oppCell = el('td', {});
      const oppSpan = el('span', {}, opp);
      oppSpan.style.cursor = 'help';
      attachTooltip(oppSpan, opp);
      oppCell.append(oppSpan);
      tbody.append(
        el(
          'tr',
          {},
          el('td', {}, date),
          oppCell,
          el('td', {}, `${sYou}–${sOpp}`),
          el(
            'td',
            { className: won ? 'res-win' : 'res-loss' },
            won ? 'VICTOIRE' : 'DÉFAITE',
          ),
        ),
      );
    }
    table.append(thead, tbody);
    wrap.append(table);
  }

  return wrap;
}

async function loadPlayer(login: string) {
  state.playerLoading = true;
  state.playerData = null;
  state.opsForPlayer = null;
  render();
  try {
    const [profile, opsP, opsM] = await Promise.all([
      api.userProfile(login),
      api.opsForUser(login).catch(() => null),
      api.opsMe().catch(() => null),
    ]);
    state.playerData = profile;
    state.opsForPlayer = opsP;
    state.opsMe = opsM;
  } catch {
    state.playerData = null;
  } finally {
    state.playerLoading = false;
    render();
  }
}

/* ============ HISTORIQUE ============ */
function renderHistorique(): HTMLElement {
  const { wrap } = panel('Historique', '50 derniers matchs');
  const myLogin = state.me?.login;
  const myMatches = state.matches.filter(
    (m) => m.playerALogin === myLogin || m.playerBLogin === myLogin,
  );
  if (myMatches.length === 0) {
    wrap.append(el('div', { className: 'empty' }, 'Aucun match joué pour l\'instant.'));
    return wrap;
  }
  const table = el('table', { className: 'matches-table' });
  const thead = el('thead');
  thead.append(
    el(
      'tr',
      {},
      el('th', {}, 'Date'),
      el('th', {}, 'Adversaire'),
      el('th', {}, 'Score'),
      el('th', {}, 'Résultat'),
      el('th', {}, 'Δ ELO'),
    ),
  );
  const tbody = el('tbody');
  for (const m of myMatches.slice(0, 50)) {
    const youAreA = m.playerALogin === myLogin;
    const won = (youAreA && m.winner === 'A') || (!youAreA && m.winner === 'B');
    const opponent = youAreA ? m.playerBLogin : m.playerALogin;
    const scoreYou = youAreA ? m.scoreA : m.scoreB;
    const scoreOpp = youAreA ? m.scoreB : m.scoreA;
    const delta = youAreA ? m.deltaA : m.deltaB;
    const deltaCls = delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'delta-zero';
    const date = new Date(m.playedAt).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
    const oppCell = el('td', {});
    oppCell.append(playerLink(opponent, [opponent]));
    const row = el(
      'tr',
      { className: m.countedForElo ? '' : 'uncounted' },
      el('td', {}, date),
      oppCell,
      el('td', {}, `${scoreYou}–${scoreOpp}`),
      el('td', { className: won ? 'res-win' : 'res-loss' }, won ? 'VICTOIRE' : 'DÉFAITE'),
      el(
        'td',
        { className: deltaCls },
        m.countedForElo ? `${delta >= 0 ? '+' : ''}${delta}` : '—',
      ),
    );
    tbody.append(row);
  }
  table.append(thead, tbody);
  wrap.append(table);
  return wrap;
}

/* ============ REGLAGES ============ */
function pillSelector<V extends string>(opts: {
  value: V;
  choices: { value: V; label: string }[];
  onChange: (v: V) => void;
}): HTMLElement {
  const wrap = el('div', { className: 'pill-group' });
  for (const c of opts.choices) {
    const btn = el(
      'button',
      {
        className: 'pill' + (c.value === opts.value ? ' active' : ''),
        onclick: () => opts.onChange(c.value),
      },
      c.label,
    );
    wrap.append(btn);
  }
  return wrap;
}

function renderReglages(): HTMLElement {
  const { wrap } = panel(t('panel.settings.title'));

  /* THEME */
  const themeField = el('div', { className: 'field' });
  themeField.append(el('label', {}, t('settings.theme').toUpperCase()));
  themeField.append(
    pillSelector<Theme>({
      value: currentTheme(),
      choices: [
        { value: 'dark', label: t('settings.theme.dark') },
        { value: 'light', label: t('settings.theme.light') },
        { value: 'system', label: t('settings.theme.system') },
      ],
      onChange: async (v) => {
        await setTheme(v);
        render();
      },
    }),
  );
  wrap.append(themeField);

  /* LANGUAGE */
  const langField = el('div', { className: 'field' });
  langField.style.marginTop = '18px';
  langField.append(el('label', {}, t('settings.lang').toUpperCase()));
  langField.append(
    pillSelector<Lang>({
      value: currentLang(),
      choices: [
        { value: 'fr', label: t('settings.lang.fr') },
        { value: 'en', label: t('settings.lang.en') },
      ],
      onChange: async (v) => {
        await setLang(v);
        render();
      },
    }),
  );
  wrap.append(langField);

  const sep = el('div', {});
  sep.style.cssText =
    'border-top: 1px solid var(--border-soft); margin: 24px 0;';
  wrap.append(sep);

  wrap.append(
    el(
      'div',
      { className: 'panel-title', style: 'margin-bottom: 12px;' } as Record<
        string,
        unknown
      >,
      t('settings.account'),
    ),
  );
  const buttons = el('div', { className: 'row' });
  const changeAcc = el(
    'button',
    {
      onclick: async () => {
        state.connecting = true;
        state.error = null;
        render();
        try {
          await authBridge.logout();
          const res = await authBridge.login();
          state.authenticated = res.authenticated;
          if (res.authenticated) flash(t('settings.reconnected') + res.login);
          await load();
        } catch (err) {
          state.error = err instanceof Error ? err.message : String(err);
        } finally {
          state.connecting = false;
          render();
        }
      },
    },
    state.connecting ? spinner() : document.createTextNode(''),
    state.connecting ? t('settings.connecting') : t('settings.changeAccount'),
  );
  const logout = el(
    'button',
    {
      className: 'danger',
      onclick: async () => {
        await authBridge.logout();
        state.authenticated = false;
        state.me = null;
        state.matches = [];
        state.pending = [];
        state.challenges = [];
        state.leaderboard = [];
        flash(t('settings.loggedOut'));
      },
    },
    t('settings.logout'),
  );
  buttons.append(changeAcc, logout);
  wrap.append(buttons);

  return wrap;
}

/* ============ ANON ============ */
function renderAnon(): HTMLElement {
  const { wrap } = panel('Connexion requise');
  const block = el('div', { className: 'anon-block' });
  block.append(
    el('div', { className: 'ring' }, '42'),
    el(
      'p',
      {},
      'Connecte-toi avec ton compte 42 pour défier tes camarades, suivre ton ELO et grimper au classement.',
    ),
    el(
      'button',
      {
        disabled: state.connecting,
        onclick: async () => {
          state.connecting = true;
          state.error = null;
          render();
          try {
            const res = await authBridge.login();
            state.authenticated = res.authenticated;
            if (res.authenticated) flash(`Bienvenue @${res.login}`);
            await load();
          } catch (err) {
            state.error = err instanceof Error ? err.message : String(err);
          } finally {
            state.connecting = false;
            render();
          }
        },
      },
      state.connecting ? spinner() : document.createTextNode(''),
      state.connecting ? 'Connexion…' : 'Se connecter avec 42',
    ),
  );
  wrap.append(block);
  return wrap;
}

/* ============ MAIN RENDER ============ */
function render() {
  topbarLogin.textContent =
    state.authenticated && state.me?.login ? state.me.login : 'non connecté';
  renderSidebar();
  root.innerHTML = '';

  if (state.loading) {
    root.append(el('div', { className: 'loading' }, 'Initialisation…'));
    return;
  }
  if (state.flash) root.append(el('div', { className: 'toast' }, state.flash));
  if (state.error) root.append(el('div', { className: 'error' }, state.error));
  if (!state.authenticated) {
    root.append(renderAnon());
    return;
  }

  switch (state.section) {
    case 'defis':
      root.append(renderDefis());
      break;
    case 'leaderboard':
      root.append(renderLeaderboard());
      break;
    case 'tournois':
      root.append(renderTournois());
      break;
    case 'trophees':
      root.append(renderTrophees());
      break;
    case 'profil':
      root.append(renderProfil());
      break;
    case 'historique':
      root.append(renderHistorique());
      break;
    case 'reglages':
      root.append(renderReglages());
      break;
    case 'player':
      root.append(renderPlayer());
      break;
  }
}

/* ============ LOAD ============ */
async function load() {
  const status = await authBridge.status().catch(() => ({
    authenticated: false,
    login: null as string | null,
  }));
  state.authenticated = status.authenticated;
  if (!state.authenticated) {
    state.me = null;
    state.matches = [];
    state.pending = [];
    state.challenges = [];
    state.leaderboard = [];
    render();
    return;
  }
  try {
    const [me, matches, pending, challenges, leaderboard, tournaments, opsMe, allOps] =
      await Promise.all([
        api.me(),
        api.playedMatches(),
        api.pendingMatches(),
        api.challenges(),
        api.leaderboard(),
        api.tournaments(),
        api.opsMe().catch(() => null),
        api.opsList().catch(() => [] as Ops[]),
      ]);
    state.me = me;
    state.matches = matches;
    state.pending = pending;
    state.challenges = challenges;
    state.leaderboard = leaderboard;
    state.tournaments = tournaments;
    state.opsMe = opsMe;
    state.allOps = allOps;
    setTooltipData(leaderboard, matches, allOps);
  } catch (err) {
    if (err instanceof AuthError) {
      state.authenticated = false;
    } else {
      state.error = err instanceof Error ? err.message : String(err);
    }
  }
  render();
}

function applyHash() {
  const h = parseHash();
  state.section = h.section;
  state.playerLogin = h.playerLogin;
  state.selectedTournamentId = h.tournamentId;
  if (h.section === 'player' && h.playerLogin) {
    loadPlayer(h.playerLogin);
  } else if (h.section === 'tournois') {
    loadTournaments();
    if (h.tournamentId) {
      loadTournament(h.tournamentId);
    } else {
      state.selectedTournament = null;
    }
  }
}

window.addEventListener('hashchange', () => {
  applyHash();
  render();
});

(async () => {
  await loadPrefs();
  applyTheme();
  watchSystemTheme();
  applyHash();
  await load();
  state.loading = false;
  render();
})();
