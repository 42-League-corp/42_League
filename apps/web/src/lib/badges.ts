import { Crown, ShieldCheck, FlaskConical, Trophy, Award, type LucideIcon } from 'lucide-react';

export interface BadgeDef {
  label: string;
  description: string;
  /** Couleur d'accent (hex) — pilote le rendu + l'animation. */
  color: string;
  icon: LucideIcon;
}

/**
 * Catalogue des badges, façon « badges intra 42 ».
 * Les codes sont émis par le backend (badgesFor) ; le front résout ici le
 * libellé, la couleur et l'icône.
 */
export const BADGE_CATALOG: Record<string, BadgeDef> = {
  founder: {
    label: 'Founder',
    description: "À l'origine de 42 League — du premier commit au déploiement.",
    color: '#ffc94a',
    icon: Crown,
  },
  admin: {
    label: 'Admin',
    description: 'Administrateur — modération et organisation.',
    color: '#5fb4ff',
    icon: ShieldCheck,
  },
  beta_tester: {
    label: 'Beta Tester',
    description: 'Présent·e dès la saison bêta de 42 League.',
    color: '#3fd6c0',
    icon: FlaskConical,
  },
  season_champion: {
    label: 'Champion',
    description: "Vainqueur du classement d'une saison.",
    color: '#ffc94a',
    icon: Trophy,
  },
};

/** Définition d'un badge inconnu (fallback) pour ne jamais planter le rendu. */
export function badgeDef(code: string): BadgeDef {
  return (
    BADGE_CATALOG[code] ?? {
      label: code,
      description: 'Badge.',
      color: '#a89880',
      icon: Award,
    }
  );
}
