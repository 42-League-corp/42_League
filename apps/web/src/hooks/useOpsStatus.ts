import { useMemo } from 'react';
import { useLeagueData } from './useLeagueData';
import { useAuth } from './useAuth';
import { OPS_FORCED_MATCHES, type Ops } from '../lib/api';

export interface OpsStatus {
  /** Je suis traqué : quelqu'un m'a déclaré comme son ops (OPS actif). */
  amTarget: boolean;
  /** Je traque quelqu'un : j'ai un ops actif sur une cible. */
  amHunter: boolean;
  /** L'ops dont je suis la cible (mon traqueur). */
  hunter: Ops | null;
  /** L'ops que je mène (ma cible). */
  prey: Ops | null;
  /** Matchs forcés que je dois encore subir sans pouvoir refuser (en tant que cible). */
  forcedLeftAsTarget: number;
  /** Matchs forcés que je peux encore imposer à ma cible (en tant que traqueur). */
  forcedLeftAsHunter: number;
  /**
   * `true` si un défi/match qui m'oppose à `login` fait partie d'un OPS actif —
   * que je sois le traqueur (ma proie) ou la cible (mon traqueur). Sert à teinter
   * en rouge fluo clignotant les cartes de duel d'ops, des deux côtés.
   */
  isOpsWith: (login: string | null | undefined) => boolean;
  /**
   * `true` UNIQUEMENT pour un vrai MATCH FORCÉ d'ops — l'un des (max 3) duels que le
   * traqueur impose à sa cible. Trois conditions, toutes requises :
   *   1. le couple {a, b} est exactement {traqueur, cible} de mon ops actif ;
   *   2. le quota de 3 matchs forcés n'est pas épuisé (`forcedUsed < 3`) ;
   *   3. le duel est NÉ pendant l'ops (`createdAt >= ops.declaredAt`) — un ancien
   *      défi qui existait déjà avec cette personne AVANT la déclaration ne compte pas.
   * Sans `createdAt`, la condition de date est ignorée (ne pas l'omettre sur les
   * cartes de défi/match : c'est ce qui empêche les anciens défis de clignoter).
   */
  isOpsDuel: (
    a: string | null | undefined,
    b: string | null | undefined,
    createdAt?: string | null,
  ) => boolean;
}

/**
 * État OPS de l'utilisateur courant, dérivé de `opsMe`. Sert à teinter l'UI en
 * mode « warning » quand on est traqué, et à connaître le quota de matchs forcés
 * restants (la cible ne peut pas refuser tant qu'il en reste).
 */
export function useOpsStatus(): OpsStatus {
  const { opsMe } = useLeagueData();
  const { login: myLogin } = useAuth();

  return useMemo(() => {
    // Un ops expiré ne doit plus rien faire clignoter.
    const now = Date.now();
    const active = (o: Ops | null | undefined): Ops | null =>
      o && new Date(o.expiresAt).getTime() > now ? o : null;
    const hunter = active(opsMe?.targetedBy);
    const prey = active(opsMe?.current);
    const left = (o: Ops | null) =>
      o ? Math.max(0, OPS_FORCED_MATCHES - (o.forcedUsed ?? 0)) : 0;
    // Logins avec lesquels je suis en ops actif : ma proie (je traque) et/ou mon
    // traqueur (je suis traqué). Un duel contre l'un d'eux est un duel d'ops.
    const opsLogins = new Set<string>();
    if (prey) opsLogins.add(prey.targetLogin);
    if (hunter) opsLogins.add(hunter.ownerLogin);
    const isOpsWith = (login: string | null | undefined) => !!login && opsLogins.has(login);
    return {
      amTarget: !!hunter,
      amHunter: !!prey,
      hunter,
      prey,
      forcedLeftAsTarget: left(hunter),
      forcedLeftAsHunter: left(prey),
      isOpsWith,
      // Match forcé d'ops = un des (max 3) duels que le traqueur impose à sa cible.
      // On exige le couple exact {traqueur, cible}, un quota non épuisé, et — si
      // l'appelant fournit la date — un duel né PENDANT l'ops. Sinon les anciens
      // défis déjà existants avec cette personne clignoteraient à tort.
      isOpsDuel: (a, b, createdAt) => {
        if (!myLogin) return false;
        // L'ops actif (ma proie ou mon traqueur) dont {a, b} = {owner, target}.
        const link = (o: Ops | null): Ops | null =>
          o &&
          ((a === o.ownerLogin && b === o.targetLogin) ||
            (a === o.targetLogin && b === o.ownerLogin))
            ? o
            : null;
        const o = link(prey) ?? link(hunter);
        if (!o) return false;
        // Quota épuisé : les 3 matchs forcés sont passés → plus rien ne clignote.
        if ((o.forcedUsed ?? 0) >= OPS_FORCED_MATCHES) return false;
        // Duel antérieur à la déclaration d'ops → simple ancien défi, pas un forcé.
        if (
          createdAt != null &&
          new Date(createdAt).getTime() < new Date(o.declaredAt).getTime()
        ) {
          return false;
        }
        return true;
      },
    };
  }, [opsMe, myLogin]);
}
