import { useSyncExternalStore } from 'react';
import { getGame, setGame, subscribeGame, type Game } from '../lib/gameMode';

/**
 * Hook React pour le mode de jeu courant (babyfoot | smash). Source de vérité =
 * module `lib/gameMode` (partagé avec la couche data).
 */
export function useGameMode(): { game: Game; isSmash: boolean; setGame: (g: Game) => void } {
  const game = useSyncExternalStore(subscribeGame, getGame, getGame);
  return { game, isSmash: game === 'smash', setGame };
}
