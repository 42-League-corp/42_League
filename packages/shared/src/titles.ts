// ─── Titres cosmétiques — possession dérivée des accomplissements ─────────────
//
// Un « titre » est un libellé cosmétique affiché sous le nom d'un joueur. Ce
// module est PUR (aucune dépendance, aucun accès base) afin d'être importable
// côté backend (validation server-side) ET côté web (affichage du sélecteur).
//
// Pour l'instant, la POSSESSION d'un titre est entièrement DÉRIVÉE des
// accomplissements du joueur (badges, tournois gagnés, rang). Une future
// « boutique » étendra `ownedTitles` pour y ajouter les titres ACHETÉS
// (cf. ShopItem catégorie 'title') : il suffira d'injecter les slugs possédés
// dans `TitleContext` et de les concaténer ici.

export interface OwnedTitle {
  key: string;
  label: string;
}

export interface TitleContext {
  login: string;
  /** Codes de badges détenus (cf. catalogue front lib/badges.ts). */
  badges?: string[];
  /** Total des tournois gagnés, toutes disciplines confondues. */
  tournamentsWon?: number;
  /** Rang du joueur dans sa discipline principale (1 = premier). */
  rank?: number | null;
}

/**
 * Titres qu'un joueur POSSÈDE actuellement, dérivés de ses accomplissements.
 * Liste vide tant qu'aucun accomplissement n'est atteint. Dédupliqué par `key`.
 *
 * Règles (simples et extensibles — la future boutique enrichira cette liste) :
 *  - login 'throbert'         → First Committer  (titre nominatif fondateur)
 *  - login 'abidaux'          → Visionnaire      (titre nominatif fondateur)
 *  - badge 'season_champion'  → Champion
 *  - tournamentsWon > 0       → Vainqueur de tournoi
 *  - rank === 1               → G.O.A.T
 *
 * NB : le badge 'founder' reste attribué aux fondateurs (cf. backend), mais ne
 * donne plus de titre générique « Fondateur » — chaque fondateur a son titre propre.
 */
export function ownedTitles(ctx: TitleContext): OwnedTitle[] {
  const badges = ctx.badges ?? [];
  const out: OwnedTitle[] = [];
  const login = ctx.login.toLowerCase();

  // Titres nominatifs des fondateurs.
  if (login === 'throbert') out.push({ key: 'first_committer', label: 'First Committer' });
  if (login === 'abidaux') out.push({ key: 'visionary', label: 'Visionnaire' });

  if (badges.includes('season_champion')) out.push({ key: 'champion', label: 'Champion' });
  if ((ctx.tournamentsWon ?? 0) > 0) out.push({ key: 'tournament_winner', label: 'Vainqueur de tournoi' });
  if (ctx.rank === 1) out.push({ key: 'goat', label: 'G.O.A.T' });

  // Dédup par key (au cas où une future règle produirait des doublons).
  const seen = new Set<string>();
  return out.filter((t) => (seen.has(t.key) ? false : (seen.add(t.key), true)));
}
