import { memo, useEffect, useState } from 'react';
import { useGameMode } from '../hooks/useGameMode';
import { useTransitionPhase } from '../hooks/useTransitionPhase';
import type { Game } from '../lib/gameMode';

/**
 * Décor d'univers — photo héro plein écran, visible (4K) mais maîtrisée pour la
 * lisibilité, orchestrée avec la cinématique de changement d'univers :
 *
 *  - idle   : blur(3px) + brightness 0.55 + scrim 0.42 → image reconnaissable,
 *             texte lisible.
 *  - exit   : le scrim commence à tomber (→ 0.18) et le flou se réduit (→ 1px)
 *             dès que les blocs partent : la photo devient visible AVANT reveal,
 *             sans allonger l'animation.
 *  - reveal : scrim 0.03 + blur nul + brightness 0.92 → plein écran 4K net,
 *             cross-fade vers le nouvel univers.
 *  - enter  : retour progressif vers idle pendant que les blocs reviennent.
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

// Paramètres visuels par phase de transition.
// En commençant la révélation dès la phase "exit", on tire parti des ~380 ms
// de dispersion des blocs pour montrer l'image — sans allonger l'animation.
const PHASE_STYLES = {
  idle:   { filter: 'blur(3px) saturate(1.03) brightness(0.55)', scrim: 0.42, vignette: 1.0, scale: 1.06, filterDur: 340, scrimDur: 320 },
  exit:   { filter: 'blur(1px) saturate(1.08) brightness(0.75)', scrim: 0.18, vignette: 0.6, scale: 1.03, filterDur: 460, scrimDur: 420 },
  reveal: { filter: 'blur(0px) saturate(1.15) brightness(0.92)', scrim: 0.03, vignette: 0.2, scale: 1.00, filterDur: 220, scrimDur: 200 },
  enter:  { filter: 'blur(2px) saturate(1.05) brightness(0.68)', scrim: 0.30, vignette: 0.8, scale: 1.04, filterDur: 340, scrimDur: 360 },
} as const satisfies Record<string, { filter: string; scrim: number; vignette: number; scale: number; filterDur: number; scrimDur: number }>;

function GameBackdropImpl() {
  const { game } = useGameMode();
  const phase = useTransitionPhase();

  // Fallback sur idle si phase inconnue.
  const ps = (PHASE_STYLES as Record<string, typeof PHASE_STYLES.idle>)[phase] ?? PHASE_STYLES.idle;

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
    filter: ps.filter,
    transform: `scale(${ps.scale})`,
    transition: `opacity 360ms ease, filter ${ps.filterDur}ms ease, transform 760ms cubic-bezier(0.16, 1, 0.3, 1)`,
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

      {/* Voile plat — commence à tomber dès la phase exit pour que l'image
          soit déjà visible quand les blocs sont hors-champ (reveal). */}
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(8,6,4,1)',
          opacity: ps.scrim,
          transition: `opacity ${ps.scrimDur}ms ease`,
        }}
      />

      {/* Vignette radiale — s'allège au fur et à mesure de la révélation. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 92% 82% at 50% 45%, transparent 0%, rgba(8,6,4,0.6) 100%)',
          opacity: ps.vignette,
          transition: `opacity ${ps.scrimDur}ms ease`,
        }}
      />
    </div>
  );
}

export const GameBackdrop = memo(GameBackdropImpl);
