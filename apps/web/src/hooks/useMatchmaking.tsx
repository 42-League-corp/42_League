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
import type { Game } from '../lib/gameMode';
import { setGame } from '../lib/gameMode';
import { useLeagueData } from './useLeagueData';

export type MatchmakingState = 'idle' | 'searching' | 'matched';

const POLL_INTERVAL_MS = 2500;

/** Appariement à afficher dans l'overlay VERSUS. */
interface Matched {
  game: Game;
  opponent: MatchmakingOpponent | null;
}

interface MatchmakingContextValue {
  /** Modes dont la recherche « match aléatoire » est en cours (indépendants). */
  searching: Game[];
  /** Appariement courant à afficher (overlay VERSUS), ou null. */
  matched: Matched | null;
  /** Lance/rejoint la file du mode donné. */
  start: (game: Game) => Promise<void>;
  /** Quitte la file du mode donné. */
  cancel: (game: Game) => Promise<void>;
  /** Ferme l'overlay courant (et enchaîne sur l'appariement suivant s'il y en a). */
  dismiss: () => void;
}

const MatchmakingContext = createContext<MatchmakingContextValue | null>(null);

/**
 * Provider global du flux « Match aléatoire » (matchmaking queue), désormais
 * INDÉPENDANT PAR MODE de jeu : on peut chercher un adversaire en babyfoot ET en
 * smash ET en SF en même temps. Chaque recherche a sa propre pastille (cf.
 * MatchmakingButton) ; un seul polling global suffit (un joueur = une connexion).
 *
 * Monté HAUT dans l'arbre (au-dessus de l'AppShell) → survit aux changements de
 * page : on lance une recherche, on navigue, et l'overlay VERSUS (cf.
 * MatchmakingOverlay) s'affiche QUELLE QUE SOIT la page quand un mode trouve un
 * adversaire — en montrant le LOGO du mode concerné.
 *
 * - start(game)  : rejoint la file `game`. Apparié direct → overlay ; sinon
 *                  ajout à `searching` + (re)démarrage du polling global.
 * - cancel(game) : quitte la file `game`.
 * - dismiss()    : ferme l'overlay, bascule sur le mode apparié (pour voir le
 *                  duel), enchaîne sur l'appariement suivant en attente s'il y en
 *                  a, sinon navigue vers les défis.
 * - cleanup      : au démontage (logout) en pleine recherche → quitte TOUTES les
 *                  files. Un changement de route ne démonte pas le provider.
 */
export function MatchmakingProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { refresh } = useLeagueData();

  const [searching, setSearching] = useState<Game[]>([]);
  const searchingRef = useRef<Game[]>([]);
  searchingRef.current = searching;

  const [matched, setMatched] = useState<Matched | null>(null);
  const matchedRef = useRef<Matched | null>(null);
  matchedRef.current = matched;
  // Appariements supplémentaires en attente d'affichage (plusieurs modes trouvés
  // au même tick) — défilés un par un via dismiss().
  const pendingRef = useRef<Matched[]>([]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Empile un appariement : affiché tout de suite si l'overlay est libre, sinon
  // mis en file d'attente. Rafraîchit les données ligue pour que le duel créé
  // (Challenge `accepted`) apparaisse aussitôt dans « duels à jouer ».
  const pushMatch = useCallback(
    (m: Matched) => {
      if (matchedRef.current) pendingRef.current.push(m);
      else setMatched(m);
      void refresh();
    },
    [refresh],
  );

  const ensurePolling = useCallback(() => {
    if (pollRef.current !== null) return;
    pollRef.current = setInterval(async () => {
      try {
        const status = await api.queueStatus();
        for (const m of status.matches ?? []) {
          setSearching((prev) => prev.filter((g) => g !== m.game));
          pushMatch({ game: m.game, opponent: m.opponent ?? null });
        }
        // Plus aucune file active et aucun match à venir → on arrête de poller.
        if (searchingRef.current.length === 0) stopPolling();
      } catch {
        /* erreur réseau transitoire : on retentera au prochain tick */
      }
    }, POLL_INTERVAL_MS);
  }, [pushMatch, stopPolling]);

  const start = useCallback(
    async (game: Game) => {
      if (searchingRef.current.includes(game)) return;
      setSearching((prev) => (prev.includes(game) ? prev : [...prev, game]));
      try {
        const res = await api.queueJoin(game);
        if (res.matched) {
          setSearching((prev) => prev.filter((g) => g !== game));
          pushMatch({ game: res.game ?? game, opponent: res.opponent ?? null });
          return;
        }
        ensurePolling();
      } catch {
        setSearching((prev) => prev.filter((g) => g !== game));
      }
    },
    [ensurePolling, pushMatch],
  );

  const cancel = useCallback(async (game: Game) => {
    setSearching((prev) => prev.filter((g) => g !== game));
    try {
      await api.queueLeave(game);
    } catch {
      /* best-effort */
    }
  }, []);

  const dismiss = useCallback(() => {
    const cur = matchedRef.current;
    const next = pendingRef.current.shift() ?? null;
    setMatched(next);
    // Bascule sur le mode apparié pour que le duel soit visible, puis navigue
    // (seulement quand plus aucun overlay ne suit).
    if (cur) setGame(cur.game);
    if (!next) navigate('/challenges');
  }, [navigate]);

  // Nettoyage au démontage du provider (logout / sortie du shell) : quitte toutes
  // les files si on cherchait encore. Une navigation entre pages ne démonte pas.
  useEffect(() => {
    return () => {
      stopPolling();
      if (searchingRef.current.length > 0) {
        void api.queueLeave().catch(() => {});
      }
    };
  }, [stopPolling]);

  return (
    <MatchmakingContext.Provider value={{ searching, matched, start, cancel, dismiss }}>
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
