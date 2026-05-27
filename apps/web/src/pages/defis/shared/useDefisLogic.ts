import { useCallback, useMemo } from 'react';
import { api, type Challenge, type LeaderboardEntry, type PendingMatch } from '../../../lib/api';
import { useLeagueData } from '../../../hooks/useLeagueData';
import { useFlash } from '../../../hooks/useFlash';
import { useConfirm } from '../../../hooks/useConfirm';

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
}

/**
 * Logique métier de la page Défis — extraite pour partage Desktop/Mobile.
 * Ne contient aucune UI, juste de la donnée dérivée et des actions.
 */
export function useDefisLogic(): DefisLogic {
  const { challenges, leaderboard, me, pending, matches, refresh } = useLeagueData();
  const flash = useFlash();
  const confirm = useConfirm();

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
    [myLogin],
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
          await api.declineChallenge(id);
          flash.show('Défi clos');
        }
        await refresh();
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      }
    },
    [challenges, confirm, declinePrompt, flash, refresh],
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
  };
}
