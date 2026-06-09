import { useMemo } from 'react';
import { useLeagueData } from './useLeagueData';
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
}

/**
 * État OPS de l'utilisateur courant, dérivé de `opsMe`. Sert à teinter l'UI en
 * mode « warning » quand on est traqué, et à connaître le quota de matchs forcés
 * restants (la cible ne peut pas refuser tant qu'il en reste).
 */
export function useOpsStatus(): OpsStatus {
  const { opsMe } = useLeagueData();

  return useMemo(() => {
    const hunter = opsMe?.targetedBy ?? null;
    const prey = opsMe?.current ?? null;
    const left = (o: Ops | null) =>
      o ? Math.max(0, OPS_FORCED_MATCHES - (o.forcedUsed ?? 0)) : 0;
    // Logins avec lesquels je suis en ops actif : ma proie (je traque) et/ou mon
    // traqueur (je suis traqué). Un duel contre l'un d'eux est un duel d'ops.
    const opsLogins = new Set<string>();
    if (prey) opsLogins.add(prey.targetLogin);
    if (hunter) opsLogins.add(hunter.ownerLogin);
    return {
      amTarget: !!hunter,
      amHunter: !!prey,
      hunter,
      prey,
      forcedLeftAsTarget: left(hunter),
      forcedLeftAsHunter: left(prey),
      isOpsWith: (login) => !!login && opsLogins.has(login),
    };
  }, [opsMe]);
}
