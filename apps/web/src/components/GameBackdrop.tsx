import { memo } from 'react';
import { useGameMode } from '../hooks/useGameMode';
import type { Game } from '../lib/gameMode';

/**
 * Décor d'ambiance par univers — une scène SVG iconique et minimaliste rendue
 * très en retrait derrière TOUT le contenu (fixed, pointer-events-none). Elle
 * complète le fond CSS (gradients + grille de `index.css`) en donnant à chaque
 * mode de jeu une identité visuelle immédiatement reconnaissable :
 *
 *   • babyfoot      → terrain vu de dessus + barre de joueurs sur tige
 *   • smash         → emblème Smash (cercle + croix) + lignes d'impact + étoiles
 *   • chess         → échiquier en perspective + roi & cavalier
 *   • streetfighter → sphère d'énergie (hadouken) + torii + lignes de vitesse
 *
 * Les traits consomment la couleur d'accent du mode courant via la variable CSS
 * `--accent-gold` (déjà repointée par `[data-game=…]`), donc la scène se teinte
 * automatiquement quand on change d'univers. L'ensemble est masqué en radial
 * pour fondre les bords et ne jamais gêner la lecture.
 */

const STROKE = 'rgb(var(--accent-gold))';

function BabyfootScene() {
  return (
    <svg viewBox="0 0 800 600" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g fill="none" stroke={STROKE} strokeWidth={2} opacity={0.5}>
        {/* Terrain vu de dessus */}
        <rect x={120} y={80} width={560} height={440} rx={10} />
        <line x1={400} y1={80} x2={400} y2={520} />
        <circle cx={400} cy={300} r={70} />
        <circle cx={400} cy={300} r={4} fill={STROKE} />
        {/* Surfaces de réparation */}
        <rect x={120} y={210} width={70} height={180} />
        <rect x={610} y={210} width={70} height={180} />
        {/* Buts */}
        <rect x={104} y={250} width={16} height={100} />
        <rect x={680} y={250} width={16} height={100} />
      </g>
      {/* Barre de joueurs sur tige (silhouettes de babyfoot) */}
      <g opacity={0.55}>
        <line x1={60} y1={300} x2={740} y2={300} stroke={STROKE} strokeWidth={5} opacity={0.4} />
        {[210, 400, 590].map((cx) => (
          <g key={cx} fill={STROKE} stroke="none">
            {/* tête */}
            <circle cx={cx} cy={272} r={11} />
            {/* corps */}
            <path d={`M${cx - 13} 286 h26 v34 h-26 z`} />
            {/* jambes écartées (forme babyfoot) */}
            <path d={`M${cx - 13} 320 l-12 24 h9 l10 -18 z`} />
            <path d={`M${cx + 13} 320 l12 24 h-9 l-10 -18 z`} />
          </g>
        ))}
      </g>
    </svg>
  );
}

function SmashScene() {
  return (
    <svg viewBox="0 0 800 600" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {/* Lignes d'impact rayonnantes */}
      <g stroke={STROKE} strokeWidth={2} opacity={0.28}>
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={400 + Math.cos(a) * 150}
              y1={300 + Math.sin(a) * 150}
              x2={400 + Math.cos(a) * 320}
              y2={300 + Math.sin(a) * 320}
            />
          );
        })}
      </g>
      {/* Emblème Smash : cercle + croix interne */}
      <g fill="none" stroke={STROKE} strokeWidth={6} opacity={0.6}>
        <circle cx={400} cy={300} r={135} />
        <path d="M400 188 L470 300 L400 412 L330 300 Z" />
        <line x1={400} y1={188} x2={400} y2={412} />
        <line x1={330} y1={300} x2={470} y2={300} />
      </g>
      {/* Étoiles à 4 branches */}
      <g fill={STROKE} opacity={0.5}>
        {([
          [150, 130, 16],
          [660, 170, 12],
          [120, 470, 12],
          [690, 460, 18],
          [560, 90, 9],
        ] as const).map(([cx, cy, r], i) => (
          <path
            key={i}
            d={`M${cx} ${cy - r} Q${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy} Q${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r} Q${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy} Q${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r} Z`}
          />
        ))}
      </g>
    </svg>
  );
}

function ChessScene() {
  // Échiquier 8×8 en perspective au sol (trapèze), façon plateau qui s'éloigne.
  const rows = 8;
  const cols = 8;
  const topW = 240;
  const botW = 620;
  const topY = 250;
  const botY = 560;
  const cx = 400;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const t0 = r / rows;
    const t1 = (r + 1) / rows;
    const y0 = topY + (botY - topY) * t0;
    const y1 = topY + (botY - topY) * t1;
    const w0 = topW + (botW - topW) * t0;
    const w1 = topW + (botW - topW) * t1;
    for (let c = 0; c < cols; c++) {
      if ((r + c) % 2 === 0) continue;
      const x0a = cx - w0 / 2 + (w0 * c) / cols;
      const x0b = cx - w0 / 2 + (w0 * (c + 1)) / cols;
      const x1a = cx - w1 / 2 + (w1 * c) / cols;
      const x1b = cx - w1 / 2 + (w1 * (c + 1)) / cols;
      cells.push(`M${x0a} ${y0} L${x0b} ${y0} L${x1b} ${y1} L${x1a} ${y1} Z`);
    }
  }
  return (
    <svg viewBox="0 0 800 600" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g fill={STROKE} opacity={0.16}>
        {cells.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g fill="none" stroke={STROKE} strokeWidth={1.5} opacity={0.3}>
        <path d={`M${cx - topW / 2} ${topY} L${cx + topW / 2} ${topY} L${cx + botW / 2} ${botY} L${cx - botW / 2} ${botY} Z`} />
      </g>
      {/* Roi (couronne + corps) */}
      <g fill={STROKE} stroke="none" opacity={0.55} transform="translate(300 90)">
        <path d="M0 6 v10 M-9 12 h18" stroke={STROKE} strokeWidth={4} fill="none" strokeLinecap="round" />
        <path d="M0 18 C-22 18 -16 50 4 64 L-8 130 h24 L4 64 C24 50 22 18 0 18 Z" />
        <rect x={-26} y={130} width={52} height={14} rx={5} />
      </g>
      {/* Cavalier */}
      <g fill={STROKE} stroke="none" opacity={0.5} transform="translate(470 130)">
        <path d="M2 0 C-26 6 -40 40 -40 78 h16 c0 -22 8 -34 22 -40 c-4 12 -2 18 6 22 c14 6 30 -4 30 -28 C36 14 22 -2 2 0 Z" />
        <rect x={-44} y={86} width={86} height={12} rx={4} />
      </g>
    </svg>
  );
}

function StreetFighterScene() {
  return (
    <svg viewBox="0 0 800 600" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {/* Lignes de vitesse horizontales */}
      <g stroke={STROKE} strokeWidth={3} opacity={0.18}>
        {[120, 180, 360, 430, 500].map((y, i) => (
          <line key={i} x1={i % 2 ? 460 : 40} y1={y} x2={i % 2 ? 780 : 320} y2={y} />
        ))}
      </g>
      {/* Torii (portail japonais) en silhouette */}
      <g fill={STROKE} opacity={0.4} transform="translate(0 -10)">
        <path d="M150 130 q250 -34 500 0 v18 q-250 -30 -500 0 z" />
        <rect x={150} y={172} width={500} height={16} rx={3} />
        <rect x={206} y={148} width={20} height={300} />
        <rect x={574} y={148} width={20} height={300} />
      </g>
      {/* Sphère d'énergie (hadouken) */}
      <g transform="translate(400 330)">
        <g fill="none" stroke={STROKE} strokeWidth={5} opacity={0.6}>
          <circle r={92} />
          <circle r={58} opacity={0.8} />
          <circle r={26} />
        </g>
        {/* Spirale d'énergie autour */}
        <g stroke={STROKE} strokeWidth={3} fill="none" opacity={0.4}>
          {Array.from({ length: 10 }).map((_, i) => {
            const a = (i / 10) * Math.PI * 2;
            const r1 = 100;
            const r2 = 138;
            return (
              <line
                key={i}
                x1={Math.cos(a) * r1}
                y1={Math.sin(a) * r1}
                x2={Math.cos(a) * r2}
                y2={Math.sin(a) * r2}
              />
            );
          })}
        </g>
      </g>
    </svg>
  );
}

function FlechettesScene() {
  // Cible de fléchettes vue de face : couronnes concentriques + 20 secteurs
  // rayonnants + une fléchette plantée en oblique.
  const cx = 400;
  const cy = 300;
  const spokes = Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(a) * 70, cy + Math.sin(a) * 70, cx + Math.cos(a) * 200, cy + Math.sin(a) * 200];
  });
  return (
    <svg viewBox="0 0 800 600" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g fill="none" stroke={STROKE} strokeWidth={2} opacity={0.5}>
        <circle cx={cx} cy={cy} r={200} />
        <circle cx={cx} cy={cy} r={180} />
        <circle cx={cx} cy={cy} r={130} strokeWidth={10} opacity={0.3} />
        <circle cx={cx} cy={cy} r={70} />
        <circle cx={cx} cy={cy} r={55} strokeWidth={8} opacity={0.3} />
        <circle cx={cx} cy={cy} r={22} />
        <circle cx={cx} cy={cy} r={9} fill={STROKE} />
        {spokes.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      {/* Fléchette plantée près du centre, en oblique */}
      <g opacity={0.6} transform={`translate(${cx + 18} ${cy - 24}) rotate(38)`}>
        <line x1={0} y1={0} x2={150} y2={0} stroke={STROKE} strokeWidth={5} strokeLinecap="round" />
        <path d="M0 0 l-14 -7 l4 7 l-4 7 z" fill={STROKE} />
        <path d="M150 0 l26 -12 l-6 12 l6 12 z" fill={STROKE} />
        <path d="M158 0 l22 -10 l-5 10 l5 10 z" fill={STROKE} opacity={0.7} />
      </g>
    </svg>
  );
}

const SCENES: Record<Game, () => React.ReactElement> = {
  babyfoot: BabyfootScene,
  smash: SmashScene,
  chess: ChessScene,
  streetfighter: StreetFighterScene,
  flechettes: FlechettesScene,
};

function GameBackdropImpl() {
  const { game } = useGameMode();
  const Scene = SCENES[game];
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{
        // Fondu radial : net au centre, transparent sur les bords → ne gêne
        // jamais la lecture du HUD posé par-dessus.
        maskImage: 'radial-gradient(ellipse 75% 75% at 50% 45%, black 0%, transparent 78%)',
        WebkitMaskImage: 'radial-gradient(ellipse 75% 75% at 50% 45%, black 0%, transparent 78%)',
        opacity: 0.5,
      }}
    >
      {/* clé = game → React remonte la scène (transition douce gérée par CSS). */}
      <div key={game} className="h-full w-full animate-backdrop-in">
        <Scene />
      </div>
    </div>
  );
}

export const GameBackdrop = memo(GameBackdropImpl);
