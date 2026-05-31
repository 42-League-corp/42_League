import { useEffect } from 'react';
import { useGameMode } from '../hooks/useGameMode';
import type { Game } from '../lib/gameMode';

const LABEL: Record<Game, string> = { babyfoot: 'Babyfoot', smash: 'Smash' };

/**
 * Applique `data-game` sur <html> pour le thème conditionnel (accent rouge en smash).
 */
export function useGameModeTheme(): void {
  const { game } = useGameMode();
  useEffect(() => {
    document.documentElement.dataset.game = game;
  }, [game]);
}

/** Glyphe représentant le jeu (babyfoot : joueur sur barre ; smash : Smash Ball). */
function ModeGlyph({ game, size = 30 }: { game: Game; size?: number }) {
  if (game === 'smash') {
    // Smash Ball stylisée : sphère + swirl.
    return (
      <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
        <defs>
          <radialGradient id="smashball" cx="38%" cy="32%" r="70%">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="45%" stopColor="#ff8a3a" />
            <stop offset="100%" stopColor="#d11f2f" />
          </radialGradient>
        </defs>
        <circle cx="16" cy="16" r="14" fill="url(#smashball)" stroke="#fff" strokeWidth="1.5" />
        <path
          d="M16 3 C12 12 12 20 16 29 M3 16 C12 12 20 12 29 16"
          fill="none"
          stroke="#7a0d15"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.85"
        />
      </svg>
    );
  }
  // Babyfoot : barre horizontale + figurine + ballon.
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <rect x="3" y="6" width="26" height="2.4" rx="1.2" fill="currentColor" opacity="0.65" />
      <rect x="14.6" y="6" width="2.8" height="14" rx="1.2" fill="currentColor" />
      <circle cx="16" cy="13" r="3.4" fill="currentColor" />
      <rect x="11.5" y="16" width="9" height="6" rx="1.6" fill="currentColor" />
      <circle cx="16" cy="26" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/**
 * Bouton rond flottant (bas droite) qui affiche le mode ACTUEL via son glyphe, et
 * bascule au clic. Une pastille « actuel » + le nom du mode lèvent l'ambiguïté.
 * Doré en babyfoot, rouge en smash.
 */
export function GameModeSwitch() {
  const { game, setGame } = useGameMode();
  useGameModeTheme();

  const isSmash = game === 'smash';
  const other: Game = isSmash ? 'babyfoot' : 'smash';
  const toggle = () => setGame(other);

  return (
    <div className="fixed right-3 bottom-20 sm:bottom-4 z-[90] flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-label={`Mode actuel : ${LABEL[game]}. Cliquer pour passer en ${LABEL[other]}.`}
        title={`Mode ${LABEL[game]} (actuel) · cliquer pour passer en ${LABEL[other]}`}
        className={`relative grid place-items-center w-14 h-14 rounded-full border-2 shadow-xl backdrop-blur-md transition-all active:scale-95 ${
          isSmash
            ? 'bg-[#1a0c0e]/90 border-red text-red shadow-[0_8px_26px_-6px_rgba(255,77,92,0.7)]'
            : 'bg-bg-2/90 border-gold text-gold shadow-[0_8px_26px_-6px_rgba(255,201,74,0.6)]'
        }`}
      >
        <ModeGlyph game={game} />
        {/* Pastille « actuel » */}
        <span
          className={`absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider border ${
            isSmash
              ? 'bg-red text-white border-[#1a0c0e]'
              : 'bg-gold text-[#1a1100] border-bg-1'
          }`}
        >
          actuel
        </span>
      </button>
      <span
        className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-[0.14em] border backdrop-blur-md ${
          isSmash ? 'text-red border-red/50 bg-[#1a0c0e]/80' : 'text-gold border-gold/50 bg-bg-2/80'
        }`}
      >
        {LABEL[game]}
      </span>
    </div>
  );
}
