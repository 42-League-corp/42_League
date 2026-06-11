/**
 * Déclencheur global de la cinématique « PASSAGE DE RANG ».
 *
 * Quand l'ELO d'un joueur franchit le seuil d'un palier supérieur (Étain →
 * Bronze → … → Diamant), on célèbre : l'emblème du nouveau grade CLAQUE au
 * centre de l'écran (impact + secousse), déclenche une onde de choc et des
 * éclairs (cf. RankUpOverlay).
 *
 * Même pattern hors-React que `duelStrike` : la détection vit dans
 * LeagueDataProvider (comparaison des ELO avant/après refresh de `me`),
 * l'overlay est monté en permanence dans l'AppShell et s'abonne ici.
 */
import type { RankTier } from '@42-league/shared';
import type { Game } from './gameMode';

export interface RankUp {
  /** Nouveau palier atteint (clé + libellé + couleur — pilote l'emblème). */
  tier: Pick<RankTier, 'key' | 'label' | 'color'>;
  /** Palier quitté (affiché en petit « Or → Diamant ») — optionnel. */
  fromTier?: Pick<RankTier, 'key' | 'label' | 'color'>;
  /** Discipline concernée (affichage du contexte). */
  game?: Game;
  /** Identifiant unique pour re-déclencher même avec des données identiques. */
  nonce: number;
}

let current: RankUp | null = null;
const listeners = new Set<() => void>();

export function getRankUp(): RankUp | null {
  return current;
}

export function triggerRankUp(payload: Omit<RankUp, 'nonce'>): void {
  current = { ...payload, nonce: Date.now() + Math.random() };
  for (const l of listeners) l();
}

export function clearRankUp(): void {
  if (current === null) return;
  current = null;
  for (const l of listeners) l();
}

export function subscribeRankUp(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
