import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type MatchmakingOpponent } from '../lib/api';
import { useGameMode } from './useGameMode';
import { useLeagueData } from './useLeagueData';

export type MatchmakingState = 'idle' | 'searching' | 'matched';

const POLL_INTERVAL_MS = 2500;

interface MatchmakingContextValue {
  state: MatchmakingState;
  opponent: MatchmakingOpponent | null;
  start: () => Promise<void>;
  cancel: () => Promise<void>;
  dismiss: () => void;
}

const MatchmakingContext = createContext<MatchmakingContextValue | null>(null);

/**
 * Provider global du flux « Match aléatoire » (matchmaking queue) :
 *   idle → start() → searching (polling) → matched → dismiss() → idle.
 *
 * Monté HAUT dans l'arbre (au-dessus de l'AppShell, cf. AuthenticatedShell), il
 * survit aux changements de page : on peut lancer une recherche sur les défis,
 * naviguer ailleurs, et rester dans la file (le polling continue). Quand un
 * adversaire est trouvé, l'overlay VERSUS (cf. MatchmakingOverlay, monté lui aussi
 * globalement dans l'AppShell) s'affiche QUELLE QUE SOIT la page courante.
 *
 * - start()   : rejoint la file (api.queueJoin). Si déjà apparié, passe direct
 *               en `matched`. Sinon `searching` + polling de api.queueStatus.
 * - cancel()  : quitte la file (api.queueLeave) et revient à `idle`.
 * - dismiss() : ferme l'overlay versus, revient à `idle`, et navigue vers les
 *               défis pour jouer le duel créé.
 * - cleanup   : au démontage (= logout / sortie du shell) pendant la recherche,
 *               quitte la file + clear timer. Un simple changement de route ne
 *               démonte PAS le provider → la recherche persiste.
 */
export function MatchmakingProvider({ children }: { children: ReactNode }) {
  const { game } = useGameMode();
  const navigate = useNavigate();
  const { refresh } = useLeagueData();

  const [state, setState] = useState<MatchmakingState>('idle');
  const [opponent, setOpponent] = useState<MatchmakingOpponent | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Permet au cleanup de démontage de savoir s'il faut quitter la file.
  const searchingRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Bascule en `matched` : stoppe le polling, retient l'adversaire, et rafraîchit
  // les données ligue pour que le duel (Challenge `accepted`) apparaisse aussitôt
  // dans la liste « duels à jouer ».
  const onMatched = useCallback(
    (opp: MatchmakingOpponent | null) => {
      stopPolling();
      searchingRef.current = false;
      setOpponent(opp);
      setState('matched');
      void refresh();
    },
    [refresh, stopPolling],
  );

  const start = useCallback(async () => {
    if (searchingRef.current) return;
    searchingRef.current = true;
    setState('searching');
    setOpponent(null);
    try {
      const res = await api.queueJoin(game);
      if (res.matched) {
        onMatched(res.opponent ?? null);
        return;
      }
      // Toujours en recherche : démarre le polling.
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const status = await api.queueStatus();
          if (status.state === 'matched') {
            onMatched(status.opponent ?? null);
          }
        } catch {
          /* erreur réseau transitoire : on retentera au prochain tick */
        }
      }, POLL_INTERVAL_MS);
    } catch {
      searchingRef.current = false;
      stopPolling();
      setState('idle');
    }
  }, [game, onMatched, stopPolling]);

  const cancel = useCallback(async () => {
    stopPolling();
    searchingRef.current = false;
    setState('idle');
    setOpponent(null);
    try {
      await api.queueLeave();
    } catch {
      /* best-effort */
    }
  }, [stopPolling]);

  const dismiss = useCallback(() => {
    stopPolling();
    searchingRef.current = false;
    setState('idle');
    setOpponent(null);
    navigate('/challenges');
  }, [navigate, stopPolling]);

  // Nettoyage au démontage du provider (logout / sortie du shell) : quitte la file
  // si on cherchait encore. Une navigation entre pages ne démonte pas le provider.
  useEffect(() => {
    return () => {
      stopPolling();
      if (searchingRef.current) {
        searchingRef.current = false;
        void api.queueLeave().catch(() => {});
      }
    };
  }, [stopPolling]);

  return (
    <MatchmakingContext.Provider value={{ state, opponent, start, cancel, dismiss }}>
      {children}
    </MatchmakingContext.Provider>
  );
}

/**
 * Accès au flux matchmaking global. Doit être appelé sous <MatchmakingProvider>.
 */
export function useMatchmaking(): MatchmakingContextValue {
  const ctx = useContext(MatchmakingContext);
  if (!ctx) throw new Error('useMatchmaking must be used within a MatchmakingProvider');
  return ctx;
}
