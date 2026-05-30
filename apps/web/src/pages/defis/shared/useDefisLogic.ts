import { useCallback, useMemo } from 'react';
import { api, type Challenge, type LeaderboardEntry, type PendingMatch } from '../../../lib/api';
import { useLeagueData } from '../../../hooks/useLeagueData';
import { useFlash } from '../../../hooks/useFlash';
import { useConfirm } from '../../../hooks/useConfirm';
import { useOpsStatus } from '../../../hooks/useOpsStatus';

export interface DefisLogic {
  myLogin: string | undefined;
  incoming: Challenge[];
  outgoing: Challenge[];
  accepted: Challenge[];
  pendingToConfirm: PendingMatch[];
  pendingWaiting: PendingMatch[];
  others: LeaderboardEntry[];
  recentOpponents: LeaderboardEntry[];
  opponentCounts: Record<string, number>;
  refresh: () => Promise<void>;
  handleAction: (id: string, action: 'accept' | 'decline') => Promise<void>;
  cancelDeclaration: (match: PendingMatch) => Promise<void>;
}

/**
 * Logique métier de la page Défis — extraite pour partage Desktop/Mobile.
 * Ne contient aucune UI, juste de la donnée dérivée et des actions.
 */
export function useDefisLogic(): DefisLogic {
  const { challenges, leaderboard, me, pending, matches, refresh } = useLeagueData();
  const flash = useFlash();
  const confirm = useConfirm();
  const { hunter, forcedLeftAsTarget } = useOpsStatus();

  const myLogin = me?.login;

  const { incoming, outgoing, accepted } = useMemo(() => {
    const inc: Challenge[] = [];
    const out: Challenge[] = [];
    const acc: Challenge[] = [];
    for (const c of challenges) {
      if (c.status === 'accepted') acc.push(c);
      else if (c.status === 'pending' && c.opponentLogin === myLogin) inc.push(c);
      else if (c.status === 'pending' && c.challengerLogin === myLogin) out.push(c);
    }
    return { incoming: inc, outgoing: out, accepted: acc };
  }, [challenges, myLogin]);

  const { pendingToConfirm, pendingWaiting } = useMemo(() => {
    const toConfirm: PendingMatch[] = [];
    const waiting: PendingMatch[] = [];
    for (const p of pending) {
      if (p.opponentLogin === myLogin) toConfirm.push(p);
      else if (p.declarerLogin === myLogin) waiting.push(p);
    }
    return { pendingToConfirm: toConfirm, pendingWaiting: waiting };
  }, [pending, myLogin]);

  const others = useMemo(
    () => leaderboard.filter((u) => u.login !== myLogin),
    [leaderboard, myLogin],
  );

  // Map login → nb de games jouées (utilisé pour ordonner les récents).
  const { opponentCounts, recentOpponents } = useMemo(() => {
    const counts: Record<string, number> = {};
    if (myLogin) {
      for (const m of matches) {
        const opp =
          m.playerALogin === myLogin ? m.playerBLogin :
          m.playerBLogin === myLogin ? m.playerALogin :
          null;
        if (opp) counts[opp] = (counts[opp] ?? 0) + 1;
      }
    }
    const byLogin = new Map(leaderboard.map((u) => [u.login, u]));
    const recents = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([login]) => byLogin.get(login))
      .filter((u): u is LeaderboardEntry => u !== undefined);
    return { opponentCounts: counts, recentOpponents: recents };
  }, [matches, leaderboard, myLogin]);

  const declinePrompt = useCallback(
    (challenge: Challenge) => {
      const iAmChallenger = challenge.challengerLogin === myLogin;
      const opponent = iAmChallenger ? challenge.opponentLogin : challenge.challengerLogin;
      const wasAccepted = challenge.status === 'accepted';

      // OPS : refuser un défi de son traqueur pendant un match forcé = 3× l'ELO.
      const isForcedByHunter =
        !iAmChallenger &&
        !!hunter &&
        challenge.challengerLogin === hunter.ownerLogin &&
        forcedLeftAsTarget > 0;
      if (isForcedByHunter) {
        return {
          title: 'Refuser un match forcé ?',
          message: `${opponent} t'a déclaré comme son ops. Tu ne peux pas refuser ce défi sans sanction.`,
          warning: `⚠ Pénalité : 3× l'ELO d'une défaite. Il te reste ${forcedLeftAsTarget} match${forcedLeftAsTarget > 1 ? 's' : ''} forcé${forcedLeftAsTarget > 1 ? 's' : ''}.`,
          confirmLabel: 'Refuser quand même',
          cancelLabel: 'Garder',
          danger: true,
        } as const;
      }

      if (wasAccepted) {
        return {
          title: 'Fuir ce match ?',
          message: `Le match contre ${opponent} était accepté par les deux. Si tu annules maintenant, c'est considéré comme une fuite.`,
          warning: '⚠ Pénalité : -10 ELO + 1 fuite marquée sur ton profil.',
          confirmLabel: 'Confirmer la fuite',
          cancelLabel: 'Garder',
          danger: true,
        } as const;
      }
      return {
        title: iAmChallenger ? 'Annuler ce défi ?' : 'Refuser ce défi ?',
        message: iAmChallenger
          ? `Annuler ton défi envoyé à ${opponent} ?`
          : `Refuser le défi de ${opponent} ?`,
        confirmLabel: iAmChallenger ? 'Annuler' : 'Refuser',
        cancelLabel: 'Garder',
        danger: true,
      } as const;
    },
    [myLogin, hunter, forcedLeftAsTarget],
  );

  const handleAction = useCallback(
    async (id: string, action: 'accept' | 'decline') => {
      if (action === 'decline') {
        const challenge = challenges.find((c) => c.id === id);
        if (!challenge) return;
        const ok = await confirm(declinePrompt(challenge));
        if (!ok) return;
      }
      try {
        if (action === 'accept') {
          await api.acceptChallenge(id);
          flash.show('Défi accepté');
        } else {
          const res = await api.declineChallenge(id);
          if (res.isOps && res.eloPenalty > 0) {
            flash.show(`Match forcé refusé · −${res.eloPenalty} ELO ☠`, 'error');
          } else {
            flash.show('Défi clos');
          }
        }
        await refresh();
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      }
    },
    [challenges, confirm, declinePrompt, flash, refresh],
  );

  const cancelDeclaration = useCallback(
    async (match: PendingMatch) => {
      const ok = await confirm({
        title: 'Annuler ta déclaration ?',
        message: `Le match que tu as déclaré contre ${match.opponentLogin} (${match.scoreDeclarer}–${match.scoreOpponent}) sera retiré. Tu pourras le redéclarer plus tard.`,
        confirmLabel: 'Annuler la déclaration',
        cancelLabel: 'Garder',
        danger: true,
      });
      if (!ok) return;
      try {
        await api.cancelMatch(match.id);
        flash.show('Déclaration annulée');
        await refresh();
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      }
    },
    [confirm, flash, refresh],
  );

  return {
    myLogin,
    incoming,
    outgoing,
    accepted,
    pendingToConfirm,
    pendingWaiting,
    others,
    recentOpponents,
    opponentCounts,
    refresh,
    handleAction,
    cancelDeclaration,
  };
}
