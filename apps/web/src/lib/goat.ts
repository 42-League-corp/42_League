import type { LeaderboardEntry, PlayedMatch, Tournament } from './api';

/**
 * Score G.O.A.T — agrège toutes les stats « positives » d'un joueur en une note
 * unique, pondérée. L'idée : le meilleur joueur de tous les temps n'est pas
 * forcément le n°1 à l'ELO — un joueur qui gagne de gros écarts, enchaîne les
 * séries et remporte des tournois officiels peut le coiffer.
 *
 * Pondération demandée explicitement :
 *   - ELO              40 %  (le plus lourd)
 *   - Tournois         20 %  (officiels 16 % + amicaux 4 %)
 *   - Le reste (40 %) réparti entre goal average, écart en victoire,
 *     séries de victoires et win rate.
 */

export interface GoatWeight {
  key: GoatMetricKey;
  label: string;
  weight: number;
}

export type GoatMetricKey =
  | 'officialTitles'
  | 'elo'
  | 'goalAvg'
  | 'winMargin'
  | 'winStreak'
  | 'winRate'
  | 'friendlyTitles';

export const GOAT_WEIGHTS: GoatWeight[] = [
  { key: 'elo', label: 'ELO', weight: 0.4 },
  { key: 'officialTitles', label: 'Tournois officiels', weight: 0.16 },
  { key: 'goalAvg', label: 'Goal average', weight: 0.14 },
  { key: 'winMargin', label: 'Écart en victoire', weight: 0.1 },
  { key: 'winStreak', label: 'Série de victoires', weight: 0.1 },
  { key: 'winRate', label: 'Win rate', weight: 0.06 },
  { key: 'friendlyTitles', label: 'Tournois amicaux', weight: 0.04 },
];

export interface GoatMetrics {
  elo: number;
  games: number;
  wins: number;
  losses: number;
  winRate: number; // 0–100
  goalsFor: number;
  goalsAgainst: number;
  goalDiffPerGame: number;
  avgWinMargin: number; // marge moyenne sur les matchs gagnés
  maxWinStreak: number;
  officialTitles: number;
  friendlyTitles: number;
}

export interface GoatPlayer {
  entry: LeaderboardEntry;
  metrics: GoatMetrics;
  /** Contribution normalisée (0–1) par métrique. */
  norm: Record<GoatMetricKey, number>;
  /** Score final, 0–100. */
  score: number;
  rank: number;
}

const norm01 = (v: number, min: number, max: number) =>
  max > min ? (v - min) / (max - min) : 0;

/**
 * Calcule le classement G.O.A.T à partir du leaderboard (ELO), de l'historique des
 * matchs (buts, marges, séries) et des tournois (titres officiels / amicaux).
 */
export function computeGoat(
  leaderboard: LeaderboardEntry[],
  matches: PlayedMatch[],
  tournaments: Tournament[],
): GoatPlayer[] {
  const known = new Set(leaderboard.map((e) => e.login));

  // ELO cumulé « all-time » : le GOAT doit rester PERSISTANT entre les saisons.
  // Or l'ELO du leaderboard (entry.elo) est remis au plancher de palier à chaque
  // clôture de saison → il ne reflète que la saison courante. On reconstruit donc
  // un ELO continu en repartant de l'ELO de départ (1000) et en ré-appliquant la
  // variation de CHAQUE match de toutes les saisons (l'historique /matches n'est
  // jamais purgé). Les nulles (échecs) comptent aussi car elles bougent l'ELO.
  const ALL_TIME_BASE_ELO = 1000;
  const eloDeltaSum = new Map<string, number>();
  for (const m of matches) {
    if (!m.countedForElo) continue;
    if (known.has(m.playerALogin))
      eloDeltaSum.set(m.playerALogin, (eloDeltaSum.get(m.playerALogin) ?? 0) + (m.deltaA ?? 0));
    if (known.has(m.playerBLogin))
      eloDeltaSum.set(m.playerBLogin, (eloDeltaSum.get(m.playerBLogin) ?? 0) + (m.deltaB ?? 0));
  }
  const allTimeElo = (login: string) => ALL_TIME_BASE_ELO + (eloDeltaSum.get(login) ?? 0);

  // Titres par joueur (officiels vs amicaux) — tournois terminés avec un vainqueur.
  const officialTitles = new Map<string, number>();
  const friendlyTitles = new Map<string, number>();
  for (const t of tournaments) {
    if (t.status !== 'finished' || !t.winnerLogin) continue;
    const bucket = t.kind === 'official' ? officialTitles : friendlyTitles;
    bucket.set(t.winnerLogin, (bucket.get(t.winnerLogin) ?? 0) + 1);
  }

  // Accumulateurs par joueur depuis les matchs.
  interface Acc {
    wins: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    winMarginSum: number;
    seq: { won: boolean; at: number }[];
  }
  const acc = new Map<string, Acc>();
  const ensure = (login: string): Acc => {
    let a = acc.get(login);
    if (!a) {
      a = { wins: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, winMarginSum: 0, seq: [] };
      acc.set(login, a);
    }
    return a;
  };
  for (const m of matches) {
    if (m.winner === 'draw') continue; // nulle (échecs) : exclue du palmarès GOAT
    for (const login of [m.playerALogin, m.playerBLogin]) {
      if (!known.has(login)) continue;
      const isA = m.playerALogin === login;
      const sf = isA ? m.scoreA : m.scoreB;
      const sa = isA ? m.scoreB : m.scoreA;
      const won = (isA && m.winner === 'A') || (!isA && m.winner === 'B');
      const a = ensure(login);
      a.goalsFor += sf;
      a.goalsAgainst += sa;
      if (won) {
        a.wins++;
        a.winMarginSum += sf - sa;
      } else {
        a.losses++;
      }
      a.seq.push({ won, at: new Date(m.playedAt).getTime() });
    }
  }

  // Métriques brutes par joueur du leaderboard.
  const rows = leaderboard.map((entry) => {
    const a = acc.get(entry.login);
    const wins = a?.wins ?? 0;
    const losses = a?.losses ?? 0;
    const games = wins + losses;
    const goalsFor = a?.goalsFor ?? 0;
    const goalsAgainst = a?.goalsAgainst ?? 0;
    // Plus longue série de victoires.
    let maxWinStreak = 0;
    let run = 0;
    if (a) {
      a.seq.sort((x, y) => x.at - y.at);
      for (const r of a.seq) {
        if (r.won) {
          run++;
          if (run > maxWinStreak) maxWinStreak = run;
        } else run = 0;
      }
    }
    const metrics: GoatMetrics = {
      elo: allTimeElo(entry.login),
      games,
      wins,
      losses,
      winRate: games === 0 ? 0 : Math.round((wins / games) * 100),
      goalsFor,
      goalsAgainst,
      goalDiffPerGame: games === 0 ? 0 : (goalsFor - goalsAgainst) / games,
      avgWinMargin: wins === 0 ? 0 : (a?.winMarginSum ?? 0) / wins,
      maxWinStreak,
      officialTitles: officialTitles.get(entry.login) ?? 0,
      friendlyTitles: friendlyTitles.get(entry.login) ?? 0,
    };
    return { entry, metrics };
  });

  // Bornes pour normaliser chaque métrique.
  const vals = (sel: (m: GoatMetrics) => number) => rows.map((r) => sel(r.metrics));
  const range = (sel: (m: GoatMetrics) => number) => {
    const xs = vals(sel);
    return { min: Math.min(...xs, 0), max: Math.max(...xs, 0) };
  };
  const rElo = range((m) => m.elo);
  const rGoal = range((m) => m.goalDiffPerGame);
  const rMargin = range((m) => m.avgWinMargin);
  const rStreak = range((m) => m.maxWinStreak);
  const rOff = range((m) => m.officialTitles);
  const rFri = range((m) => m.friendlyTitles);

  const scored = rows.map(({ entry, metrics }) => {
    const norm: Record<GoatMetricKey, number> = {
      officialTitles: norm01(metrics.officialTitles, rOff.min, rOff.max),
      elo: norm01(metrics.elo, rElo.min, rElo.max),
      goalAvg: norm01(metrics.goalDiffPerGame, rGoal.min, rGoal.max),
      winMargin: norm01(metrics.avgWinMargin, rMargin.min, rMargin.max),
      winStreak: norm01(metrics.maxWinStreak, rStreak.min, rStreak.max),
      winRate: metrics.winRate / 100,
      friendlyTitles: norm01(metrics.friendlyTitles, rFri.min, rFri.max),
    };
    // Facteur de fiabilité : on amortit les joueurs à très faible volume (un 10–0
    // unique ne fait pas un GOAT). Plein effet à partir de ~10 matchs.
    const confidence = Math.min(1, metrics.games / 10);
    const raw = GOAT_WEIGHTS.reduce((s, w) => s + w.weight * norm[w.key], 0);
    const score = Math.round(raw * confidence * 1000) / 10; // 0–100, 1 décimale
    return { entry, metrics, norm, score, rank: 0 };
  });

  scored.sort((a, b) => b.score - a.score || b.metrics.elo - a.metrics.elo);
  scored.forEach((p, i) => {
    p.rank = i + 1;
  });
  return scored;
}
