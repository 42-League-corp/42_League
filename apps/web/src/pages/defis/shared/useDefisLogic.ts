import { useCallback, useMemo } from 'react';
import { api, type Challenge, type LeaderboardEntry, type PendingMatch, type PendingFfa } from '../../../lib/api';
import { useLeagueData } from '../../../hooks/useLeagueData';
import { useFlash } from '../../../hooks/useFlash';
import { useConfirm } from '../../../hooks/useConfirm';
import { useOpsStatus } from '../../../hooks/useOpsStatus';
import { useT } from '../../../lib/i18n';
import { triggerDuelStrike } from '../../../lib/duelStrike';

export interface DefisLogic {
  myLogin: string | undefined;
  incoming: Challenge[];
  outgoing: Challenge[];
  accepted: Challenge[];
  pendingToConfirm: PendingMatch[];
  pendingWaiting: PendingMatch[];
  /** FFA Smash où je dois encore confirmer MA position. */
  ffaToConfirm: PendingFfa[];
  /** FFA Smash que j'attends (déclarés par moi, ou déjà confirmés de mon côté). */
  ffaWaiting: PendingFfa[];
  /** Manches de fléchettes où je dois encore confirmer MON reste. */
  dartsToConfirm: PendingFfa[];
  /** Manches de fléchettes que j'attends (déclarées par moi, ou déjà confirmées). */
  dartsWaiting: PendingFfa[];
  others: LeaderboardEntry[];
  recentOpponents: LeaderboardEntry[];
  opponentCounts: Record<string, number>;
  refresh: () => Promise<void>;
  handleAction: (id: string, action: 'accept' | 'decline') => Promise<void>;
  cancelDeclaration: (match: PendingMatch) => Promise<void>;
  /** Confirme MA position dans un FFA (position = ma place affichée). */
  confirmFfa: (id: string, position: number) => Promise<void>;
  /** Conteste MA position (revendique `claimedPosition`) → annule le FFA. */
  contestFfa: (id: string, claimedPosition: number, message?: string) => Promise<void>;
  /** Annule un FFA que j'ai déclaré. */
  cancelFfaDeclaration: (id: string) => Promise<void>;
  /** Confirme MON reste dans une manche de fléchettes. */
  confirmDarts: (id: string, remaining: number) => Promise<void>;
  /** Conteste MON reste (revendique `claimedRemaining`) → annule la manche. */
  contestDarts: (id: string, claimedRemaining: number, message?: string) => Promise<void>;
  /** Annule une manche de fléchettes que j'ai déclarée. */
  cancelDartsDeclaration: (id: string) => Promise<void>;
}

/**
 * Logique métier de la page Défis — extraite pour partage Desktop/Mobile.
 * Ne contient aucune UI, juste de la donnée dérivée et des actions.
 */
export function useDefisLogic(): DefisLogic {
  const { challenges, leaderboard, me, pending, pendingFfas, pendingDarts, matches, refresh } = useLeagueData();
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
      if (c.status === 'accepted') {
        acc.push(c);
      } else if (c.status === 'pending') {
        if (c.mode === '2v2') {
          // 2v2 : les 2 adversaires doivent accepter (reçus) ; l'équipe du
          // challenger (lui + coéquipier) voit le défi comme envoyé.
          if (c.opponentLogin === myLogin || c.opponentPartnerLogin === myLogin) inc.push(c);
          else if (c.challengerLogin === myLogin || c.partnerLogin === myLogin) out.push(c);
        } else if (c.opponentLogin === myLogin) {
          inc.push(c);
        } else if (c.challengerLogin === myLogin) {
          out.push(c);
        }
      }
    }
    return { incoming: inc, outgoing: out, accepted: acc };
  }, [challenges, myLogin]);

  const { pendingToConfirm, pendingWaiting } = useMemo(() => {
    const toConfirm: PendingMatch[] = [];
    const waiting: PendingMatch[] = [];
    for (const p of pending) {
      if (p.mode === '2v2') {
        // 2v2 : les 3 NON-déclarants (coéquipier du déclarant + les 2 adversaires)
        // confirment chacun leur présence — c'est l'anti-farming du back, qui exige
        // les 3 validations pour régler le match. Un joueur qui a déjà confirmé, et
        // le déclarant lui-même, passent en simple attente.
        const iConfirmed =
          (p.partner1Login === myLogin && p.partner1Confirmed) ||
          (p.opponentLogin === myLogin && p.opp1Confirmed) ||
          (p.partner2Login === myLogin && p.opp2Confirmed);
        const iAmNonDeclarer =
          p.partner1Login === myLogin ||
          p.opponentLogin === myLogin ||
          p.partner2Login === myLogin;
        if (iAmNonDeclarer && !iConfirmed) toConfirm.push(p);
        else if (p.declarerLogin === myLogin || iAmNonDeclarer) waiting.push(p);
      } else if (p.opponentLogin === myLogin) toConfirm.push(p);
      else if (p.declarerLogin === myLogin) waiting.push(p);
    }
    return { pendingToConfirm: toConfirm, pendingWaiting: waiting };
  }, [pending, myLogin]);

  // FFA Smash : je dois confirmer MA place tant que ma ligne n'est pas confirmée ;
  // sinon (déjà confirmée, ou je suis le déclarant auto-confirmé) je suis en attente.
  const { ffaToConfirm, ffaWaiting } = useMemo(() => {
    const toConfirm: PendingFfa[] = [];
    const waiting: PendingFfa[] = [];
    for (const f of pendingFfas) {
      // Les fléchettes réutilisent les tables FFA (game='flechettes') ; elles
      // ont leur propre source (pendingDarts) et ne doivent JAMAIS apparaître
      // dans un flux/carte Smash.
      if (f.game === 'flechettes') continue;
      const mine = f.participants.find((p) => p.login === myLogin);
      if (!mine) continue;
      if (mine.confirmed) waiting.push(f);
      else toConfirm.push(f);
    }
    return { ffaToConfirm: toConfirm, ffaWaiting: waiting };
  }, [pendingFfas, myLogin]);

  // Fléchettes : même logique que le FFA (confirmer SON reste, ou attendre).
  const { dartsToConfirm, dartsWaiting } = useMemo(() => {
    const toConfirm: PendingFfa[] = [];
    const waiting: PendingFfa[] = [];
    for (const d of pendingDarts) {
      const mine = d.participants.find((p) => p.login === myLogin);
      if (!mine) continue;
      if (mine.confirmed) waiting.push(d);
      else toConfirm.push(d);
    }
    return { dartsToConfirm: toConfirm, dartsWaiting: waiting };
  }, [pendingDarts, myLogin]);

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
          const challenge = challenges.find((c) => c.id === id);
          await api.acceptChallenge(id);
          // Cinématique « coup de foudre → VERSUS » : on est l'adversaire qui
          // accepte, le challenger est en face.
          if (challenge && myLogin) {
            triggerDuelStrike({
              kind: 'accept',
              meLogin: myLogin,
              opponentLogin: challenge.challengerLogin,
              game: challenge.game,
            });
          }
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
    [challenges, confirm, declinePrompt, flash, refresh, t, myLogin],
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

  const confirmFfa = useCallback(
    async (id: string, position: number) => {
      try {
        await api.confirmFfaPosition(id, position);
        flash.show(t('ffa.toast.confirmed'));
        await refresh();
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      }
    },
    [flash, refresh, t],
  );

  const contestFfa = useCallback(
    async (id: string, claimedPosition: number, message?: string) => {
      try {
        await api.contestFfa(id, claimedPosition, message);
        flash.show(t('ffa.toast.contested'));
        await refresh();
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      }
    },
    [flash, refresh, t],
  );

  const cancelFfaDeclaration = useCallback(
    async (id: string) => {
      const ok = await confirm({
        title: t('ffa.confirm.cancel.title'),
        message: t('ffa.confirm.cancel.message'),
        confirmLabel: t('defis.confirm.cancel'),
        cancelLabel: t('defis.confirm.keep'),
        danger: true,
      });
      if (!ok) return;
      try {
        await api.cancelFfa(id);
        flash.show(t('ffa.toast.cancelled'));
        await refresh();
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      }
    },
    [confirm, flash, refresh, t],
  );

  const confirmDarts = useCallback(
    async (id: string, remaining: number) => {
      try {
        await api.confirmDarts(id, remaining);
        flash.show(t('darts.toast.confirmed'));
        await refresh();
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      }
    },
    [flash, refresh, t],
  );

  const contestDarts = useCallback(
    async (id: string, claimedRemaining: number, message?: string) => {
      try {
        await api.contestDarts(id, claimedRemaining, message);
        flash.show(t('darts.toast.contested'));
        await refresh();
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      }
    },
    [flash, refresh, t],
  );

  const cancelDartsDeclaration = useCallback(
    async (id: string) => {
      const ok = await confirm({
        title: t('darts.confirm.cancel.title'),
        message: t('darts.confirm.cancel.message'),
        confirmLabel: t('defis.confirm.cancel'),
        cancelLabel: t('defis.confirm.keep'),
        danger: true,
      });
      if (!ok) return;
      try {
        await api.cancelDarts(id);
        flash.show(t('darts.toast.cancelled'));
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
    ffaToConfirm,
    ffaWaiting,
    dartsToConfirm,
    dartsWaiting,
    others,
    recentOpponents,
    opponentCounts,
    refresh,
    handleAction,
    cancelDeclaration,
    confirmFfa,
    contestFfa,
    cancelFfaDeclaration,
    confirmDarts,
    contestDarts,
    cancelDartsDeclaration,
  };
}
