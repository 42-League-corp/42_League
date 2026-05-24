import { api, AuthError } from '../lib/api.js';

const BLOCK_ID = 'league-42-profile-link';
const SKILL_ID = 'league-42-babyfoot-skill';
const STYLE_ID = 'league-42-profile-link-style';

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    #${BLOCK_ID} {
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      margin-left: 12px !important;
      padding: 6px 12px !important;
      background: #00babc !important;
      color: #ffffff !important;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
      font-size: 12px !important;
      font-weight: 800 !important;
      letter-spacing: 0.1em !important;
      text-transform: uppercase !important;
      text-decoration: none !important;
      text-shadow: 0 1px 1px rgba(0, 0, 0, 0.35) !important;
      border-radius: 3px !important;
      border: 2px solid #ffffff !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25),
                  0 0 0 1px #00babc,
                  0 0 12px rgba(0, 186, 188, 0.5) !important;
      cursor: pointer !important;
      transition: filter 120ms, transform 80ms !important;
      vertical-align: middle !important;
      line-height: 1.1 !important;
    }
    #${BLOCK_ID}:hover {
      filter: brightness(1.08) !important;
      transform: translateY(-1px) !important;
      background: #00d9dc !important;
    }
    #${BLOCK_ID}::before {
      content: '⚔' !important;
      color: #ffffff !important;
      font-size: 13px !important;
      text-shadow: 0 1px 1px rgba(0, 0, 0, 0.35) !important;
    }
    #${BLOCK_ID} .l42-elo {
      background: rgba(0, 0, 0, 0.28) !important;
      color: #ffffff !important;
      padding: 2px 7px !important;
      border-radius: 2px !important;
      font-variant-numeric: tabular-nums !important;
      font-weight: 700 !important;
    }
    #${SKILL_ID} {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px dashed #ddd;
    }
    #${SKILL_ID} .l42-skill-row {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 4px;
    }
    #${SKILL_ID} .l42-skill-label {
      font-size: 12px; font-weight: 600; color: #00babc;
      letter-spacing: 0.04em; text-transform: uppercase;
    }
    #${SKILL_ID} .l42-skill-rank {
      font-size: 11px; color: #888;
      margin-left: auto;
      font-variant-numeric: tabular-nums;
    }
    #${SKILL_ID} .l42-skill-title {
      color: #c9a227; font-style: italic; font-weight: 600;
      font-size: 11px;
    }
  `;
  document.head.appendChild(s);
}

function extractLogin(): string | null {
  // URLs: https://profile.intra.42.fr/users/<login> or .../users/<login>/...
  const m = location.pathname.match(/^\/users\/([a-z0-9_-]+)(?:\/|$)/i);
  if (m && m[1]) return m[1].toLowerCase();
  return null;
}

function findAnchor(): HTMLElement | null {
  // Try the title-selector login button on profile page
  const loginBtn = document.querySelector<HTMLElement>('.btn-group#title-selector .login[data-login]');
  if (loginBtn?.parentElement?.parentElement) return loginBtn.parentElement.parentElement;
  // Fallback: the h2.profile-name
  const h2 = document.querySelector<HTMLElement>('h2.profile-name');
  return h2;
}

function injectLink(login: string, elo: number) {
  if (document.getElementById(BLOCK_ID)) return;
  const anchor = findAnchor();
  if (!anchor) return;
  ensureStyle();
  const link = document.createElement('a');
  link.id = BLOCK_ID;
  link.href = chrome.runtime.getURL(
    `src/options/index.html#player=${encodeURIComponent(login)}`,
  );
  link.target = '_blank';
  link.rel = 'noreferrer noopener';
  link.title = '42 League — voir le profil complet';
  const label = document.createElement('span');
  label.textContent = '42 League';
  const eloChip = document.createElement('span');
  eloChip.className = 'l42-elo';
  eloChip.textContent = `${elo} ELO`;
  link.append(label, eloChip);
  anchor.append(link);
}

function findSkillsCard(): HTMLElement | null {
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>('.container-inner-item.boxed, .boxed'),
  );
  for (const c of cards) {
    const h = c.querySelector<HTMLElement>('.profile-title');
    if (!h) continue;
    const txt = (h.textContent ?? '').trim().toLowerCase();
    if (txt.startsWith('skills')) return c;
  }
  return null;
}

function injectSkill(opts: {
  rank: number;
  total: number;
  wins: number;
  losses: number;
  title: string | null;
}) {
  if (document.getElementById(SKILL_ID)) return;
  const card = findSkillsCard();
  if (!card) return;
  ensureStyle();

  // Level 0..21 (intra-style cap), proportional to ranking
  const ratio = opts.total > 1 ? 1 - (opts.rank - 1) / (opts.total - 1) : 1;
  const level = Math.max(0, Math.round(ratio * 21));
  const pct = Math.round(ratio * 100);

  const wrap = document.createElement('div');
  wrap.id = SKILL_ID;

  const head = document.createElement('div');
  head.className = 'l42-skill-row';
  const label = document.createElement('span');
  label.className = 'l42-skill-label';
  label.textContent = '⚔ Babyfoot 42 League';
  const rank = document.createElement('span');
  rank.className = 'l42-skill-rank';
  rank.textContent = `#${opts.rank}/${opts.total} · ${opts.wins}W ${opts.losses}L`;
  head.append(label, rank);
  wrap.append(head);

  // Reuse intra's progress markup so it inherits their style
  const a = document.createElement('a');
  a.className = 'progress-container';
  a.href = chrome.runtime.getURL(
    `src/options/index.html#player=${encodeURIComponent((opts as unknown as { login?: string }).login ?? '')}`,
  );
  a.target = '_blank';
  a.rel = 'noreferrer noopener';

  const bar = document.createElement('div');
  bar.className = 'progress double';
  const inner = document.createElement('div');
  inner.className = 'progress-bar';
  inner.setAttribute('role', 'progressbar');
  inner.style.cssText = `width: ${pct}%; background: linear-gradient(90deg, #00babc, #00d9dc); box-shadow: 0 0 8px rgba(0,217,220,0.4);`;
  const txt = document.createElement('div');
  txt.className = 'on-progress';
  txt.textContent = `level ${level} - ${pct}%`;
  bar.append(inner, txt);
  a.append(bar);
  wrap.append(a);

  if (opts.title) {
    const t = document.createElement('div');
    t.className = 'l42-skill-title';
    t.style.cssText = 'margin-top: 4px;';
    t.textContent = `« ${opts.title} »`;
    wrap.append(t);
  }

  card.append(wrap);
}

async function bootstrap() {
  const login = extractLogin();
  if (!login) return;
  try {
    const [profile, lb] = await Promise.all([
      api.userProfile(login),
      api.leaderboard(),
    ]);
    injectLink(login, profile.user.elo);
    if (profile.rank != null && lb.length > 0) {
      injectSkill({
        rank: profile.rank,
        total: lb.length,
        wins: profile.wins,
        losses: profile.losses,
        title: profile.user.title,
      });
    }
    // re-inject skill after a delay in case intra rerenders the Skills card
    setTimeout(() => {
      if (!document.getElementById(SKILL_ID) && profile.rank != null) {
        injectSkill({
          rank: profile.rank,
          total: lb.length,
          wins: profile.wins,
          losses: profile.losses,
          title: profile.user.title,
        });
      }
    }, 1500);
  } catch (err) {
    if (err instanceof AuthError) return;
    // 404 = user not in league: silently skip
  }
}

bootstrap().catch(() => {});

// Re-run on intra's pjax/turbolinks navigation
let lastPath = location.pathname;
new MutationObserver(() => {
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    document.getElementById(BLOCK_ID)?.remove();
    document.getElementById(SKILL_ID)?.remove();
    bootstrap().catch(() => {});
  }
}).observe(document.body, { childList: true, subtree: true });
