export interface PriorMatch {
  playedAt: Date;
  countedForElo: boolean;
}

/**
 * Ranked illimité : tout match compte pour l'ELO, sans plafond par paire ni
 * par fenêtre. (L'ancien anti-farming limitait à N matchs comptés par paire
 * sur une fenêtre glissante — supprimé.)
 *
 * Signature conservée pour ne pas toucher aux appelants : les arguments sont
 * ignorés et la fonction renvoie toujours `true`.
 */
export function shouldCountForElo(
  _priorMatchesBetweenPair: PriorMatch[],
  _newMatchAt: Date,
): boolean {
  return true;
}

// ─── Dégressivité anti-farming (rematch du même jour) ─────────────────────────
//
// Rejouer le même adversaire le même jour rapporte de moins en moins : chaque
// rematch vaut 1/4 de moins que le précédent (décroissance géométrique ×0.75).
// Le 1er match du jour contre un adversaire donné vaut 100 %, le 2e 75 %, le 3e
// ~56 %, etc. Remise à zéro à minuit (fuseau de la league). Le facteur s'applique
// AU MATCH ENTIER (gain du gagnant ET perte du perdant), pas seulement au gain.

/** Chaque rematch du jour vaut ce coefficient de moins que le précédent. */
export const FARMING_DECAY_BASE = 0.75;

/** Fuseau horaire de référence pour délimiter « le même jour » (reset minuit). */
export const FARMING_TZ = 'Europe/Paris';

/** Clé de jour 'YYYY-MM-DD' dans le fuseau de la league (→ reset à minuit local). */
function dayKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: FARMING_TZ });
}

/**
 * Nombre de matchs ENTRE LA MÊME PAIRE déjà comptés pour l'ELO le MÊME jour
 * (fuseau league) que le nouveau match. Vaut 0 pour le premier match du jour
 * contre cet adversaire — seuls les matchs comptés et antérieurs sont pris.
 */
export function sameDayPriorCount(priors: PriorMatch[], newMatchAt: Date): number {
  const key = dayKey(newMatchAt);
  return priors.filter(
    (m) => m.countedForElo && m.playedAt < newMatchAt && dayKey(m.playedAt) === key,
  ).length;
}

/**
 * Multiplicateur d'ELO anti-farming en fonction du nombre de matchs déjà joués
 * le même jour contre le même adversaire.
 *   n=0 → 1.0000   n=1 → 0.7500   n=2 → 0.5625   n=3 → 0.4219   n=4 → 0.3164 …
 */
export function farmingDecayFactor(sameDayPriors: number): number {
  return Math.pow(FARMING_DECAY_BASE, Math.max(0, sameDayPriors));
}

/**
 * Applique le facteur de dégressivité à un delta d'ELO signé, en conservant au
 * moins 1 point de mouvement quand le delta initial est non nul (le match garde
 * toujours un micro-enjeu, il ne tombe jamais pile à 0 par dégressivité).
 */
export function applyFarmingDecay(delta: number, factor: number): number {
  if (delta === 0) return 0;
  const sign = delta < 0 ? -1 : 1;
  return sign * Math.max(1, Math.round(Math.abs(delta) * factor));
}
