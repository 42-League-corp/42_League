import { useEffect } from 'react';
import { Gamepad2, CircleDot } from 'lucide-react';
import { useGameMode } from '../hooks/useGameMode';
import type { Game } from '../lib/gameMode';

const LABEL: Record<Game, string> = { babyfoot: 'Babyfoot', smash: 'Smash' };

/**
 * Applique `data-game` sur <html> pour permettre un thème conditionnel en CSS.
 * Monté une fois (dans le shell) en plus du switch.
 */
export function useGameModeTheme(): void {
  const { game } = useGameMode();
  useEffect(() => {
    document.documentElement.dataset.game = game;
  }, [game]);
}

/**
 * Switch flottant babyfoot ↔ smash, en bas à droite (desktop) — petit, discret,
 * toujours accessible. Sur mobile, on l'affiche un cran plus haut pour ne pas
 * recouvrir la tab-bar (voir `bottom` responsive).
 */
export function GameModeSwitch() {
  const { game, setGame } = useGameMode();
  useGameModeTheme();

  const toggle = () => setGame(game === 'smash' ? 'babyfoot' : 'smash');
  const isSmash = game === 'smash';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Mode ${LABEL[game]} — cliquer pour basculer`}
      title={`Mode ${LABEL[game]} · basculer`}
      className={`fixed right-3 bottom-20 sm:bottom-4 z-[90] inline-flex items-center gap-2 rounded-full pl-2.5 pr-3 py-2 border shadow-xl backdrop-blur-md transition-all active:scale-95 ${
        isSmash
          ? 'bg-[#7b1fa2]/85 border-[#c97bff]/60 text-white shadow-[0_8px_24px_-6px_rgba(201,123,255,0.6)]'
          : 'bg-bg-2/90 border-gold/50 text-gold shadow-[0_8px_24px_-6px_rgba(255,201,74,0.5)]'
      }`}
    >
      {isSmash ? (
        <Gamepad2 className="w-4 h-4" strokeWidth={2.5} />
      ) : (
        <CircleDot className="w-4 h-4" strokeWidth={2.5} />
      )}
      <span className="text-[11px] font-extrabold uppercase tracking-[0.14em]">{LABEL[game]}</span>
    </button>
  );
}
