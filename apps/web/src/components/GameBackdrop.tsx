import { memo } from 'react';
import { useGameMode } from '../hooks/useGameMode';
import type { Game } from '../lib/gameMode';

/**
 * Décor d'univers — photographie héro plein écran (un objet emblématique du
 * sport, éclairé à la couleur de l'univers, le reste fondu dans le noir).
 *
 * Composition à 3 couches superposées (sous tout le contenu, fixed,
 * pointer-events-none) :
 *   1. <img>          — la photo (cover, centrée)
 *   2. scrim radial   — assombrit massivement les bords (lecture HUD garantie)
 *   3. scrim vertical — voile dégradé bas, pour la zone de texte de la page
 *
 * Côté desktop seulement, deux « props » (totem en laiton) sont posés dans les
 * gouttières gauche / droite à très faible opacité — c'est l'élément
 * secondaire « petites images à droite à gauche ».
 *
 * À chaque switch d'univers la photo entre par un fondu + léger zoom-in (cf.
 * keyframes `backdrop-in` dans index.css) ; React remonte la scène via la
 * `key={game}`.
 */

interface UniverseArt {
  /** Photo plein écran (JPG, ~250 KB). Centrée en cover. */
  bg: string;
  /** Totem latéral (PNG transparent). */
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
  const { bg, prop } = ART[game];

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* React remonte la scène à chaque changement → fondu via `animate-backdrop-in`. */}
      <div key={game} className="absolute inset-0 animate-backdrop-in">
        {/* 1. Photo héro plein écran */}
        <img
          src={bg}
          alt=""
          className="h-full w-full select-none object-cover"
          draggable={false}
          loading="eager"
          fetchPriority="low"
          decoding="async"
        />

        {/* 2. Scrim radial : assombrit les bords pour garantir la lecture du HUD.
               Bords ≈ noir opaque, centre ≈ photo à fond. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 85% 78% at 50% 45%, rgba(8,6,4,0) 0%, rgba(8,6,4,0.35) 55%, rgba(8,6,4,0.92) 100%)',
          }}
        />

        {/* 3. Scrim vertical : voile sombre en bas — c'est là que les pages
               affichent la majorité de leur contenu (cartes, listes). */}
        <div
          className="absolute inset-x-0 bottom-0 h-2/3"
          style={{
            background:
              'linear-gradient(180deg, rgba(8,6,4,0) 0%, rgba(8,6,4,0.55) 55%, rgba(8,6,4,0.88) 100%)',
          }}
        />

        {/* 4. Props latéraux (desktop only) — totems gauche & droite, très
               discrets, dans les gouttières au-delà du contenu (max-w 1600 px). */}
        <img
          src={prop}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          className="absolute left-2 top-1/2 hidden h-[58vh] max-h-[640px] w-auto -translate-y-1/2 select-none opacity-[0.18] mix-blend-screen 2xl:block"
          style={{ filter: 'drop-shadow(0 0 28px rgba(255,201,74,0.18))' }}
        />
        <img
          src={prop}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          className="absolute right-2 top-1/2 hidden h-[58vh] max-h-[640px] w-auto -translate-y-1/2 -scale-x-100 select-none opacity-[0.18] mix-blend-screen 2xl:block"
          style={{ filter: 'drop-shadow(0 0 28px rgba(255,201,74,0.18))' }}
        />
      </div>
    </div>
  );
}

export const GameBackdrop = memo(GameBackdropImpl);
