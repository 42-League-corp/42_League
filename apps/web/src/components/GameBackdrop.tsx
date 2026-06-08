import { memo, useEffect, useState } from 'react';
import { useGameMode } from '../hooks/useGameMode';
import { useTransitionPhase } from '../hooks/useTransitionPhase';
import { gameColor } from '../lib/gameVisuals';
import type { Game } from '../lib/gameMode';

/**
 * Décor d'univers — photo héro plein écran (ambiance, jamais sujet) + scrim de
 * lisibilité, orchestré avec la cinématique de changement d'univers
 * (UniverseTransition) :
 *
 *  - idle / exit / enter : photo très assombrie, le HUD reste lisible.
 *  - reveal              : le scrim se lève (photo 4K exposée), la photo
 *                          cross-fade vers le nouvel univers, et le grand
 *                          symbole du jeu surgit au centre.
 *
 * Cross-fade = 2 slots <img> superposés dont on échange l'opacité. La bascule
 * est gatée sur la phase `reveal` → la nouvelle photo apparaît pile quand les
 * blocs ont disparu. Les 5 photos sont préchargées au montage pour un fondu
 * instantané (pas de flash blanc au 1er passage).
 */

interface UniverseArt {
  bg: string;
  prop: string;
  /** Grand logo/symbole affiché au centre pendant la transition. */
  symbol: string;
}

const ART: Record<Game, UniverseArt> = {
  babyfoot:      { bg: '/universe/babyfoot.jpg',      prop: '/universe/babyfoot-prop.png',      symbol: '/universe/babyfoot-symbol.png' },
  smash:         { bg: '/universe/smash.jpg',         prop: '/universe/smash-prop.png',         symbol: '/universe/smash-symbol.png' },
  chess:         { bg: '/universe/chess.jpg',         prop: '/universe/chess-prop.png',         symbol: '/universe/chess-symbol.png' },
  streetfighter: { bg: '/universe/streetfighter.jpg', prop: '/universe/streetfighter-prop.png', symbol: '/universe/streetfighter-symbol.png' },
  flechettes:    { bg: '/universe/flechettes.jpg',    prop: '/universe/flechettes-prop.png',    symbol: '/universe/flechettes-symbol.png' },
};

const IMG_FILTER = 'blur(14px) saturate(0.85) brightness(0.38)';

function GameBackdropImpl() {
  const { game } = useGameMode();
  const phase = useTransitionPhase();
  const revealed = phase === 'reveal';
  const transitioning = phase !== 'idle';

  // Précharge les 5 photos une fois → cross-fade instantané ensuite.
  useEffect(() => {
    Object.values(ART).forEach(({ bg }) => {
      const im = new Image();
      im.src = bg;
    });
  }, []);

  // 2 slots pour le cross-fade. `active` = slot affiché. On ne bascule QU'À la
  // phase reveal (sinon la photo changerait pendant que les blocs partent).
  const [slotA, setSlotA] = useState<Game>(game);
  const [slotB, setSlotB] = useState<Game | null>(null);
  const [active, setActive] = useState<'A' | 'B'>('A');
  const activeGame = active === 'A' ? slotA : slotB;

  useEffect(() => {
    if (phase !== 'reveal') return;
    if (activeGame === game) return;
    // Charge la nouvelle photo dans le slot inactif puis bascule l'opacité.
    if (active === 'A') {
      setSlotB(game);
      requestAnimationFrame(() => setActive('B'));
    } else {
      setSlotA(game);
      requestAnimationFrame(() => setActive('A'));
    }
  }, [phase, game, active, activeGame]);

  const accent = gameColor(game);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Slot A */}
      <img
        src={ART[slotA].bg}
        alt=""
        className="absolute inset-0 h-full w-full select-none object-cover"
        draggable={false}
        loading="eager"
        fetchPriority="low"
        decoding="async"
        style={{
          opacity: active === 'A' ? 1 : 0,
          filter: IMG_FILTER,
          transform: revealed ? 'scale(1.02)' : 'scale(1.08)',
          transition: 'opacity 360ms ease, transform 760ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />
      {/* Slot B */}
      {slotB && (
        <img
          src={ART[slotB].bg}
          alt=""
          className="absolute inset-0 h-full w-full select-none object-cover"
          draggable={false}
          loading="eager"
          fetchPriority="low"
          decoding="async"
          style={{
            opacity: active === 'B' ? 1 : 0,
            filter: IMG_FILTER,
            transform: revealed ? 'scale(1.02)' : 'scale(1.08)',
            transition: 'opacity 360ms ease, transform 760ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      )}

      {/* Voile plat — se lève pendant REVEAL pour exposer la photo 4K. */}
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(8,6,4,1)',
          opacity: revealed ? 0.16 : 0.55,
          transition: 'opacity 300ms ease',
        }}
      />

      {/* Vignette radiale. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 80% at 50% 45%, transparent 0%, rgba(8,6,4,0.6) 100%)',
          opacity: revealed ? 0.35 : 1,
          transition: 'opacity 300ms ease',
        }}
      />

      {/* GRAND SYMBOLE DU JEU — surgit au centre pendant la transition, peak à
          REVEAL, s'efface quand les blocs reviennent. */}
      <div className="absolute inset-0 grid place-items-center">
        <img
          src={ART[game].symbol}
          alt=""
          draggable={false}
          decoding="async"
          className="select-none object-contain"
          style={{
            maxHeight: 'min(42vh, 400px)',
            maxWidth: '62vw',
            width: 'auto',
            height: 'auto',
            opacity: revealed ? 0.96 : transitioning ? 0.25 : 0,
            transform: revealed ? 'scale(1)' : transitioning ? 'scale(0.78)' : 'scale(0.6)',
            filter: `drop-shadow(0 0 60px ${accent}aa) drop-shadow(0 12px 40px rgba(0,0,0,0.6))`,
            transition: 'opacity 320ms ease, transform 460ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>

      {/* Props latéraux desktop only. */}
      <img
        src={ART[game].prop}
        alt=""
        draggable={false}
        loading="lazy"
        decoding="async"
        className="absolute left-2 top-1/2 hidden h-[58vh] max-h-[640px] w-auto -translate-y-1/2 select-none mix-blend-screen 2xl:block"
        style={{
          opacity: revealed ? 0.22 : 0.1,
          filter: 'blur(1px) drop-shadow(0 0 28px rgba(255,201,74,0.18))',
          transition: 'opacity 300ms ease',
        }}
      />
      <img
        src={ART[game].prop}
        alt=""
        draggable={false}
        loading="lazy"
        decoding="async"
        className="absolute right-2 top-1/2 hidden h-[58vh] max-h-[640px] w-auto -translate-y-1/2 -scale-x-100 select-none mix-blend-screen 2xl:block"
        style={{
          opacity: revealed ? 0.22 : 0.1,
          filter: 'blur(1px) drop-shadow(0 0 28px rgba(255,201,74,0.18))',
          transition: 'opacity 300ms ease',
        }}
      />
    </div>
  );
}

export const GameBackdrop = memo(GameBackdropImpl);
