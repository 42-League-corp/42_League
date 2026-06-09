import type { TournamentMatch } from './api';

// Une ligne de classement (poule ou ligue) calculée à partir des matchs confirmés.
export interface Standing {
  login: string;
  played: number;
  wins: number;
  goalsFor: number;
  goalsAgainst: number;
  diff: number;
}

/**
 * Classement (miroir des helpers serveur `poolStandings` / `leagueStandings`) à partir
 * des matchs joués.
 *  - 'pool'   : victoires → différence de buts → buts marqués
 *  - 'league' : différence de buts (goal average) → buts marqués → victoires
 *
 * Seuls les matchs avec deux joueurs et deux scores comptent (un match composé mais
 * non joué est ignoré).
 */
export function computeStandings(
  matches: TournamentMatch[],
  mode: 'pool' | 'league' = 'pool',
): Standing[] {
  const table = new Map<string, Standing>();
  const ensure = (login: string): Standing => {
    let s = table.get(login);
    if (!s) {
      s = { login, played: 0, wins: 0, goalsFor: 0, goalsAgainst: 0, diff: 0 };
      table.set(login, s);
    }
    return s;
  };
  for (const m of matches) {
    if (!m.playerALogin || !m.playerBLogin || m.scoreA == null || m.scoreB == null) continue;
    const a = ensure(m.playerALogin);
    const b = ensure(m.playerBLogin);
    a.played++;
    b.played++;
    a.goalsFor += m.scoreA;
    a.goalsAgainst += m.scoreB;
    b.goalsFor += m.scoreB;
    b.goalsAgainst += m.scoreA;
    if (m.winnerLogin === m.playerALogin) a.wins++;
    else if (m.winnerLogin === m.playerBLogin) b.wins++;
  }
  const rows = [...table.values()];
  for (const r of rows) r.diff = r.goalsFor - r.goalsAgainst;
  if (mode === 'league') {
    rows.sort((x, y) => y.diff - x.diff || y.goalsFor - x.goalsFor || y.wins - x.wins);
  } else {
    rows.sort((x, y) => y.wins - x.wins || y.diff - x.diff || y.goalsFor - x.goalsFor);
  }
  return rows;
}

export interface PoolStanding {
  poolIndex: number;
  standings: Standing[];
}

/**
 * Classements par poule à partir des matchs de poule (`stage='pool'`). Chaque poule
 * est triée avec le mode 'pool' (victoires → diff → buts). Les poules sont retournées
 * dans l'ordre de leur index. Tout joueur présent dans un match de la poule apparaît,
 * même sans match joué (ligne à zéro), pour un tableau toujours peuplé.
 */
export function poolStandings(matches: TournamentMatch[]): PoolStanding[] {
  const pools = new Map<number, TournamentMatch[]>();
  for (const m of matches) {
    if ((m.stage ?? 'bracket') !== 'pool') continue;
    const idx = m.poolIndex ?? 0;
    const arr = pools.get(idx) ?? [];
    arr.push(m);
    pools.set(idx, arr);
  }
  const out: PoolStanding[] = [];
  for (const [poolIndex, poolMatches] of [...pools.entries()].sort((a, b) => a[0] - b[0])) {
    const base = computeStandings(poolMatches, 'pool');
    const seen = new Set(base.map((s) => s.login));
    // Joueurs composés mais sans match joué : on les ajoute en bas (ligne vide).
    for (const m of poolMatches) {
      for (const login of [m.playerALogin, m.playerBLogin]) {
        if (login && !seen.has(login)) {
          seen.add(login);
          base.push({ login, played: 0, wins: 0, goalsFor: 0, goalsAgainst: 0, diff: 0 });
        }
      }
    }
    out.push({ poolIndex, standings: base });
  }
  return out;
}

/**
 * Forme récente d'un joueur : séquence chronologique de résultats (victoire `'W'` /
 * défaite `'L'`) sur ses matchs confirmés, du plus ancien au plus récent. Sert à
 * dessiner une mini-sparkline de tendance sur la page live.
 */
export function formOf(login: string, matches: TournamentMatch[]): Array<'W' | 'L'> {
  return matches
    .filter(
      (m) =>
        m.confirmedAt &&
        m.winnerLogin &&
        (m.playerALogin === login || m.playerBLogin === login),
    )
    .sort((a, b) => (a.confirmedAt ?? '').localeCompare(b.confirmedAt ?? ''))
    .map((m) => (m.winnerLogin === login ? 'W' : 'L'));
}
