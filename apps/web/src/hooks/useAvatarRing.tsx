import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { rankTierForRank } from '@42-league/shared';
import { useLeagueData } from './useLeagueData';

/**
 * Anneau de grade autour des photos de profil.
 *
 * Chaque avatar du site est cerclé de la couleur du grade de son joueur, calculé
 * pour le MODE DE JEU COURANT. La source est le `leaderboard` exposé par
 * {@link useLeagueData} (déjà filtré par mode) : on en dérive une table
 * `login → couleur` une seule fois, partagée par tous les `Avatar` via ce contexte.
 *
 * Hors provider (pages publiques : login, à-propos…), la table est vide et les
 * avatars s'affichent sans anneau — aucun couplage dur au contexte de données.
 */
type RingLookup = (login: string) => string | null;

const AvatarRingContext = createContext<RingLookup>(() => null);

export function AvatarRingProvider({ children }: { children: ReactNode }) {
  const { leaderboard } = useLeagueData();

  // login → couleur de grade (grandmaster inclus, selon rang + ELO du mode courant).
  const colorByLogin = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of leaderboard) {
      // On ne cercle que les joueurs ayant réellement disputé des matchs : sans
      // partie, pas de grade significatif à afficher.
      if (e.matchesPlayed > 0) m.set(e.login, rankTierForRank(e.elo, e.rank).color);
    }
    return m;
  }, [leaderboard]);

  const lookup = useMemo<RingLookup>(
    () => (login: string) => colorByLogin.get(login) ?? null,
    [colorByLogin],
  );

  return <AvatarRingContext.Provider value={lookup}>{children}</AvatarRingContext.Provider>;
}

/** Couleur de l'anneau de grade d'un login pour le mode courant, ou `null`. */
export function useAvatarRingColor(login: string): string | null {
  return useContext(AvatarRingContext)(login);
}
