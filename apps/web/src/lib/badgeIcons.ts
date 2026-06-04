import {
  Award,
  Crown,
  Shield,
  Star,
  Flame,
  Trophy,
  Zap,
  Heart,
  Gem,
  Swords,
  Sparkles,
  Skull,
  Medal,
  Rocket,
  type LucideIcon,
} from 'lucide-react';

/**
 * Jeu d'icônes proposées pour les badges ACHETÉS (boutique). Choisies par nom
 * (string) dans le créateur Shop GOD et stockées dans `payload.icon`. Partagé
 * entre l'éditeur (aperçu) et le rendu profil (BadgeChip inline).
 */
export const BADGE_ICONS: Record<string, LucideIcon> = {
  Award,
  Crown,
  Shield,
  Star,
  Flame,
  Trophy,
  Zap,
  Heart,
  Gem,
  Swords,
  Sparkles,
  Skull,
  Medal,
  Rocket,
};

/** Noms d'icônes disponibles (pour les sélecteurs). */
export const BADGE_ICON_NAMES = Object.keys(BADGE_ICONS);

/** Résout un nom d'icône en composant Lucide (fallback `Award`). */
export function badgeIcon(name?: string | null): LucideIcon {
  return (name && BADGE_ICONS[name]) || Award;
}
