import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type MatchmakingOpponent } from '../lib/api';
import { useGameMode } from './useGameMode';

export type MatchmakingState = 'idle' | 'searching' | 'matched';

const POLL_INTERVAL_MS = 2500;

/**
 * Gère le flux « Match aléatoire » (matchmaking queue) :
 *   idle → start() → searching (polling) → matched → dismiss() → idle.
 *
 * - start()   : rejoint la file (api.queueJoin). Si déjà apparié, passe direct
 *               en `matched`. Sinon `searching` + polling de api.queueStatus.
 * - cancel()  : quitte la file (api.queueLeave) et revient à `idle`.
 * - dismiss() : ferme l'overlay versus, revient à `idle`, et navigue vers les
 *               défis pour jouer le duel créé.
 * - cleanup   : au démontage pendant la recherche, quitte la file + clear timer.
 */
export function useMatchmaking() {
  const { game } = useGameMode();
  const navigate = useNavigate();

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

  const start = useCallback(async () => {
    if (searchingRef.current) return;
    searchingRef.current = true;
    setState('searching');
    setOpponent(null);
    try {
      const res = await api.queueJoin(game);
      if (res.matched) {
        searchingRef.current = false;
        setOpponent(res.opponent ?? null);
        setState('matched');
        return;
      }
      // Toujours en recherche : démarre le polling.
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const status = await api.queueStatus();
          if (status.state === 'matched') {
            stopPolling();
            searchingRef.current = false;
            setOpponent(status.opponent ?? null);
            setState('matched');
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
  }, [game, stopPolling]);

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

  // Nettoyage au démontage : quitte la file si on cherchait encore.
  useEffect(() => {
    return () => {
      stopPolling();
      if (searchingRef.current) {
        searchingRef.current = false;
        void api.queueLeave().catch(() => {});
      }
    };
  }, [stopPolling]);

  return { state, opponent, start, cancel, dismiss };
}
