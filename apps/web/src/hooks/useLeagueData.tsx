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
import { getGame, subscribeGame } from '../lib/gameMode';

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
  // Classement ET tournois sont par jeu : on interroge ceux du mode courant.
  leaderboard: async () => ({ leaderboard: await api.leaderboard(getGame()) }),
  tournaments: async () => ({ tournaments: await api.tournaments(getGame()) }),
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
      // On interroge `me` en premier : tant que le consentement RGPD n'est pas donné,
      // la consent-gate du serveur refuse (403) tous les autres endpoints. On évite
      // donc de les appeler — la <ConsentGate> est affichée à la place par AuthenticatedShell.
      const me = await api.me();
      if (me.consentRequired) {
        setData((prev) => ({ ...EMPTY, me, locations: prev.locations }));
        setLoading(false);
        return;
      }
      const [matches, pending, challenges, leaderboard, tournaments, opsMe, allOps] =
        await Promise.all([
          api.playedMatches(),
          api.pendingMatches(),
          api.challenges(),
          api.leaderboard(getGame()),
          api.tournaments(getGame()),
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

  // Changement de mode (babyfoot ↔ smash) : le classement dépend du jeu, on le
  // re-fetch immédiatement pour refléter le bon ranking.
  useEffect(() => {
    if (!authenticated) return;
    return subscribeGame(() => {
      void refreshDomains(['leaderboard', 'tournaments']);
    });
  }, [authenticated, refreshDomains]);

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
  // debounce (absorbe les rafales).
  //
  // Sécurité : on n'expose jamais le Bearer 30 jours dans l'URL (fuite via logs
  // / historique / Referer). On échange d'abord le Bearer contre un token
  // éphémère de scope SSE (api.streamToken, TTL ~60 s) qu'on passe en ?token=.
  // Ce token étant court, on gère la reconnexion nous-mêmes (l'auto-reconnexion
  // native rejouerait la même URL avec un token expiré).
  // `refreshDomainsRef` évite de relancer la connexion à chaque rendu.
  const refreshDomainsRef = useRef(refreshDomains);
  useEffect(() => {
    refreshDomainsRef.current = refreshDomains;
  }, [refreshDomains]);

  useEffect(() => {
    if (!authenticated) return;
    if (!getToken()) return;

    let closed = false;
    let es: EventSource | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let backoffMs = 1000;

    const dirty = new Set<Domain>();
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

    const scheduleReconnect = () => {
      if (closed || reconnect) return;
      reconnect = setTimeout(() => {
        reconnect = undefined;
        void connect();
      }, backoffMs);
      backoffMs = Math.min(backoffMs * 2, 30_000);
    };

    const connect = async () => {
      if (closed) return;
      let streamToken: string;
      try {
        ({ token: streamToken } = await api.streamToken());
      } catch {
        scheduleReconnect();
        return;
      }
      if (closed) return;

      const url = `${getApiBase()}/events?token=${encodeURIComponent(streamToken)}`;
      es = new EventSource(url);

      es.addEventListener('open', () => {
        backoffMs = 1000;
      });
      // `connected` et `ping` (keep-alive) sont ignorés volontairement.
      for (const [type, domains] of Object.entries(EVENT_DOMAINS)) {
        es.addEventListener(type, () => markDirty(domains));
      }
      es.onerror = () => {
        es?.close();
        es = undefined;
        scheduleReconnect();
      };
    };

    // ─── Réveil mobile ────────────────────────────────────────────────────
    // Sur mobile, mettre l'app en arrière-plan gèle (ou tue) l'EventSource sans
    // toujours déclencher `onerror`. Au retour au premier plan, la connexion est
    // morte mais paraît vivante → plus aucune notif tant qu'on ne refresh pas à la
    // main. On force donc une reconnexion (token frais) + un re-fetch complet dès
    // que l'onglet redevient visible / le réseau revient / la fenêtre reprend le
    // focus. `reopenTimer` coalesce les événements qui arrivent souvent groupés.
    let reopenTimer: ReturnType<typeof setTimeout> | undefined;
    const reopen = () => {
      if (closed) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (reopenTimer) clearTimeout(reopenTimer);
      reopenTimer = setTimeout(() => {
        if (closed) return;
        if (reconnect) {
          clearTimeout(reconnect);
          reconnect = undefined;
        }
        backoffMs = 1000;
        es?.close();
        es = undefined;
        void connect();
        markDirty(ALL_DOMAINS); // rattrape les events manqués pendant la veille
      }, 150);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') reopen();
    };
    window.addEventListener('online', reopen);
    window.addEventListener('focus', reopen);
    document.addEventListener('visibilitychange', onVisibility);

    void connect();

    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      if (reconnect) clearTimeout(reconnect);
      if (reopenTimer) clearTimeout(reopenTimer);
      window.removeEventListener('online', reopen);
      window.removeEventListener('focus', reopen);
      document.removeEventListener('visibilitychange', onVisibility);
      es?.close();
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
