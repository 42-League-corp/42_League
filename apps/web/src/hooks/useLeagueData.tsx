import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  AuthError,
  api,
  type Challenge,
  type LeaderboardEntry,
  type MeResponse,
  type Ops,
  type OpsMeResponse,
  type PendingMatch,
  type PlayedMatch,
  type Tournament,
} from '../lib/api';
import { useAuth } from './useAuth';

export interface LeagueData {
  me: MeResponse | null;
  matches: PlayedMatch[];
  pending: PendingMatch[];
  challenges: Challenge[];
  leaderboard: LeaderboardEntry[];
  tournaments: Tournament[];
  opsMe: OpsMeResponse | null;
  allOps: Ops[];
}

interface LeagueDataContextValue extends LeagueData {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const EMPTY: LeagueData = {
  me: null,
  matches: [],
  pending: [],
  challenges: [],
  leaderboard: [],
  tournaments: [],
  opsMe: null,
  allOps: [],
};

const LeagueDataContext = createContext<LeagueDataContextValue | null>(null);

export function LeagueDataProvider({ children }: { children: ReactNode }) {
  const { authenticated, signOut } = useAuth();
  const [data, setData] = useState<LeagueData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authenticated) {
      setData(EMPTY);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
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
      setData({
        me,
        matches,
        pending,
        challenges,
        leaderboard,
        tournaments,
        opsMe,
        allOps,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        signOut();
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }, [authenticated, signOut]);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<LeagueDataContextValue>(
    () => ({ ...data, loading, error, refresh: load }),
    [data, loading, error, load],
  );

  return (
    <LeagueDataContext.Provider value={value}>{children}</LeagueDataContext.Provider>
  );
}

export function useLeagueData(): LeagueDataContextValue {
  const ctx = useContext(LeagueDataContext);
  if (!ctx) throw new Error('useLeagueData must be used within <LeagueDataProvider>');
  return ctx;
}
