import { useCallback, useMemo } from 'react';
import { api, type Challenge, type LeaderboardEntry, type PendingMatch } from '../../../lib/api';
import { useLeagueData } from '../../../hooks/useLeagueData';
import { useFlash } from '../../../hooks/useFlash';
import { useConfirm } from '../../../hooks/useConfirm';
import { useOpsStatus } from '../../../hooks/useOpsStatus';
import { useT } from '../../../lib/i18n';

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
  const t = useT();
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
          title: t('defis.confirm.refuseForced.title'),
          message: `${opponent} ${t('defis.confirm.refuseForced.declaredYou')}`,
          warning: `${t('defis.confirm.refuseForced.penaltyPre')} ${forcedLeftAsTarget} ${forcedLeftAsTarget > 1 ? t('defis.confirm.refuseForced.matchPlural') : t('defis.confirm.refuseForced.matchSingular')}`,
          confirmLabel: t('defis.confirm.refuseAnyway'),
          cancelLabel: t('defis.confirm.keep'),
          danger: true,
        } as const;
      }

      if (wasAccepted) {
        return {
          title: t('defis.confirm.flee.title'),
          message: `${t('defis.confirm.flee.messagePre')} ${opponent} ${t('defis.confirm.flee.messagePost')}`,
          warning: t('defis.confirm.flee.warning'),
          confirmLabel: t('defis.confirm.flee.confirm'),
          cancelLabel: t('defis.confirm.keep'),
          danger: true,
        } as const;
      }
      return {
        title: iAmChallenger ? t('defis.confirm.cancelChallenge.title') : t('defis.confirm.refuseChallenge.title'),
        message: iAmChallenger
          ? `${t('defis.confirm.cancelChallenge.message')} ${opponent} ?`
          : `${t('defis.confirm.refuseChallenge.message')} ${opponent} ?`,
        confirmLabel: iAmChallenger ? t('defis.confirm.cancel') : t('defis.confirm.refuse'),
        cancelLabel: t('defis.confirm.keep'),
        danger: true,
      } as const;
    },
    [myLogin, hunter, forcedLeftAsTarget, t],
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
          flash.show(t('defis.toast.challengeAccepted'));
        } else {
          const res = await api.declineChallenge(id);
          if (res.isOps && res.eloPenalty > 0) {
            flash.show(`${t('defis.toast.forcedRefusedPre')}${res.eloPenalty} ${t('defis.toast.forcedRefusedPost')}`, 'error');
          } else {
            flash.show(t('defis.toast.challengeClosed'));
          }
        }
        await refresh();
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      }
    },
    [challenges, confirm, declinePrompt, flash, refresh, t],
  );

  const cancelDeclaration = useCallback(
    async (match: PendingMatch) => {
      const ok = await confirm({
        title: t('defis.confirm.cancelDeclaration.title'),
        message: `${t('defis.confirm.cancelDeclaration.messagePre')} ${match.opponentLogin} (${match.scoreDeclarer}–${match.scoreOpponent}) ${t('defis.confirm.cancelDeclaration.messagePost')}`,
        confirmLabel: t('defis.confirm.cancelDeclaration.confirm'),
        cancelLabel: t('defis.confirm.keep'),
        danger: true,
      });
      if (!ok) return;
      try {
        await api.cancelMatch(match.id);
        flash.show(t('defis.toast.declarationCancelled'));
        await refresh();
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      }
    },
    [confirm, flash, refresh, t],
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
