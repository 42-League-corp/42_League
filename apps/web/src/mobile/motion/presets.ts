import type { Transition, Variants } from 'framer-motion';

/**
 * Easings standardisés — alignés avec iOS / Apple HIG.
 * Référence : https://developer.apple.com/design/human-interface-guidelines/motion
 */
export const EASE = {
  /** Mouvement standard, sortie douce. */
  standard: [0.32, 0.72, 0, 1] as const,
  /** Entrée énergique (slide-up, sheet). */
  emphasized: [0.16, 1, 0.3, 1] as const,
  /** Bounce léger pour les feedbacks (boutons, badges). */
  spring: [0.34, 1.56, 0.64, 1] as const,
  /** Sortie rapide. */
  exit: [0.4, 0, 0.8, 0.6] as const,
} as const;

/** Durées en secondes (framer-motion). */
export const DURATION = {
  instant: 0.08,
  fast: 0.14,
  base: 0.22,
  slow: 0.32,
  page: 0.28,
} as const;

/** Transition spring physique — pour les sheets et drags. */
export const SPRING_STIFF: Transition = {
  type: 'spring',
  stiffness: 520,
  damping: 40,
  mass: 0.8,
};

export const SPRING_SOFT: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 32,
  mass: 1,
};

// ─── Variants prêts à l'emploi ───────────────────────────────────────────────

/** Fade simple. */
export const FADE: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURATION.base, ease: EASE.standard } },
  exit: { opacity: 0, transition: { duration: DURATION.fast, ease: EASE.exit } },
};

/** Slide depuis le bas (sheets, FAB). */
export const SLIDE_UP: Variants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.emphasized } },
  exit: { opacity: 0, y: 24, transition: { duration: DURATION.fast, ease: EASE.exit } },
};

/** Page push horizontal (navigation profonde iOS). */
export const PAGE_PUSH: Variants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: DURATION.page, ease: EASE.emphasized } },
  exit: { opacity: 0, x: -16, transition: { duration: DURATION.fast, ease: EASE.exit } },
};

/** Page fade (changement d'onglet TabBar). */
export const PAGE_FADE: Variants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.fast, ease: EASE.standard } },
  exit: { opacity: 0, transition: { duration: DURATION.instant, ease: EASE.exit } },
};

/** Scale-in pour modales, popovers. */
export const SCALE_IN: Variants = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1, transition: { duration: DURATION.base, ease: EASE.spring } },
  exit: { opacity: 0, scale: 0.92, transition: { duration: DURATION.fast, ease: EASE.exit } },
};

/** Stagger pour révéler une liste d'items un par un. */
export const STAGGER_PARENT: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const STAGGER_CHILD: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE.emphasized } },
};

/** Sheet montant depuis le bas avec spring physique. */
export const SHEET_TRANSITION: Transition = SPRING_STIFF;
