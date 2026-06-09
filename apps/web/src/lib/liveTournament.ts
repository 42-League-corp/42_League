import type { LiveTournament, TournamentEntry, TournamentMatch } from './api';

// ─────────────────────────────────────────────────────────────────────────────
// Sélecteurs purs pour l'écran TV live. Aucune dépendance React → testables seuls.
// Toute la page se reconstruit à partir de ces fonctions à chaque refetch SSE.
// ─────────────────────────────────────────────────────────────────────────────

export type MatchStage = 'pool' | 'bracket' | 'league';

/** Matchs d'un `stage` donné (défaut : on traite l'absence de stage comme 'bracket'). */
export function matchesOfStage(t: LiveTournament, stage: MatchStage): TournamentMatch[] {
  return (t.matches ?? []).filter((m) => (m.stage ?? 'bracket') === stage);
}

/** Un match est « jouable » s'il a ses deux camps et n'est pas confirmé. */
export function isPlayable(m: TournamentMatch): boolean {
  return !!m.playerALogin && !!m.playerBLogin && !m.confirmedAt;
}

/** Score en cours de saisie (en attente de confirmation). */
export function isLiveScoring(m: TournamentMatch): boolean {
  return !!m.recordedAt && !m.confirmedAt && m.scoreA != null && m.scoreB != null;
}

/** Nombre de rounds réels du bracket (0 si pas encore d'arbre). */
export function bracketRounds(t: LiveTournament): number {
  return matchesOfStage(t, 'bracket').reduce((mx, m) => Math.max(mx, m.round), 0);
}

export type PhaseKey = 'league' | 'final' | 'pools' | 'bracket' | 'registration' | 'finished';

export interface PhaseInfo {
  key: PhaseKey;
  /** Libellé court pour le badge (ex. « PHASE LIGUE », « PHASE FINALE »). */
  label: string;
  /** Sous-libellé chiffré (ex. « 5 matchs restants »), ou null. */
  detail: string | null;
}

/**
 * Phase courante du tournoi, pour le badge type « PROCHAIN CYCLE » de la maquette
 * (mais lié au réel). En ligue : « PHASE LIGUE » tant qu'aucun arbre n'existe, puis
 * « PHASE FINALE » dès la bascule. Le `detail` compte les matchs jouables restants.
 */
export function phaseInfo(t: LiveTournament): PhaseInfo {
  if (t.status === 'finished') return { key: 'finished', label: 'TERMINÉ', detail: null };
  if (t.status === 'registration') return { key: 'registration', label: 'INSCRIPTIONS', detail: null };
  const hasBracket = bracketRounds(t) > 0;
  const remaining = (t.matches ?? []).filter(isPlayable).length;
  const detail = remaining > 0 ? `${remaining} match${remaining > 1 ? 's' : ''} à jouer` : 'dernière ligne droite';
  if (t.format === 'league') {
    return hasBracket
      ? { key: 'final', label: 'PHASE FINALE', detail }
      : { key: 'league', label: 'PHASE LIGUE', detail };
  }
  if (t.format === 'pools' && !hasBracket) {
    return { key: 'pools', label: 'PHASE DE POULES', detail };
  }
  return { key: 'bracket', label: 'ÉLIMINATION DIRECTE', detail };
}

/** Priorité de stage pour choisir le match en avant (l'arbre prime sur la ligue/poule). */
function stageRank(m: TournamentMatch): number {
  const s = m.stage ?? 'bracket';
  return s === 'bracket' ? 0 : s === 'pool' ? 1 : 2;
}

function byStageRoundSlot(a: TournamentMatch, b: TournamentMatch): number {
  return stageRank(a) - stageRank(b) || a.round - b.round || a.slot - b.slot;
}

export type FeaturedState = 'active' | 'live' | 'next' | 'last';

export interface Featured {
  match: TournamentMatch;
  state: FeaturedState;
}

/**
 * Match à mettre en avant au centre de l'écran. Ordre de préférence :
 *   1. `activeMatchId` (« match suivant » désigné par l'organisateur),
 *   2. un match dont le score est en cours de saisie (live),
 *   3. le prochain match jouable (stage → round → slot),
 *   4. à défaut, le dernier match confirmé (« dernier match »).
 */
export function pickFeaturedMatch(t: LiveTournament): Featured | null {
  const matches = t.matches ?? [];
  if (matches.length === 0) return null;

  if (t.activeMatchId) {
    const m = matches.find((x) => x.id === t.activeMatchId);
    if (m) return { match: m, state: 'active' };
  }
  const live = matches
    .filter(isLiveScoring)
    .sort((a, b) => (b.recordedAt ?? '').localeCompare(a.recordedAt ?? ''))[0];
  if (live) return { match: live, state: 'live' };

  const next = matches.filter((m) => isPlayable(m) && !isLiveScoring(m)).sort(byStageRoundSlot)[0];
  if (next) return { match: next, state: 'next' };

  const last = matches
    .filter((m) => m.confirmedAt)
    .sort((a, b) => (b.confirmedAt ?? '').localeCompare(a.confirmedAt ?? ''))[0];
  if (last) return { match: last, state: 'last' };

  return null;
}

/**
 * Prochains duels : matchs composés, à deux camps, pas encore commencés (ni score
 * saisi ni confirmé). On exclut le match déjà en avant pour ne pas le répéter.
 */
export function upcomingDuels(t: LiveTournament, excludeId?: string | null, limit = 6): TournamentMatch[] {
  return (t.matches ?? [])
    .filter(
      (m) => m.playerALogin && m.playerBLogin && !m.confirmedAt && !m.recordedAt && m.id !== excludeId,
    )
    .sort(byStageRoundSlot)
    .slice(0, limit);
}

/** Derniers résultats : matchs confirmés, du plus récent au plus ancien. */
export function recentResults(t: LiveTournament, limit = 6): TournamentMatch[] {
  return (t.matches ?? [])
    .filter((m) => m.confirmedAt)
    .sort((a, b) => (b.confirmedAt ?? '').localeCompare(a.confirmedAt ?? ''))
    .slice(0, limit);
}

// ── Identité des équipes / joueurs ───────────────────────────────────────────

/** Coéquipier (2v2) d'un capitaine, ou null. */
export function partnerOf(login: string, entries: TournamentEntry[] = []): string | null {
  return entries.find((e) => e.login === login)?.partnerLogin ?? null;
}

/** Libellé d'un camp : « capitaine » (1v1) ou « capitaine & coéquipier » (2v2). */
export function teamLabelOf(login: string | null, entries: TournamentEntry[] = []): string {
  if (!login) return '—';
  const p = partnerOf(login, entries);
  return p ? `${login} & ${p}` : login;
}

/** Table login → URL d'avatar (capitaines ET coéquipiers résolus). */
export function avatarMap(entries: TournamentEntry[] = []): Map<string, string | null> {
  const m = new Map<string, string | null>();
  for (const e of entries) {
    m.set(e.login, e.user?.imageUrl ?? null);
    if (e.partnerLogin) m.set(e.partnerLogin, e.partner?.imageUrl ?? null);
  }
  return m;
}

/** Table login (capitaine) → ELO. */
export function eloMap(entries: TournamentEntry[] = []): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) if (e.user) m.set(e.login, e.user.elo);
  return m;
}

// ── HYPE ─────────────────────────────────────────────────────────────────────

/** Proximité d'ELO normalisée 0..1 (écart 0 → 1, écart ≥ 300 → 0). */
export function eloCloseness(a: number | undefined, b: number | undefined): number {
  if (a == null || b == null) return 0.5;
  return Math.max(0, 1 - Math.abs(a - b) / 300);
}

/**
 * HYPE de chaque duel d'un ensemble, normalisée 0..1. Si des paris « vainqueur du
 * tournoi » existent, la HYPE = mises cumulées sur les deux camps (normalisées au plus
 * gros duel) ; sinon repli sur la proximité d'ELO. Retourne une map matchId → 0..1.
 */
export function computeDuelHypes(
  duels: TournamentMatch[],
  betPool: Record<string, number> = {},
  elo: Map<string, number> = new Map(),
): Map<string, number> {
  const weights = duels.map((m) => (betPool[m.playerALogin ?? ''] ?? 0) + (betPool[m.playerBLogin ?? ''] ?? 0));
  const maxWeight = Math.max(0, ...weights);
  const out = new Map<string, number>();
  duels.forEach((m, i) => {
    if (maxWeight > 0) {
      // Mélange mises (dominant) + proximité ELO pour éviter le 0 brutal sans pari.
      const bet = (weights[i] ?? 0) / maxWeight;
      const close = eloCloseness(elo.get(m.playerALogin ?? ''), elo.get(m.playerBLogin ?? ''));
      out.set(m.id, Math.min(1, 0.65 * bet + 0.35 * close));
    } else {
      out.set(m.id, eloCloseness(elo.get(m.playerALogin ?? ''), elo.get(m.playerBLogin ?? '')));
    }
  });
  return out;
}

export interface TightMatch {
  match: TournamentMatch;
  kind: 'liveClose' | 'eloClose';
  /** Écart (buts en live, ELO à venir) — plus petit = plus serré. */
  gap: number;
}

/**
 * Matchs « serrés » pour l'encart HYPE : d'abord les matchs en cours/récents dont
 * l'écart de score est ≤ 1 (le vrai suspense), puis les affiches à venir au plus
 * petit écart d'ELO. Trié du plus chaud au moins chaud.
 */
export function tightMatches(t: LiveTournament, elo: Map<string, number>, limit = 3): TightMatch[] {
  const liveClose: TightMatch[] = (t.matches ?? [])
    .filter((m) => m.scoreA != null && m.scoreB != null && (isLiveScoring(m) || m.confirmedAt))
    .map((m) => ({ match: m, kind: 'liveClose' as const, gap: Math.abs((m.scoreA ?? 0) - (m.scoreB ?? 0)) }))
    .filter((x) => x.gap <= 1)
    .sort((a, b) => a.gap - b.gap || (b.match.recordedAt ?? b.match.confirmedAt ?? '').localeCompare(a.match.recordedAt ?? a.match.confirmedAt ?? ''));

  const eloClose: TightMatch[] = upcomingDuels(t, null, 20)
    .map((m) => ({
      match: m,
      kind: 'eloClose' as const,
      gap: Math.abs((elo.get(m.playerALogin ?? '') ?? 1000) - (elo.get(m.playerBLogin ?? '') ?? 1000)),
    }))
    .sort((a, b) => a.gap - b.gap);

  return [...liveClose, ...eloClose].slice(0, limit);
}

/** Sélectionne le tournoi « courant » à afficher par défaut sur la TV. */
export function pickCurrentTournament<T extends { status: string; kind: string; startedAt: string | null; createdAt: string }>(
  list: T[],
): T | null {
  const live = list.filter((t) => t.status === 'in_progress');
  if (live.length === 0) return null;
  return [...live].sort((a, b) => {
    // Officiels d'abord, puis le démarrage le plus récent.
    if ((a.kind === 'official') !== (b.kind === 'official')) return a.kind === 'official' ? -1 : 1;
    return (b.startedAt ?? b.createdAt).localeCompare(a.startedAt ?? a.createdAt);
  })[0]!;
}
