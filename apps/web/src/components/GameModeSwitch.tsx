import { useEffect } from 'react';
import { useGameMode } from '../hooks/useGameMode';
import type { Game } from '../lib/gameMode';

const ORDER: Game[] = ['babyfoot', 'smash', 'chess'];
const LABEL: Record<Game, string> = { babyfoot: 'Babyfoot', smash: 'Smash', chess: 'Échecs' };

/** Applique `data-game` sur <html> pour le thème conditionnel (or / rouge / vert). */
export function useGameModeTheme(): void {
  const { game } = useGameMode();
  useEffect(() => {
    document.documentElement.dataset.game = game;
  }, [game]);
}

/** Glyphe représentant le jeu : babyfoot, Smash Ball, ou pièce d'échecs. */
function ModeGlyph({ game, size = 30 }: { game: Game; size?: number }) {
  if (game === 'smash') {
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
  if (game === 'chess') {
    // Roi d'échecs stylisé.
    return (
      <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
        <rect x="9" y="4" width="2.2" height="0" />
        <path d="M16 3 v5 M13.5 5.5 h5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M16 9 C12 9 11 13 14 16 L12 24 h8 l-2 -8 C21 13 20 9 16 9 Z" fill="currentColor" />
        <rect x="10" y="24" width="12" height="3.5" rx="1.4" fill="currentColor" />
        <rect x="8.5" y="27" width="15" height="3" rx="1.4" fill="currentColor" />
      </svg>
    );
  }
  // Babyfoot : barre + figurine + ballon.
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

const STYLE: Record<Game, { ring: string; glow: string; badge: string }> = {
  babyfoot: {
    ring: 'bg-bg-2/90 border-gold text-gold',
    glow: '0 8px 26px -6px rgba(255,201,74,0.6)',
    badge: 'bg-gold text-[#1a1100] border-bg-1',
  },
  smash: {
    ring: 'bg-[#1a0c0e]/90 border-red text-red',
    glow: '0 8px 26px -6px rgba(255,77,92,0.7)',
    badge: 'bg-red text-white border-[#1a0c0e]',
  },
  chess: {
    ring: 'bg-[#0c1a10]/90 border-[#56c46e] text-[#56c46e]',
    glow: '0 8px 26px -6px rgba(86,196,110,0.6)',
    badge: 'bg-[#56c46e] text-[#06160c] border-[#0c1a10]',
  },
};

/**
 * Bouton rond flottant (bas droite) : affiche le glyphe du mode ACTUEL et, au
 * clic, passe au mode suivant (babyfoot → smash → échecs → …). Une pastille
 * « actuel » + le nom lèvent l'ambiguïté. Or / rouge / vert selon le mode.
 */
export function GameModeSwitch() {
  const { game, setGame } = useGameMode();
  useGameModeTheme();

  const next = ORDER[(ORDER.indexOf(game) + 1) % ORDER.length]!;
  const s = STYLE[game];

  return (
    <div className="fixed right-3 bottom-20 sm:bottom-4 z-[90] flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => setGame(next)}
        aria-label={`Mode actuel : ${LABEL[game]}. Cliquer pour passer en ${LABEL[next]}.`}
        title={`Mode ${LABEL[game]} (actuel) · cliquer pour passer en ${LABEL[next]}`}
        className={`relative grid place-items-center w-14 h-14 rounded-full border-2 shadow-xl backdrop-blur-md transition-all active:scale-95 ${s.ring}`}
        style={{ boxShadow: s.glow }}
      >
        <ModeGlyph game={game} />
        <span
          className={`absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider border ${s.badge}`}
        >
          actuel
        </span>
      </button>
      <span
        className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-[0.14em] border backdrop-blur-md ${s.ring}`}
      >
        {LABEL[game]}
      </span>
    </div>
  );
}
