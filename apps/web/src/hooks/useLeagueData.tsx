import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { getApiBase } from '../lib/config';
import { getToken } from '../lib/storage';

export interface LeagueData {
  me: MeResponse | null;
  matches: PlayedMatch[];
  pending: PendingMatch[];
  challenges: Challenge[];
  leaderboard: LeaderboardEntry[];
  tournaments: Tournament[];
  opsMe: OpsMeResponse | null;
  allOps: Ops[];
  /** login → host (ex. "c1r7s8") pour les users connectés à l'école. Poolé toutes les 5 min. */
  locations: Map<string, string>;
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
  locations: new Map(),
};

// ─── Temps réel : domaines de données ──────────────────────────────────────
// Chaque "domaine" correspond à une tranche du state qu'on peut rafraîchir
// indépendamment. À réception d'un event SSE, on ne re-fetch QUE les domaines
// concernés (et non les 8 endpoints).
type Domain = 'me' | 'matches' | 'challenges' | 'leaderboard' | 'tournaments' | 'ops';

const ALL_DOMAINS: Domain[] = [
  'me',
  'matches',
  'challenges',
  'leaderboard',
  'tournaments',
  'ops',
];

const DOMAIN_FETCHERS: Record<Domain, () => Promise<Partial<LeagueData>>> = {
  me: async () => ({ me: await api.me() }),
  matches: async () => {
    const [matches, pending] = await Promise.all([
      api.playedMatches(),
      api.pendingMatches(),
    ]);
    return { matches, pending };
  },
  challenges: async () => ({ challenges: await api.challenges() }),
  leaderboard: async () => ({ leaderboard: await api.leaderboard() }),
  tournaments: async () => ({ tournaments: await api.tournaments() }),
  ops: async () => {
    const [opsMe, allOps] = await Promise.all([
      api.opsMe().catch(() => null),
      api.opsList().catch(() => [] as Ops[]),
    ]);
    return { opsMe, allOps };
  },
};

// Type d'événement SSE → domaine(s) à ré-interroger.
const EVENT_DOMAINS: Record<string, Domain[]> = {
  'match:pending': ['matches'],
  'match:confirmed': ['matches', 'me'],
  'match:rejected': ['matches'],
  'match:cancelled': ['matches'],
  'match:expired': ['matches'],
  'challenge:received': ['challenges'],
  'challenge:accepted': ['challenges'],
  'challenge:declined': ['challenges'],
  'challenge:recorded': ['matches', 'challenges'],
  'leaderboard:update': ['leaderboard'],
  'tournament:update': ['tournaments'],
  'ops:update': ['ops'],
  'data:update': ALL_DOMAINS,
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
      setData((prev) => ({
        me,
        matches,
        pending,
        challenges,
        leaderboard,
        tournaments,
        opsMe,
        allOps,
        // `locations` est alimenté par un poller séparé → on préserve l'existant
        // au lieu de l'écraser (sinon le type LeagueData est incomplet + perte des hôtes).
        locations: prev.locations,
      }));
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

  // Rafraîchit UNIQUEMENT les domaines demandés et fusionne dans le state.
  // (refresh partiel : pas de spinner global, pas d'écran d'erreur si ça échoue.)
  const refreshDomains = useCallback(
    async (domains: Domain[]) => {
      if (!authenticated || domains.length === 0) return;
      try {
        const patches = await Promise.all(domains.map((d) => DOMAIN_FETCHERS[d]()));
        const merged = Object.assign({}, ...patches) as Partial<LeagueData>;
        setData((prev) => ({ ...prev, ...merged }));
      } catch (err) {
        if (err instanceof AuthError) signOut();
      }
    },
    [authenticated, signOut],
  );

  // ─── Locations 42 (polling 5 min) ─────────────────────────────────────
  useEffect(() => {
    if (!authenticated) return;
    const fetchLocations = async () => {
      try {
        const raw = await api.locations();
        setData((prev) => ({ ...prev, locations: new Map(Object.entries(raw)) }));
      } catch {
        // silently ignore — pas critique
      }
    };
    void fetchLocations();
    const interval = setInterval(fetchLocations, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [authenticated]);

  // ─── Temps réel (SSE) ──────────────────────────────────────────────────
  // On s'abonne au flux /events. Chaque event indique quel(s) domaine(s) ont
  // changé ; on accumule les domaines "sales" et on les re-fetch après un léger
  // debounce (absorbe les rafales). EventSource reconnecte automatiquement.
  // `refreshDomainsRef` évite de relancer la connexion à chaque rendu.
  const refreshDomainsRef = useRef(refreshDomains);
  useEffect(() => {
    refreshDomainsRef.current = refreshDomains;
  }, [refreshDomains]);

  useEffect(() => {
    if (!authenticated) return;
    const token = getToken();
    if (!token) return;

    const url = `${getApiBase()}/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    const dirty = new Set<Domain>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      const domains = [...dirty];
      dirty.clear();
      void refreshDomainsRef.current(domains);
    };
    const markDirty = (domains: Domain[]) => {
      for (const d of domains) dirty.add(d);
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 250);
    };

    const listeners = Object.entries(EVENT_DOMAINS).map(([type, domains]) => {
      const handler = () => markDirty(domains);
      es.addEventListener(type, handler);
      return [type, handler] as const;
    });
    // `connected` et `ping` (keep-alive) sont ignorés volontairement.

    return () => {
      if (timer) clearTimeout(timer);
      for (const [type, handler] of listeners) es.removeEventListener(type, handler);
      es.close();
    };
  }, [authenticated]);

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
