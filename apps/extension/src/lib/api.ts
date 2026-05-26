import { getApiBase } from './config.js';
import { clearToken, getToken } from './storage.js';

export interface LeaderboardEntry {
  rank: number;
  login: string;
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
}

export interface Challenge {
  id: string;
  challengerLogin: string;
  opponentLogin: string;
  status: 'pending' | 'accepted' | 'declined' | 'recorded' | 'cancelled';
  scheduledAt: string;
  createdAt: string;
  decidedAt: string | null;
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
}

export interface MeResponse {
  login: string;
  isAdmin?: boolean;
  user: {
    login: string;
    elo: number;
    matchesPlayed: number;
    campus: string | null;
    imageUrl: string | null;
    title: string | null;
    dodgeCount: number;
    tournamentsWon: number;
  } | null;
}

export interface Ops {
  id: string;
  ownerLogin: string;
  targetLogin: string;
  declaredAt: string;
  expiresAt: string;
  owner?: { login: string; imageUrl: string | null };
  target?: { login: string; imageUrl: string | null };
}

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
    elo: number;
    matchesPlayed: number;
    campus: string | null;
    imageUrl: string | null;
    title: string | null;
    dodgeCount: number;
    tournamentsWon: number;
    createdAt: string;
  };
  rank: number | null;
  wins: number;
  losses: number;
  recent: PlayedMatch[];
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
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

export interface Tournament {
  id: string;
  name: string;
  kind: 'friendly' | 'official';
  capacity: number;
  status: 'registration' | 'in_progress' | 'finished' | 'cancelled';
  createdByLogin: string;
  winnerLogin: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  entries?: TournamentEntry[];
  matches?: TournamentMatch[];
  winner?: { login: string; imageUrl: string | null } | null;
}

export class AuthError extends Error {}

// Détection: sommes-nous injectés dans une page web (comme l'intra) ?
const IS_CONTENT_SCRIPT =
  typeof window !== 'undefined' &&
  window.location &&
  window.location.protocol.startsWith('http');

export async function rawRequest<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = { auth: true },
): Promise<T> {
  const headers = new Headers(init.headers);
  if (options.auth !== false) {
    const token = await getToken();
    if (!token) throw new AuthError('not authenticated');
    headers.set('authorization', `Bearer ${token}`);
  }
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const base = await getApiBase();
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (res.status === 401) {
    await clearToken();
    throw new AuthError('session expired');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${body ? ` — ${body}` : ''}`);
  }
  return (await res.json()) as T;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = { auth: true },
): Promise<T> {
  if (IS_CONTENT_SCRIPT) {
    return new Promise((resolve, reject) => {
      const serializedInit = { method: init.method, body: init.body };
      chrome.runtime.sendMessage(
        { type: 'api:proxy', path, init: serializedInit, options },
        (response) => {
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          if (!response || !response.ok) {
            const errMsg = response?.error || 'Unknown proxy error';
            if (errMsg === 'session expired' || errMsg === 'not authenticated') {
              return reject(new AuthError(errMsg));
            }
            return reject(new Error(errMsg));
          }
          resolve(response.data as T);
        }
      );
    });
  }

  return rawRequest<T>(path, init, options);
}

export const api = {
  me: () => request<MeResponse>('/me'),
  leaderboard: () => request<LeaderboardEntry[]>('/leaderboard'),
  pendingMatches: () => request<PendingMatch[]>('/matches/pending'),
  playedMatches: () => request<PlayedMatch[]>('/matches'),
  declareMatch: (input: {
    opponentLogin: string;
    scoreSelf: number;
    scoreOpponent: number;
  }) =>
    request<{ id: string; status: 'pending' }>('/matches', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  confirmMatch: (id: string, scoreSelf: number, scoreOpponent: number) =>
    request<PlayedMatch>(`/matches/${encodeURIComponent(id)}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ scoreSelf, scoreOpponent }),
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
  challenges: () => request<Challenge[]>('/challenges'),
  createChallenge: (input: { opponentLogin: string; scheduledAt: string }) =>
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
    request<{ id: string; status: string }>(
      `/challenges/${encodeURIComponent(id)}/decline`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  recordChallengeResult: (
    id: string,
    scoreSelf: number,
    scoreOpponent: number,
  ) =>
    request<{ pendingId: string; status: 'pending_confirmation' }>(
      `/challenges/${encodeURIComponent(id)}/record`,
      {
        method: 'POST',
        body: JSON.stringify({ scoreSelf, scoreOpponent }),
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
  tournaments: () => request<Tournament[]>('/tournaments'),
  tournament: (id: string) =>
    request<Tournament>(`/tournaments/${encodeURIComponent(id)}`),
  createTournament: (input: {
    name: string;
    capacity: 4 | 8;
    kind: 'friendly' | 'official';
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
  health: () => request<{ ok: boolean }>('/health', {}, { auth: false }),
};