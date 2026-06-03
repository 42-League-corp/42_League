import { getApiBase } from './config';
import { clearToken, getToken } from './storage';
import type { Game } from './gameMode';

export type { Game };

/** Champs d'un résultat de match, communs à la déclaration et à l'enregistrement. */
export interface MatchResultInput {
  scoreSelf: number;
  scoreOpponent: number;
  game?: Game;
  // Smash uniquement :
  bestOf?: 3 | 5;
  charSelf?: string;
  charOpponent?: string;
  stocks?: number;
}

export interface LeaderboardEntry {
  rank: number;
  login: string;
  firstName?: string | null;
  lastName?: string | null;
  elo: number;
  matchesPlayed: number;
  campus: string | null;
  imageUrl: string | null;
  title?: string | null;
  dodgeCount?: number;
  tournamentsWon?: number;
}

export interface PendingMatch {
  id: string;
  declarerLogin: string;
  opponentLogin: string;
  scoreDeclarer: number;
  scoreOpponent: number;
  declaredAt: string;
  game?: Game;
  bestOf?: number | null;
  charDeclarer?: string | null;
  charOpponent?: string | null;
  stocks?: number | null;
}

export interface Challenge {
  id: string;
  challengerLogin: string;
  opponentLogin: string;
  status: 'pending' | 'accepted' | 'declined' | 'recorded' | 'cancelled';
  scheduledAt: string;
  createdAt: string;
  decidedAt: string | null;
  game?: Game;
}

export interface PlayedMatch {
  id: string;
  playerALogin: string;
  playerBLogin: string;
  scoreA: number;
  scoreB: number;
  winner: 'A' | 'B';
  playedAt: string;
  countedForElo: boolean;
  deltaA: number;
  deltaB: number;
  game?: Game;
  bestOf?: number | null;
  charA?: string | null;
  charB?: string | null;
  stocksA?: number | null;
  stocksB?: number | null;
}

export interface MeResponse {
  login: string;
  isAdmin?: boolean;
  role?: 'USER' | 'ADMIN' | 'SUPERADMIN';
  /** True si l'utilisateur n'a pas (encore) consenti à la version courante de la politique. */
  consentRequired?: boolean;
  /** Version de la politique de confidentialité en vigueur côté serveur. */
  termsVersion?: string;
  /** Codes de badges (cf. catalogue front lib/badges.ts). */
  badges?: string[];
  /** Palmarès par saison. */
  palmares?: PalmaresEntry[];
  user: {
    login: string;
    firstName?: string | null;
    lastName?: string | null;
    elo: number;
    matchesPlayed: number;
    campus: string | null;
    imageUrl: string | null;
    title: string | null;
    dodgeCount: number;
    tournamentsWon: number;
    eloSmash?: number;
    matchesPlayedSmash?: number;
    tournamentsWonSmash?: number;
    eloChess?: number;
    matchesPlayedChess?: number;
    tournamentsWonChess?: number;
    games?: Game[];
    onboardedAt?: string | null;
  } | null;
}

export interface AdminUser {
  login: string;
  /** Null = faux compte créé manuellement (jamais passé par OAuth 42) → supprimable. */
  ftId: number | null;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  elo: number;
  matchesPlayed: number;
  dodgeCount: number;
  tournamentsWon: number;
  eloSmash?: number;
  matchesPlayedSmash?: number;
  tournamentsWonSmash?: number;
  eloChess?: number;
  matchesPlayedChess?: number;
  tournamentsWonChess?: number;
  games?: Game[];
  title: string | null;
  imageUrl: string | null;
  campus: string | null;
  bannedAt: string | null;
  createdAt: string;
}

export interface RejectedMatch {
  id: string;
  declarerLogin: string;
  opponentLogin: string;
  scoreDeclarer: number;
  scoreOpponent: number;
  contestReason: string;
  contestMessage: string;
  rejectedAt: string;
}

export interface ModerationStats {
  user: AdminUser;
  recentMatches: PlayedMatch[];
  topOpponents: { login: string; count: number }[];
  rejectionsEmitted: RejectedMatch[];
  rejectionsReceived: RejectedMatch[];
}

export interface FeatureRequestWithAuthor {
  id: string;
  text: string;
  status: string;
  authorId: string;
  createdAt: string;
  author: { login: string; imageUrl: string | null };
}

export interface BugReportWithAuthor {
  id: string;
  text: string;
  status: string;
  authorId: string;
  createdAt: string;
  author: { login: string; imageUrl: string | null };
}

export interface SuspiciousFlag {
  type: 'pair_domination' | 'recent_farming' | 'elo_spike' | 'victim_pattern';
  severity: 'low' | 'medium' | 'high';
  players: string[];
  detail: string;
  matchCount?: number;
  winRate?: number;
  eloGain?: number;
}

export type AdminAuditAction =
  | 'SET_ROLE'
  | 'BAN_USER'
  | 'UNBAN_USER'
  | 'EDIT_STATS'
  | 'EDIT_TITLE'
  | 'DELETE_MATCH'
  | 'EDIT_MATCH'
  | 'REFRESH_IMAGES'
  | 'DELETE_CHALLENGE'
  | 'DELETE_PENDING_MATCH'
  | 'DELETE_REJECTED_MATCH'
  | 'DELETE_OPS'
  | 'DELETE_TOURNAMENT'
  | 'RESET_DATABASE';

export interface AdminAuditEntry {
  id: string;
  actorLogin: string;
  actorRole: 'USER' | 'ADMIN' | 'SUPERADMIN';
  action: AdminAuditAction;
  targetLogin: string | null;
  payload: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface Ops {
  id: string;
  ownerLogin: string;
  targetLogin: string;
  declaredAt: string;
  expiresAt: string;
  /** Nombre de matchs forcés déjà consommés (joués ou refusés). Max 3. */
  forcedUsed: number;
  owner?: { login: string; imageUrl: string | null };
  target?: { login: string; imageUrl: string | null };
}

/** Nombre de matchs que la cible doit encore affronter sans pouvoir refuser. */
export const OPS_FORCED_MATCHES = 3;

export interface OpsMeResponse {
  current: Ops | null;
  targetedBy: Ops | null;
  canDeclareAt: string | null;
}

export interface OpsUserResponse {
  owns: Ops | null;
  targetedBy: Ops | null;
}

export interface UserProfile {
  user: {
    login: string;
    firstName?: string | null;
    lastName?: string | null;
    elo: number;
    matchesPlayed: number;
    campus: string | null;
    imageUrl: string | null;
    title: string | null;
    dodgeCount: number;
    tournamentsWon: number;
    // Stats par discipline (renvoyées par le backend ; permettent d'isoler la
    // fiche d'un joueur par jeu, comme le profil perso).
    eloSmash?: number;
    matchesPlayedSmash?: number;
    tournamentsWonSmash?: number;
    eloChess?: number;
    matchesPlayedChess?: number;
    tournamentsWonChess?: number;
    createdAt: string;
  };
  rank: number | null;
  wins: number;
  losses: number;
  recent: PlayedMatch[];
  /** Codes de badges (cf. catalogue front lib/badges.ts). */
  badges?: string[];
  /** Le visiteur suit-il ce joueur ? (null/false si soi-même ou non suivi) */
  following?: boolean;
  /** Préférences de notif pour ce suivi (null si non suivi). */
  followPrefs?: FollowPrefs | null;
  /** Palmarès par saison (classements finaux). */
  palmares?: PalmaresEntry[];
}

export interface FollowPrefs {
  notifyTournament: boolean;
  notifyTop3: boolean;
  notifyTrophy: boolean;
  notifyOps: boolean;
}

/** Arête de suivi : `followee` rempli côté /follows, `follower` côté /followers. */
export interface FollowEdge {
  id: string;
  followerLogin: string;
  followeeLogin: string;
  createdAt: string;
  follower?: { login: string; imageUrl: string | null; elo: number };
  followee?: { login: string; imageUrl: string | null; elo: number };
}

export interface Season {
  id: string;
  name: string;
  isActive: boolean;
  startedAt: string;
  endedAt: string | null;
}

export interface SeasonStanding {
  id: string;
  seasonId: string;
  login: string;
  rank: number;
  elo: number;
  wins: number;
  losses: number;
}

export interface PalmaresEntry {
  seasonId: string;
  seasonName: string;
  rank: number;
  elo: number;
  wins: number;
  losses: number;
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  stage?: 'pool' | 'bracket';
  poolIndex?: number | null;
  round: number;
  slot: number;
  playerALogin: string | null;
  playerBLogin: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerLogin: string | null;
  recordedByLogin: string | null;
  recordedAt: string | null;
  confirmedAt: string | null;
}

export interface TournamentEntry {
  tournamentId: string;
  login: string;
  joinedAt: string;
  user?: { login: string; imageUrl: string | null; elo: number };
}

export interface TournamentInvite {
  id: string;
  tournamentId?: string;
  inviterLogin: string;
  inviteeLogin: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface Tournament {
  id: string;
  name: string;
  kind: 'friendly' | 'official';
  isPrivate?: boolean;
  imageUrl?: string | null;
  capacity: number;
  format?: 'elimination' | 'pools';
  game?: Game;
  status: 'registration' | 'in_progress' | 'finished' | 'cancelled';
  createdByLogin: string;
  winnerLogin: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  entries?: TournamentEntry[];
  matches?: TournamentMatch[];
  winner?: { login: string; imageUrl: string | null } | null;
  invites?: TournamentInvite[];
}

export type AllHistoryEventType = 'challenge' | 'pending_match' | 'played_match' | 'rejected_match' | 'ops';

export interface AllHistoryEvent {
  id: string;
  type: AllHistoryEventType;
  at: string;
  game?: Game;
  playerA: string;
  playerB: string;
  status?: string;
  scoreA?: number;
  scoreB?: number;
  winner?: string;
  deltaA?: number;
  deltaB?: number;
  countedForElo?: boolean;
  contestReason?: string;
  contestMessage?: string;
  forcedUsed?: number;
  scheduledAt?: string;
  decidedAt?: string | null;
  expiresAt?: string;
}

export class AuthError extends Error {}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = { auth: true },
): Promise<T> {
  const headers = new Headers(init.headers);
  if (options.auth !== false) {
    const token = getToken();
    if (!token) throw new AuthError('not authenticated');
    headers.set('authorization', `Bearer ${token}`);
  }
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const res = await fetch(`${getApiBase()}${path}`, { ...init, headers });
  if (res.status === 401) {
    clearToken();
    throw new AuthError('session expired');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${body ? ` — ${body}` : ''}`);
  }
  return (await res.json()) as T;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export const api = {
  me: () => request<MeResponse>('/me'),
  // RGPD / CGU 42 — enregistre (accept=true) ou refuse (accept=false, supprime le compte)
  // le consentement de l'utilisateur final.
  consent: (accept: boolean) =>
    request<{ ok: boolean; accepted: boolean; deleted?: boolean }>('/me/consent', {
      method: 'POST',
      body: JSON.stringify({ accept }),
    }),
  setGames: (games: Game[]) =>
    request<{ games: Game[]; onboardedAt: string | null }>('/me/games', {
      method: 'PATCH',
      body: JSON.stringify({ games }),
    }),
  leaderboard: (game?: Game) =>
    request<LeaderboardEntry[]>(
      `/leaderboard${game && game !== 'babyfoot' ? `?game=${game}` : ''}`,
    ),
  // Token éphémère (scope SSE) à passer en ?token= pour ouvrir le flux /events,
  // afin de ne jamais exposer le Bearer 30 jours dans une URL (logs / Referer).
  streamToken: () => request<{ token: string }>('/auth/stream-token'),
  notifications: () => request<{ notifications: AppNotification[]; unread: number }>('/notifications'),
  markNotificationsRead: (ids?: string[]) =>
    request<{ ok: true }>('/notifications/read', {
      method: 'POST',
      body: JSON.stringify(ids ? { ids } : {}),
    }),
  // Liste des joueurs que JE suis (following).
  follows: () => request<FollowEdge[]>('/follows'),
  // Liste des joueurs qui ME suivent (followers).
  followers: () => request<FollowEdge[]>('/followers'),
  follow: (login: string) =>
    request<unknown>('/follows', { method: 'POST', body: JSON.stringify({ login }) }),
  unfollow: (login: string) =>
    request<{ ok: true }>(`/follows/${encodeURIComponent(login)}`, { method: 'DELETE' }),
  updateFollowPrefs: (login: string, prefs: Partial<FollowPrefs>) =>
    request<unknown>(`/follows/${encodeURIComponent(login)}`, {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    }),
  seasons: () => request<Season[]>('/seasons'),
  currentSeason: () => request<Season | null>('/seasons/current'),
  seasonStandings: (id: string, game?: Game) =>
    request<SeasonStanding[]>(
      `/seasons/${encodeURIComponent(id)}/standings${game && game !== 'babyfoot' ? `?game=${game}` : ''}`,
    ),
  createSeason: (name: string) =>
    request<Season>('/seasons', { method: 'POST', body: JSON.stringify({ name }) }),
  closeSeason: () =>
    request<{ closed: true; champion: string | null; players: number; seasonName: string }>(
      '/seasons/close',
      { method: 'POST', body: JSON.stringify({}) },
    ),
  pendingMatches: () => request<PendingMatch[]>('/matches/pending'),
  playedMatches: () => request<PlayedMatch[]>('/matches'),
  declareMatch: (input: { opponentLogin: string } & MatchResultInput) =>
    request<{ id: string; status: 'pending' }>('/matches', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  confirmMatch: (
    id: string,
    scoreSelf: number,
    scoreOpponent: number,
    extra?: { game?: Game; bestOf?: 3 | 5 },
  ) =>
    request<PlayedMatch>(`/matches/${encodeURIComponent(id)}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ scoreSelf, scoreOpponent, ...extra }),
    }),
  rejectMatch: (
    id: string,
    contestReason: 'never_played' | 'wrong_score',
    contestMessage: string,
  ) =>
    request<{ id: string; status: 'rejected' }>(
      `/matches/${encodeURIComponent(id)}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ contestReason, contestMessage }),
      },
    ),
  // Annulation de sa propre déclaration (réservé au déclarant, tant que pending).
  cancelMatch: (id: string) =>
    request<{ id: string; status: 'cancelled' }>(
      `/matches/${encodeURIComponent(id)}/cancel`,
      { method: 'POST' },
    ),
  challenges: () => request<Challenge[]>('/challenges'),
  createChallenge: (input: { opponentLogin: string; scheduledAt: string; game?: Game }) =>
    request<Challenge>('/challenges', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  acceptChallenge: (id: string) =>
    request<Challenge>(`/challenges/${encodeURIComponent(id)}/accept`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  declineChallenge: (id: string) =>
    request<{ id: string; status: string; eloPenalty: number; isOps: boolean }>(
      `/challenges/${encodeURIComponent(id)}/decline`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  recordChallengeResult: (id: string, result: MatchResultInput) =>
    request<{ pendingId: string; status: 'pending_confirmation' }>(
      `/challenges/${encodeURIComponent(id)}/record`,
      {
        method: 'POST',
        body: JSON.stringify(result),
      },
    ),
  userProfile: (login: string) =>
    request<UserProfile>(`/users/${encodeURIComponent(login)}`),
  opsList: () => request<Ops[]>('/ops'),
  opsMe: () => request<OpsMeResponse>('/ops/me'),
  opsForUser: (login: string) =>
    request<OpsUserResponse>(`/ops/user/${encodeURIComponent(login)}`),
  declareOps: (targetLogin: string) =>
    request<Ops>('/ops', {
      method: 'POST',
      body: JSON.stringify({ targetLogin }),
    }),
  setUserTitle: (login: string, title: string | null) =>
    request<{ login: string; title: string | null }>(
      `/admin/users/${encodeURIComponent(login)}/title`,
      {
        method: 'POST',
        body: JSON.stringify({ title }),
      },
    ),
  tournaments: (game?: Game) =>
    request<Tournament[]>(`/tournaments${game && game !== 'babyfoot' ? `?game=${game}` : ''}`),
  tournament: (id: string) =>
    request<Tournament>(`/tournaments/${encodeURIComponent(id)}`),
  createTournament: (input: {
    name: string;
    capacity: number;
    kind: 'friendly' | 'official';
    format?: 'elimination' | 'pools';
    game?: Game;
    private?: boolean;
    imageUrl?: string;
  }) =>
    request<Tournament>('/tournaments', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  joinTournament: (id: string) =>
    request<{ id: string; status: string }>(
      `/tournaments/${encodeURIComponent(id)}/join`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  leaveTournament: (id: string) =>
    request<{ id: string; left: true }>(
      `/tournaments/${encodeURIComponent(id)}/leave`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  // Organisateur/admin : envoie une invitation (le joueur doit accepter).
  inviteTournamentPlayer: (id: string, login: string) =>
    request<TournamentInvite>(
      `/tournaments/${encodeURIComponent(id)}/invite`,
      { method: 'POST', body: JSON.stringify({ login }) },
    ),
  acceptTournamentInvite: (tournamentId: string, inviteId: string) =>
    request<{ id: string; inviteId: string; status: string }>(
      `/tournaments/${encodeURIComponent(tournamentId)}/invites/${encodeURIComponent(inviteId)}/accept`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  declineTournamentInvite: (tournamentId: string, inviteId: string) =>
    request<{ id: string; inviteId: string; status: string }>(
      `/tournaments/${encodeURIComponent(tournamentId)}/invites/${encodeURIComponent(inviteId)}/decline`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  // Organisateur/admin : ajoute directement un joueur existant au tournoi.
  addTournamentPlayer: (id: string, login: string) =>
    request<{ id: string; added: string; status: string }>(
      `/tournaments/${encodeURIComponent(id)}/add-player`,
      { method: 'POST', body: JSON.stringify({ login }) },
    ),
  startTournament: (id: string) =>
    request<{ id: string; started: true }>(
      `/tournaments/${encodeURIComponent(id)}/start`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  cancelTournament: (id: string) =>
    request<{ id: string; cancelled: true }>(
      `/tournaments/${encodeURIComponent(id)}/cancel`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  recordTournamentMatch: (
    tournamentId: string,
    matchId: string,
    scoreA: number,
    scoreB: number,
  ) =>
    request<{ id: string; status: string }>(
      `/tournaments/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(matchId)}/record`,
      { method: 'POST', body: JSON.stringify({ scoreA, scoreB }) },
    ),
  confirmTournamentMatch: (
    tournamentId: string,
    matchId: string,
    scoreA: number,
    scoreB: number,
  ) =>
    request<{ id: string; winnerLogin: string; finished: boolean }>(
      `/tournaments/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(matchId)}/confirm`,
      { method: 'POST', body: JSON.stringify({ scoreA, scoreB }) },
    ),
  rejectTournamentMatch: (tournamentId: string, matchId: string) =>
    request<{ id: string; rejected: true }>(
      `/tournaments/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(matchId)}/reject`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  locations: () => request<Record<string, string>>('/locations'),
  health: () => request<{ ok: boolean }>('/health', {}, { auth: false }),

  // ── Admin ──────────────────────────────────────────────────────────────────
  adminUsers: () => request<AdminUser[]>('/admin/users'),
  setStagingAccess: (login: string, grant: boolean) =>
    request<{ login: string; role: string; stagingAccess: boolean }>(
      `/admin/users/${encodeURIComponent(login)}/staging-access`,
      { method: 'POST', body: JSON.stringify({ grant }) },
    ),
  setUserRole: (login: string, role: 'USER' | 'ADMIN') =>
    request<{ login: string; role: string }>(
      `/admin/users/${encodeURIComponent(login)}/role`,
      { method: 'POST', body: JSON.stringify({ role }) },
    ),
  adminSetStats: (
    login: string,
    stats: {
      elo?: number;
      matchesPlayed?: number;
      dodgeCount?: number;
      tournamentsWon?: number;
      eloSmash?: number;
      matchesPlayedSmash?: number;
      tournamentsWonSmash?: number;
      eloChess?: number;
      matchesPlayedChess?: number;
      tournamentsWonChess?: number;
      games?: Game[];
    },
  ) =>
    request<AdminUser>(`/admin/users/${encodeURIComponent(login)}/stats`, {
      method: 'PATCH',
      body: JSON.stringify(stats),
    }),
  adminBanUser: (login: string) =>
    request<{ login: string; bannedAt: string }>(`/admin/users/${encodeURIComponent(login)}/ban`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  adminUnbanUser: (login: string) =>
    request<{ login: string; bannedAt: null }>(`/admin/users/${encodeURIComponent(login)}/unban`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  adminModerationStats: (login: string) =>
    request<ModerationStats>(`/admin/users/${encodeURIComponent(login)}/moderation`),
  adminDeleteMatch: (id: string) =>
    request<{ id: string; deleted: true }>(`/admin/matches/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  adminEditMatch: (id: string, scoreA: number, scoreB: number) =>
    request<PlayedMatch>(`/admin/matches/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ scoreA, scoreB }),
    }),
  // SUPERADMIN : créer un faux joueur, supprimer un faux joueur, forcer un résultat.
  adminCreateUser: (login: string, opts?: { campus?: string; elo?: number }) =>
    request<AdminUser>('/admin/users', {
      method: 'POST',
      body: JSON.stringify({ login, ...opts }),
    }),
  adminDeleteUser: (login: string) =>
    request<{ login: string; deleted: true }>(`/admin/users/${encodeURIComponent(login)}`, {
      method: 'DELETE',
    }),
  // SUPERADMIN : reset total de la ligue. `confirm` doit valoir la phrase exacte.
  adminResetDatabase: (confirm: string) =>
    request<{ reset: true; removedUsers: number; resetUsers: number }>('/admin/reset-database', {
      method: 'POST',
      body: JSON.stringify({ confirm }),
    }),
  adminForceResult: (playerA: string, playerB: string, scoreA: number, scoreB: number) =>
    request<PlayedMatch>('/admin/matches/force-result', {
      method: 'POST',
      body: JSON.stringify({ playerA, playerB, scoreA, scoreB }),
    }),
  // SUPERADMIN : forcer la résolution d'un match en attente (validation ou annulation).
  adminForceConfirmMatch: (id: string) =>
    request<PlayedMatch>(`/admin/matches/${encodeURIComponent(id)}/force-confirm`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  adminForceCancelMatch: (id: string) =>
    request<{ id: string; status: 'cancelled' }>(`/admin/matches/${encodeURIComponent(id)}/force-cancel`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  adminRejectedMatches: () => request<RejectedMatch[]>('/admin/rejected-matches'),
  adminSuspicious: () => request<SuspiciousFlag[]>('/admin/suspicious'),
  adminAuditLog: (filters?: { actor?: string; target?: string; action?: AdminAuditAction; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.actor) params.set('actor', filters.actor);
    if (filters?.target) params.set('target', filters.target);
    if (filters?.action) params.set('action', filters.action);
    if (filters?.limit) params.set('limit', String(filters.limit));
    const qs = params.toString();
    return request<AdminAuditEntry[]>(`/admin/audit-log${qs ? `?${qs}` : ''}`);
  },
  adminDeleteChallenge: (id: string) =>
    request<{ id: string; deleted: true }>(`/admin/challenges/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  adminDeletePendingMatch: (id: string) =>
    request<{ id: string; deleted: true }>(`/admin/pending-matches/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  adminDeleteRejectedMatch: (id: string) =>
    request<{ id: string; deleted: true }>(`/admin/rejected-matches/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  adminDeleteOps: (id: string) =>
    request<{ id: string; deleted: true }>(`/admin/ops/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  adminDeleteTournament: (id: string) =>
    request<{ id: string; deleted: true }>(`/admin/tournaments/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  adminAllHistory: (filters?: { login?: string; type?: AllHistoryEventType; game?: Game; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.login) params.set('login', filters.login);
    if (filters?.type) params.set('type', filters.type);
    if (filters?.game) params.set('game', filters.game);
    if (filters?.limit) params.set('limit', String(filters.limit));
    const qs = params.toString();
    return request<AllHistoryEvent[]>(`/admin/all-history${qs ? `?${qs}` : ''}`);
  },
  createFeatureRequest: (text: string) =>
    request<{ id: string; text: string; status: string; createdAt: string }>(
      '/feature-requests',
      { method: 'POST', body: JSON.stringify({ text }) },
    ),
  featureRequests: () => request<FeatureRequestWithAuthor[]>('/feature-requests'),
  setFeatureRequestStatus: (id: string, status: 'pending' | 'accepted' | 'rejected') =>
    request<FeatureRequestWithAuthor>(`/feature-requests/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  createBugReport: (text: string) =>
    request<{ id: string; text: string; status: string; createdAt: string }>(
      '/bug-reports',
      { method: 'POST', body: JSON.stringify({ text }) },
    ),
  bugReports: () => request<BugReportWithAuthor[]>('/bug-reports'),
  setBugReportStatus: (id: string, status: 'open' | 'resolved' | 'closed') =>
    request<BugReportWithAuthor>(`/bug-reports/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};
