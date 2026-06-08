import { Megaphone, AlertTriangle, PartyPopper, type LucideIcon } from 'lucide-react';
import type { AnnouncementKind } from './api';

// Métadonnées visuelles par type d'annonce — partagées entre le popup (style
// GOAT), l'onglet admin /GOD et la liste « Dernières annonces » (À propos).
export interface AnnouncementKindMeta {
  label: string; // libellé FR pour le sélecteur admin
  Icon: LucideIcon;
  accent: string; // couleur d'accent (hex) pour styles inline
  ring: string; // bordure (rgba)
  glow: string; // halo (rgba)
}

export const ANNOUNCEMENT_KIND_META: Record<AnnouncementKind, AnnouncementKindMeta> = {
  info: { label: 'Info', Icon: Megaphone, accent: '#ffc94a', ring: 'rgba(255,201,74,0.45)', glow: 'rgba(255,201,74,0.18)' },
  important: { label: 'Important', Icon: AlertTriangle, accent: '#ff5366', ring: 'rgba(255,83,102,0.45)', glow: 'rgba(255,83,102,0.18)' },
  event: { label: 'Événement', Icon: PartyPopper, accent: '#34d399', ring: 'rgba(52,211,153,0.45)', glow: 'rgba(52,211,153,0.18)' },
};

export const ANNOUNCEMENT_KINDS: AnnouncementKind[] = ['info', 'important', 'event'];

export function announcementKindMeta(kind: string): AnnouncementKindMeta {
  return ANNOUNCEMENT_KIND_META[(kind as AnnouncementKind)] ?? ANNOUNCEMENT_KIND_META.info;
}
