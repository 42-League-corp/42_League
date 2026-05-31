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
