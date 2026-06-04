/**
 * Titres cosmétiques forcés par login.
 *
 * Purement décoratif : n'accorde AUCUN droit ni privilège, c'est juste le texte
 * « … » affiché sous le pseudo sur le profil. Un titre réel défini en base
 * (via le panel GOD) reste utilisé pour les logins absents de cette table.
 */
const COSMETIC_TITLES: Record<string, string> = {
  nithomas: 'Godfather',
};

/**
 * Titre à afficher : override cosmétique prioritaire, sinon le titre réel, sinon
 * le `fallback` (ex. titre par défaut « sans éclat. » quand aucun n'est équipé).
 */
export function displayTitle(
  login: string,
  title?: string | null,
  fallback?: string | null,
): string | null {
  return COSMETIC_TITLES[login] ?? title ?? fallback ?? null;
}
