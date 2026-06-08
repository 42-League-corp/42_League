import { memo, useEffect, useRef, useState } from 'react';
import { useGameMode } from '../hooks/useGameMode';
import { useTransitionPhase } from '../hooks/useTransitionPhase';
import type { Game } from '../lib/gameMode';

/**
 * Décor d'univers — photographie héro plein écran avec scrim de lisibilité.
 *
 * Le composant écoute aussi la phase de la cinématique de changement
 * d'univers (cf. UniverseTransition) :
 *  - phases idle/exit/enter : photo très assombrie (ambiance), pas sujet
 *  - phase reveal           : scrim s'éclaircit (la photo est révélée 4K),
 *                             et un cross-fade démarre depuis l'ancienne
 *                             photo vers la nouvelle, avec léger zoom-in.
 *
 * On ne démonte JAMAIS l'ancienne photo : on garde 2 slots `<img>` superposés
 * qui s'échangent à chaque switch. Cross-fade purement opacity → GPU.
 */

interface UniverseArt {
  bg: string;
  prop: string;
}

const ART: Record<Game, UniverseArt> = {
  babyfoot:      { bg: '/universe/babyfoot.jpg',       prop: '/universe/babyfoot-prop.png' },
  smash:         { bg: '/universe/smash.jpg',          prop: '/universe/smash-prop.png' },
  chess:         { bg: '/universe/chess.jpg',          prop: '/universe/chess-prop.png' },
  streetfighter: { bg: '/universe/streetfighter.jpg',  prop: '/universe/streetfighter-prop.png' },
  flechettes:    { bg: '/universe/flechettes.jpg',     prop: '/universe/flechettes-prop.png' },
};

function GameBackdropImpl() {
  const { game } = useGameMode();
  const phase = useTransitionPhase();

  // 2 slots d'image : on alterne pour permettre un vrai cross-fade. À chaque
  // changement de game, le slot inactif charge la nouvelle photo, puis on
  // bascule l'opacité (le navigateur a déjà la JPG en cache après le 1er chargement).
  const [slotA, setSlotA] = useState(game);
  const [slotB, setSlotB] = useState<Game | null>(null);
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');
  const prevGameRef = useRef(game);

  useEffect(() => {
    if (prevGameRef.current === game) return;
    prevGameRef.current = game;
    // Charge la nouvelle photo dans le slot inactif puis bascule.
    if (activeSlot === 'A') {
      setSlotB(game);
      // Laisse le navigateur peindre l'image dans slot B avant de basculer
      // (sinon flash blanc si la photo n'est pas en cache).
      const t = window.setTimeout(() => setActiveSlot('B'), 30);
      return () => window.clearTimeout(t);
    } else {
      setSlotA(game);
      const t = window.setTimeout(() => setActiveSlot('A'), 30);
      return () => window.clearTimeout(t);
    }
  }, [game, activeSlot]);

  // Pendant REVEAL la photo est révélée : scrim global allégé + zoom-in subtil.
  const revealed = phase === 'reveal';

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Slot A */}
      <img
        src={ART[slotA].bg}
        alt=""
        className="absolute inset-0 h-full w-full select-none object-cover transition-opacity duration-300 ease-out"
        draggable={false}
        loading="eager"
        fetchPriority="low"
        decoding="async"
        style={{
          opacity: activeSlot === 'A' ? 1 : 0,
          filter: 'blur(14px) saturate(0.85) brightness(0.38)',
          transform: revealed ? 'scale(1.02)' : 'scale(1.08)',
          transition: 'opacity 320ms ease, transform 700ms cubic-bezier(0.16, 1, 0.3, 1)',
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
            opacity: activeSlot === 'B' ? 1 : 0,
            filter: 'blur(14px) saturate(0.85) brightness(0.38)',
            transform: revealed ? 'scale(1.02)' : 'scale(1.08)',
            transition: 'opacity 320ms ease, transform 700ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      )}

      {/* Voile plat global — opacité dynamique : se lève pendant REVEAL pour
          que la photo soit vraiment visible 4K, revient ensuite pour la
          lisibilité du HUD. */}
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(8,6,4,1)',
          opacity: revealed ? 0.18 : 0.55,
          transition: 'opacity 280ms ease',
        }}
      />

      {/* Vignette radiale */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 80% at 50% 45%, transparent 0%, rgba(8,6,4,0.6) 100%)',
          opacity: revealed ? 0.4 : 1,
          transition: 'opacity 280ms ease',
        }}
      />

      {/* Props latéraux desktop only — atténués en idle, légèrement plus
          visibles pendant le REVEAL. */}
      <img
        src={ART[game].prop}
        alt=""
        draggable={false}
        loading="lazy"
        decoding="async"
        className="absolute left-2 top-1/2 hidden h-[58vh] max-h-[640px] w-auto -translate-y-1/2 select-none mix-blend-screen 2xl:block"
        style={{
          opacity: revealed ? 0.22 : 0.10,
          filter: 'blur(1px) drop-shadow(0 0 28px rgba(255,201,74,0.18))',
          transition: 'opacity 280ms ease',
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
          opacity: revealed ? 0.22 : 0.10,
          filter: 'blur(1px) drop-shadow(0 0 28px rgba(255,201,74,0.18))',
          transition: 'opacity 280ms ease',
        }}
      />
    </div>
  );
}

export const GameBackdrop = memo(GameBackdropImpl);
