import { memo, useEffect, useState } from 'react';
import { useGameMode } from '../hooks/useGameMode';
import { useTransitionPhase } from '../hooks/useTransitionPhase';
import type { Game } from '../lib/gameMode';

/**
 * Décor d'univers — photo héro plein écran, visible (4K) mais maîtrisée pour la
 * lisibilité, orchestrée avec la cinématique de changement d'univers :
 *
 *  - idle  : flou léger (3px) + brightness 0.55 + scrim 0.42 → l'image est
 *            nettement reconnaissable, mais le texte reste lisible partout.
 *  - reveal: le scrim tombe (0.42→0.05) et l'image s'éclaircit (brightness
 *            0.9) → plein écran 4K pendant que les blocs du HUD sont hors-champ,
 *            avec un cross-fade vers le nouvel univers.
 *
 * Cross-fade = 2 slots <img> superposés dont on échange l'opacité, gaté sur la
 * phase `reveal`. Les 5 photos sont préchargées au montage (fondu instantané).
 */

interface UniverseArt {
  bg: string;
  prop: string;
  symbol: string;
}

const ART: Record<Game, UniverseArt> = {
  babyfoot:      { bg: '/universe/babyfoot.jpg',      prop: '/universe/babyfoot-prop.png',      symbol: '/universe/babyfoot-symbol.png' },
  smash:         { bg: '/universe/smash.jpg',         prop: '/universe/smash-prop.png',         symbol: '/universe/smash-symbol.png' },
  chess:         { bg: '/universe/chess.jpg',         prop: '/universe/chess-prop.png',         symbol: '/universe/chess-symbol.png' },
  streetfighter: { bg: '/universe/streetfighter.jpg', prop: '/universe/streetfighter-prop.png', symbol: '/universe/streetfighter-symbol.png' },
  flechettes:    { bg: '/universe/flechettes.jpg',    prop: '/universe/flechettes-prop.png',    symbol: '/universe/flechettes-symbol.png' },
};

const FILTER_IDLE   = 'blur(3px) saturate(1.03) brightness(0.55)';
const FILTER_REVEAL = 'blur(3px) saturate(1.12) brightness(0.9)';

function GameBackdropImpl() {
  const { game } = useGameMode();
  const phase = useTransitionPhase();
  const revealed = phase === 'reveal';

  // Précharge les 5 photos une fois → cross-fade instantané ensuite.
  useEffect(() => {
    Object.values(ART).forEach(({ bg }) => {
      const im = new Image();
      im.src = bg;
    });
  }, []);

  // 2 slots pour le cross-fade. On ne bascule QU'À la phase reveal (la photo ne
  // change pas pendant que les blocs partent).
  const [slotA, setSlotA] = useState<Game>(game);
  const [slotB, setSlotB] = useState<Game | null>(null);
  const [active, setActive] = useState<'A' | 'B'>('A');
  const activeGame = active === 'A' ? slotA : slotB;

  useEffect(() => {
    if (phase !== 'reveal') return;
    if (activeGame === game) return;
    if (active === 'A') {
      setSlotB(game);
      requestAnimationFrame(() => setActive('B'));
    } else {
      setSlotA(game);
      requestAnimationFrame(() => setActive('A'));
    }
  }, [phase, game, active, activeGame]);

  const imgStyle = (visible: boolean): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    filter: revealed ? FILTER_REVEAL : FILTER_IDLE,
    transform: revealed ? 'scale(1.01)' : 'scale(1.06)',
    transition: 'opacity 360ms ease, filter 340ms ease, transform 760ms cubic-bezier(0.16, 1, 0.3, 1)',
  });

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
        style={imgStyle(active === 'A')}
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
          style={imgStyle(active === 'B')}
        />
      )}

      {/* Voile plat — tombe pendant REVEAL pour exposer la photo 4K. */}
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(8,6,4,1)',
          opacity: revealed ? 0.05 : 0.42,
          transition: 'opacity 320ms ease',
        }}
      />

      {/* Vignette radiale — assombrit les bords. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 92% 82% at 50% 45%, transparent 0%, rgba(8,6,4,0.6) 100%)',
          opacity: revealed ? 0.3 : 1,
          transition: 'opacity 320ms ease',
        }}
      />
    </div>
  );
}

export const GameBackdrop = memo(GameBackdropImpl);
