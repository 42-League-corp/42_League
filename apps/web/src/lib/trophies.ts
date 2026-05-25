import type { LeaderboardEntry, PlayedMatch } from './api';

export type TrophyColor =
  | 'gold'
  | 'red'
  | 'cyan'
  | 'violet'
  | 'magenta'
  | 'bronze'
  | 'crimson'
  | 'green'
  | 'sapphire';

export interface TrophyResult {
  emoji: string;
  title: string;
  subtitle: string;
  winner: { login: string; imageUrl: string | null } | null;
  value: string;
  hint?: string;
  color: TrophyColor;
}

interface Acc {
  login: string;
  wins: number;
  losses: number;
  played: number;
  maxGap: number;
  maxGapDate: number;
  opponents: Map<string, number>;
  biggestUpsetGap: number;
  biggestUpsetVictim: string | null;
}

export function computeTrophies(
  leaderboard: LeaderboardEntry[],
  matches: PlayedMatch[],
): TrophyResult[] {
  const userMap = new Map(leaderboard.map((u) => [u.login, u]));
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
    const ts = new Date(m.playedAt).getTime();
    if (gap > winner.maxGap || (gap === winner.maxGap && ts > winner.maxGapDate)) {
      winner.maxGap = gap;
      winner.maxGapDate = ts;
    }
    const wElo = userMap.get(winner.login)?.elo ?? 1000;
    const lElo = userMap.get(loser.login)?.elo ?? 1000;
    const upsetGap = lElo - wElo;
    if (upsetGap > 0 && upsetGap > winner.biggestUpsetGap) {
      winner.biggestUpsetGap = upsetGap;
      winner.biggestUpsetVictim = loser.login;
    }
  }

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

  function best(cmp: (x: Acc, y: Acc) => number, minPlayed = 0): Acc | null {
    let res: Acc | null = null;
    for (const a of acc.values()) {
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
  const couard = [...leaderboard].sort(
    (a, b) => (b.dodgeCount ?? 0) - (a.dodgeCount ?? 0),
  )[0];

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
  if (leaderboard[0]) {
    out.push({
      emoji: '💎',
      title: 'Elo KING',
      subtitle: 'Plus haut ELO actuel',
      winner: avatarOf(leaderboard[0].login),
      value: `${leaderboard[0].elo} ELO`,
      color: 'sapphire',
    });
  }
  return out;
}
