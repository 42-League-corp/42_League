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
  /** false → personne ne détient ce trophée (carte grisée). */
  earned: boolean;
}

interface Acc {
  login: string;
  wins: number;
  losses: number;
  played: number;
  maxGap: number;
  maxGapDate: number;
  biggestUpsetGap: number;
  biggestUpsetVictim: string | null;
  perfectWins: number; // gagné 10-0
  closeWins: number; // gagné 10-9
  negativeWins: number; // gagné 10 contre un score négatif
  annihilations: number; // gagné 10 à -10 (ou pire)
  comebacks: number; // gagné alors que l'adversaire avait ≥ 7
  zeroLosses: number; // perdu en marquant 0
  negativeFinishes: number; // perdu en finissant dans le négatif
  nightGames: number; // matchs joués entre 0h et 6h
  curWinStreak: number;
  maxWinStreak: number;
  curLossStreak: number;
  maxLossStreak: number;
  beaten: Map<string, number>; // adversaire battu → nb de victoires
  days: Map<string, number>; // jour ISO → nb de matchs
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
        biggestUpsetGap: 0,
        biggestUpsetVictim: null,
        perfectWins: 0,
        closeWins: 0,
        negativeWins: 0,
        annihilations: 0,
        comebacks: 0,
        zeroLosses: 0,
        negativeFinishes: 0,
        nightGames: 0,
        curWinStreak: 0,
        maxWinStreak: 0,
        curLossStreak: 0,
        maxLossStreak: 0,
        beaten: new Map(),
        days: new Map(),
      };
      acc.set(login, a);
    }
    return a;
  };

  // Tri chronologique (indispensable pour les séries en cours).
  const sorted = [...matches].sort(
    (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime(),
  );

  for (const m of sorted) {
    const a = ensure(m.playerALogin);
    const b = ensure(m.playerBLogin);
    a.played++;
    b.played++;
    const winner = m.winner === 'A' ? a : b;
    const loser = m.winner === 'A' ? b : a;
    winner.wins++;
    loser.losses++;

    // Séries en cours
    winner.curWinStreak++;
    winner.curLossStreak = 0;
    if (winner.curWinStreak > winner.maxWinStreak) winner.maxWinStreak = winner.curWinStreak;
    loser.curLossStreak++;
    loser.curWinStreak = 0;
    if (loser.curLossStreak > loser.maxLossStreak) loser.maxLossStreak = loser.curLossStreak;

    // Adversaires battus
    winner.beaten.set(loser.login, (winner.beaten.get(loser.login) ?? 0) + 1);

    const winnerScore = m.winner === 'A' ? m.scoreA : m.scoreB;
    const loserScore = m.winner === 'A' ? m.scoreB : m.scoreA;

    const gap = Math.abs(m.scoreA - m.scoreB);
    const d = new Date(m.playedAt);
    const ts = d.getTime();
    if (gap > winner.maxGap || (gap === winner.maxGap && ts > winner.maxGapDate)) {
      winner.maxGap = gap;
      winner.maxGapDate = ts;
    }

    // Heure / jour
    const hour = d.getHours();
    if (hour < 6) {
      a.nightGames++;
      b.nightGames++;
    }
    const dayKey = d.toISOString().slice(0, 10);
    a.days.set(dayKey, (a.days.get(dayKey) ?? 0) + 1);
    b.days.set(dayKey, (b.days.get(dayKey) ?? 0) + 1);

    // Exploits du gagnant (la game se gagne à 10)
    if (winnerScore === 10) {
      if (loserScore === 0) winner.perfectWins++; // 10-0
      if (loserScore === 9) winner.closeWins++; // 10-9
      if (loserScore < 0) winner.negativeWins++; // 10 à négatif
      if (loserScore <= -10) winner.annihilations++; // 10 à -10 (ou pire)
      if (loserScore >= 7) winner.comebacks++; // remontée serrée
    }
    // Misères du perdant
    if (loserScore === 0) loser.zeroLosses++; // perdu sans marquer
    if (loserScore < 0) loser.negativeFinishes++; // fini dans le négatif

    const wElo = userMap.get(winner.login)?.elo ?? 1000;
    const lElo = userMap.get(loser.login)?.elo ?? 1000;
    const upsetGap = lElo - wElo;
    if (upsetGap > 0 && upsetGap > winner.biggestUpsetGap) {
      winner.biggestUpsetGap = upsetGap;
      winner.biggestUpsetVictim = loser.login;
    }
  }

  // Paire la plus active (rivalité)
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

  function maxOf(m: Map<string, number>): { key: string; val: number } | null {
    let best: { key: string; val: number } | null = null;
    for (const [key, val] of m) {
      if (!best || val > best.val) best = { key, val };
    }
    return best;
  }

  /** Construit un trophée "leader d'une métrique" : grisé si personne ne dépasse 0. */
  function metricTrophy(opts: {
    emoji: string;
    title: string;
    subtitle: string;
    color: TrophyColor;
    pick: (a: Acc) => number;
    format: (v: number) => string;
    minPlayed?: number;
  }): TrophyResult {
    const leader = best((a, b) => opts.pick(a) - opts.pick(b), opts.minPlayed ?? 0);
    const v = leader ? opts.pick(leader) : 0;
    const earned = !!leader && v > 0;
    return {
      emoji: opts.emoji,
      title: opts.title,
      subtitle: opts.subtitle,
      color: opts.color,
      winner: earned ? avatarOf(leader!.login) : null,
      value: earned ? opts.format(v) : '—',
      earned,
    };
  }

  const out: TrophyResult[] = [];

  // ─── Classement / ELO ──────────────────────────────────────────────
  const champion = leaderboard[0];
  out.push({
    emoji: '💎',
    title: 'Elo KING',
    subtitle: 'Plus haut ELO actuel',
    color: 'sapphire',
    winner: champion ? avatarOf(champion.login) : null,
    value: champion ? `${champion.elo} ELO` : '—',
    earned: !!champion,
  });

  // ─── Performances positives ────────────────────────────────────────
  out.push(
    metricTrophy({
      emoji: '🏆',
      title: 'G.O.A.T',
      subtitle: 'Le plus de victoires',
      color: 'gold',
      pick: (a) => a.wins,
      format: (v) => `${v} W`,
    }),
  );
  out.push(
    metricTrophy({
      emoji: '🎯',
      title: 'Sniper',
      subtitle: 'Meilleur win rate (min 3 matchs)',
      color: 'cyan',
      minPlayed: 3,
      pick: (a) => (a.played ? a.wins / a.played : 0),
      format: (v) => `${Math.round(v * 100)}%`,
    }),
  );
  out.push(
    metricTrophy({
      emoji: '🔥',
      title: 'En feu',
      subtitle: 'Plus longue série de victoires',
      color: 'gold',
      pick: (a) => a.maxWinStreak,
      format: (v) => `${v} d'affilée`,
    }),
  );
  out.push(
    metricTrophy({
      emoji: '💥',
      title: 'Destroyer',
      subtitle: 'Le plus de victoires 10-0',
      color: 'magenta',
      pick: (a) => a.perfectWins,
      format: (v) => `${v}× 10-0`,
    }),
  );
  out.push(
    metricTrophy({
      emoji: '⚖️',
      title: 'Le Serré',
      subtitle: 'Le plus de victoires 10-9',
      color: 'green',
      pick: (a) => a.closeWins,
      format: (v) => `${v}× 10-9`,
    }),
  );
  out.push(
    metricTrophy({
      emoji: '📉',
      title: 'Negativer',
      subtitle: 'Le plus de victoires 10 contre un score négatif',
      color: 'violet',
      pick: (a) => a.negativeWins,
      format: (v) => `${v}× 10-(−)`,
    }),
  );
  out.push(
    metricTrophy({
      emoji: '☠️',
      title: 'Annihilateur',
      subtitle: 'Le plus de victoires 10 à -10 (ou pire)',
      color: 'crimson',
      pick: (a) => a.annihilations,
      format: (v) => `${v}× 10 à -10`,
    }),
  );
  out.push(
    metricTrophy({
      emoji: '🎪',
      title: 'Spectacle',
      subtitle: 'Plus grosse marge en victoire',
      color: 'bronze',
      pick: (a) => a.maxGap,
      format: (v) => `+${v}`,
    }),
  );
  out.push(
    metricTrophy({
      emoji: '🗡️',
      title: 'Chasseur de primes',
      subtitle: "Le plus d'adversaires différents battus",
      color: 'cyan',
      pick: (a) => a.beaten.size,
      format: (v) => `${v} victimes`,
    }),
  );

  // Némésis — le plus de victoires contre un même joueur (avec la victime)
  {
    let leader: Acc | null = null;
    let leaderVal = 0;
    let leaderVictim: string | null = null;
    for (const a of acc.values()) {
      const top = maxOf(a.beaten);
      if (top && top.val > leaderVal) {
        leader = a;
        leaderVal = top.val;
        leaderVictim = top.key;
      }
    }
    const earned = !!leader && leaderVal >= 2;
    out.push({
      emoji: '😈',
      title: 'Némésis',
      subtitle: 'Le plus de victoires contre un même joueur',
      color: 'crimson',
      winner: earned ? avatarOf(leader!.login) : null,
      value: earned ? `${leaderVal}×` : '—',
      hint: earned && leaderVictim ? `victime : ${leaderVictim}` : undefined,
      earned,
    });
  }

  // ─── Misères / honte ───────────────────────────────────────────────
  out.push(
    metricTrophy({
      emoji: '💀',
      title: 'Loooooooooser',
      subtitle: 'Le plus de défaites',
      color: 'red',
      pick: (a) => a.losses,
      format: (v) => `${v} L`,
    }),
  );
  out.push(
    metricTrophy({
      emoji: '🥶',
      title: 'Glissade',
      subtitle: 'Plus longue série de défaites',
      color: 'sapphire',
      pick: (a) => a.maxLossStreak,
      format: (v) => `${v} d'affilée`,
    }),
  );
  out.push(
    metricTrophy({
      emoji: '🧊',
      title: 'Zéro Absolu',
      subtitle: 'Le plus de défaites en marquant 0',
      color: 'cyan',
      pick: (a) => a.zeroLosses,
      format: (v) => `${v}× 0 pt`,
    }),
  );
  out.push(
    metricTrophy({
      emoji: '🪨',
      title: 'Le Boulet',
      subtitle: 'Le plus de matchs finis dans le négatif',
      color: 'red',
      pick: (a) => a.negativeFinishes,
      format: (v) => `${v}× négatif`,
    }),
  );

  // ─── Activité / divers ─────────────────────────────────────────────
  out.push(
    metricTrophy({
      emoji: '🔁',
      title: 'Marathonien',
      subtitle: 'Le plus de matchs joués',
      color: 'green',
      pick: (a) => a.played,
      format: (v) => `${v} matchs`,
    }),
  );
  out.push(
    metricTrophy({
      emoji: '🌙',
      title: 'Le Noctambule',
      subtitle: 'Le plus de matchs entre 0h et 6h',
      color: 'violet',
      pick: (a) => a.nightGames,
      format: (v) => `${v} matchs`,
    }),
  );

  // Bourreau de travail — le plus de matchs sur une même journée
  {
    let leader: Acc | null = null;
    let leaderVal = 0;
    for (const a of acc.values()) {
      const top = maxOf(a.days);
      if (top && top.val > leaderVal) {
        leader = a;
        leaderVal = top.val;
      }
    }
    const earned = !!leader && leaderVal >= 3;
    out.push({
      emoji: '📅',
      title: 'Bourreau de travail',
      subtitle: 'Le plus de matchs en une journée',
      color: 'bronze',
      winner: earned ? avatarOf(leader!.login) : null,
      value: earned ? `${leaderVal} en 1 jour` : '—',
      earned,
    });
  }

  // Pissette Master (upset ELO) — porte aussi un indice "vs victime"
  const pissette = best((a, b) => a.biggestUpsetGap - b.biggestUpsetGap);
  const pissetteEarned = !!pissette && pissette.biggestUpsetGap > 0;
  out.push({
    emoji: '👑',
    title: 'Pissette Master',
    subtitle: 'Plus gros upset ELO',
    color: 'violet',
    winner: pissetteEarned ? avatarOf(pissette!.login) : null,
    value: pissetteEarned ? `+${pissette!.biggestUpsetGap} ELO` : '—',
    hint:
      pissetteEarned && pissette!.biggestUpsetVictim
        ? `vs ${pissette!.biggestUpsetVictim}`
        : undefined,
    earned: pissetteEarned,
  });

  // Le Couard (fuites) — basé sur le classement
  const couard = [...leaderboard].sort(
    (a, b) => (b.dodgeCount ?? 0) - (a.dodgeCount ?? 0),
  )[0];
  const couardEarned = !!couard && (couard.dodgeCount ?? 0) > 0;
  out.push({
    emoji: '🏃',
    title: 'Le Couard',
    subtitle: 'Le plus de fuites',
    color: 'crimson',
    winner: couardEarned ? avatarOf(couard.login) : null,
    value: couardEarned ? `${couard.dodgeCount} fuites` : '—',
    earned: couardEarned,
  });

  // Rivalité (paire la plus active) — winner null mais "earned" si paire ≥ 2
  const rivalryEarned = !!topPair && topPair.n >= 2;
  out.push({
    emoji: '🤝',
    title: 'Rivalité',
    subtitle: 'Paire la plus active',
    color: 'bronze',
    winner: null,
    value: rivalryEarned ? `${topPair!.a} vs ${topPair!.b}` : '—',
    hint: rivalryEarned ? `${topPair!.n} matchs` : undefined,
    earned: rivalryEarned,
  });

  return out;
}
