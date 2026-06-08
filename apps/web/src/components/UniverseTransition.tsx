import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useGameMode } from '../hooks/useGameMode';
import { setTransitionPhase } from '../lib/universeTransition';

/**
 * Wrapper du contenu de page qui orchestre la cinématique de changement
 * d'univers en 4 phases (≈1.1s total) :
 *
 *   1. EXIT   (380ms) — chaque enfant direct part radialement vers son bord
 *                       d'écran le plus proche, avec stagger, GPU-only.
 *   2. REVEAL (280ms) — les blocs sont hors-champ, la backdrop est exposée
 *                       (le scrim s'éclaircit) ; les 2 photos se cross-fadent.
 *   3. ENTER  (420ms) — les blocs reviennent depuis l'opposé, en cascade.
 *   4. IDLE           — état stable.
 *
 * Stratégie « zero-refonte » : avant le démarrage de l'animation, on lit la
 * position de chaque enfant direct, on calcule son vecteur radial depuis le
 * centre écran, et on écrit ce vecteur sur l'élément en custom property
 * (`--g-tx`, `--g-ty`, `--g-delay`). Les règles CSS globales (index.css)
 * consomment ces variables → animations transform/opacity uniquement, donc
 * 60 fps garantis.
 *
 * Respecte `prefers-reduced-motion` : transition réduite à un simple fondu.
 */

const EXIT_MS = 380;
const REVEAL_MS = 280;
const ENTER_MS = 420;
const STAGGER_MS = 35;

interface UniverseTransitionProps {
  children: ReactNode;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Vecteur unitaire (cx, cy) → (x, y), avec bias selon la zone d'écran. */
function radialVector(rect: DOMRect, vw: number, vh: number): { tx: number; ty: number; rot: number } {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = cx - vw / 2;
  const dy = cy - vh / 2;
  const len = Math.hypot(dx, dy) || 1;
  // Normalisation puis ajout d'un terme constant pour que les blocs très
  // proches du centre partent quand même (sinon ils restent sur place).
  const tx = dx / len + Math.sign(dx) * 0.25;
  const ty = dy / len + Math.sign(dy) * 0.25;
  // Petite rotation aléatoire-déterministe pour donner du caractère (les
  // blocs au-dessus du centre tournent un peu, ceux en-dessous l'inverse).
  const rot = (dy / vh) * -8 + (dx / vw) * 4;
  return { tx, ty, rot };
}

export function UniverseTransition({ children }: UniverseTransitionProps) {
  const { game } = useGameMode();
  const prevGameRef = useRef(game);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);

  // useLayoutEffect : on doit calculer les vecteurs AVANT que les nouveaux
  // children soient peints (sinon flash).
  useLayoutEffect(() => {
    if (prevGameRef.current === game) return;
    prevGameRef.current = game;

    const wrap = wrapRef.current;
    if (!wrap) return;

    // Nettoyage des timers d'une transition précédente non terminée.
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];

    if (prefersReducedMotion()) {
      // Fondu simple — pas de dispersion.
      setTransitionPhase('reveal');
      timersRef.current.push(window.setTimeout(() => setTransitionPhase('idle'), 350));
      return;
    }

    // Détection intelligente du « vrai » niveau des blocs : on descend tant
    // qu'il n'y a qu'un seul enfant (PageTransition, wrappers de page, etc.)
    // pour atteindre la rangée d'items qui doivent se disperser.
    let blockParent: HTMLElement = wrap;
    while (blockParent.children.length === 1 && blockParent.firstElementChild instanceof HTMLElement) {
      blockParent = blockParent.firstElementChild;
    }

    // Calcul des vecteurs sur chaque enfant direct ----------------------------
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const children = Array.from(blockParent.children) as HTMLElement[];
    // Pour que les règles CSS ciblent le bon parent, on lui ajoute une marque.
    blockParent.dataset.universeBlocks = '';

    // Tri par distance au centre (les plus éloignés partent en premier → effet
    // d'aspiration vers les bords).
    const indexed = children.map((el, i) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.hypot(cx - vw / 2, cy - vh / 2);
      return { el, rect, dist, originalIndex: i };
    });
    indexed.sort((a, b) => b.dist - a.dist);

    indexed.forEach(({ el, rect }, sortedIndex) => {
      const { tx, ty, rot } = radialVector(rect, vw, vh);
      el.style.setProperty('--g-tx', tx.toFixed(3));
      el.style.setProperty('--g-ty', ty.toFixed(3));
      el.style.setProperty('--g-rot', rot.toFixed(2));
      el.style.setProperty('--g-delay', `${sortedIndex * STAGGER_MS}ms`);
    });

    // Orchestration des phases ------------------------------------------------
    setTransitionPhase('exit');

    const tReveal = window.setTimeout(() => setTransitionPhase('reveal'), EXIT_MS);
    const tEnter  = window.setTimeout(() => setTransitionPhase('enter'),  EXIT_MS + REVEAL_MS);
    const tIdle   = window.setTimeout(() => {
      setTransitionPhase('idle');
      // Cleanup des custom properties pour libérer la mémoire compositeur.
      indexed.forEach(({ el }) => {
        el.style.removeProperty('--g-tx');
        el.style.removeProperty('--g-ty');
        el.style.removeProperty('--g-rot');
        el.style.removeProperty('--g-delay');
      });
      delete blockParent.dataset.universeBlocks;
    }, EXIT_MS + REVEAL_MS + ENTER_MS);

    timersRef.current.push(tReveal, tEnter, tIdle);
  }, [game]);

  // Cleanup global au démontage.
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      setTransitionPhase('idle');
    };
  }, []);

  return (
    <div ref={wrapRef} className="universe-transition-root">
      {children}
    </div>
  );
}
