import { useCallback, useMemo, useState } from 'react';
import { useLeagueData } from '../hooks/useLeagueData';
import { useFlash } from '../hooks/useFlash';
import { useConfirm } from '../hooks/useConfirm';
import { useOpsStatus } from '../hooks/useOpsStatus';
import { api, type Challenge, type Game, type PendingMatch } from '../lib/api';
import { ContestModal } from './ContestModal';
import { gameColor, GAME_EMOJI } from '../lib/gameVisuals';

// ─────────────────────────────────────────────────────────────────────────────
// Bannière de notifications temps réel — reprend le design de l'extension
// (apps/extension/src/content/intra.ts → "league-42-notif-banner").
//
// Elle est TEMPS RÉEL sans code SSE ici : `pending` et `challenges` viennent de
// useLeagueData, qui les rafraîchit automatiquement à la réception des events
// SSE (`match:pending`, `challenge:received`, …). Dès qu'un duel ou un score à
// valider arrive, la bannière apparaît sans recharger la page.
//
// Deux types de cartes :
//   ⚔️ Duel reçu      → challenge.opponentLogin === moi && status === 'pending'
//   ⚡ Score à valider → pending.opponentLogin === moi
// ─────────────────────────────────────────────────────────────────────────────

// Palette identique à l'extension.
const C = {
  bg: '#0b0f17',
  amber: '#ffb71b',
  cyan: '#00d9dc',
  cyanDark: '#00babc',
  red: '#ff3b5c',
  text: '#e6ecf5',
  muted: '#95a3b8',
  muted2: '#6b7689',
  border: '#243044',
};

/** hex #rrggbb → rgba(r,g,b,a) (pour teinter bordure/halo au mode de jeu). */
function rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function NotifBanner() {
  const { me, pending, challenges, refresh } = useLeagueData();
  const flash = useFlash();
  const confirm = useConfirm();
  const { hunter, forcedLeftAsTarget } = useOpsStatus();
  const myLogin = me?.login ?? null;

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [contesting, setContesting] = useState<PendingMatch | null>(null);
  const [contestBusy, setContestBusy] = useState(false);

  // Duels reçus en attente de ma réponse.
  const duels = useMemo(
    () =>
      challenges.filter(
        (c) =>
          c.opponentLogin === myLogin &&
          c.status === 'pending' &&
          !dismissed.has(c.id),
      ),
    [challenges, myLogin, dismissed],
  );

  // Scores déclarés par l'adversaire, en attente de ma validation.
  const scores = useMemo(
    () =>
      pending.filter((p) => p.opponentLogin === myLogin && !dismissed.has(p.id)),
    [pending, myLogin, dismissed],
  );

  const total = duels.length + scores.length;

  // Mode de jeu dominant des notifs visibles : si elles portent TOUTES sur la même
  // discipline, on teinte tout le cadre du popup (bordure + halo + header + pulse)
  // à sa couleur ; sinon (modes mêlés) on garde le doré neutre — le liseré par
  // ligne suffit alors à distinguer chaque discipline.
  const { accent, soleGame } = useMemo(() => {
    const games = new Set<Game>();
    for (const c of duels) games.add(c.game ?? 'babyfoot');
    for (const p of scores) games.add(p.game ?? 'babyfoot');
    const sole = games.size === 1 ? [...games][0]! : null;
    return { accent: sole ? gameColor(sole) : C.amber, soleGame: sole };
  }, [duels, scores]);

  const keyframes = `
@keyframes l42nb-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes l42nb-pulse { 0%,100% { box-shadow: 0 0 0 0 ${rgba(accent, 0.4)}; } 50% { box-shadow: 0 0 0 6px ${rgba(accent, 0)}; } }
`;

  const setBusyId = useCallback((id: string, on: boolean) => {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const dismissAll = useCallback(() => {
    setDismissed((prev) => {
      const next = new Set(prev);
      for (const d of duels) next.add(d.id);
      for (const s of scores) next.add(s.id);
      return next;
    });
  }, [duels, scores]);

  // Accepte tout d'un coup : tous les duels en attente + tous les scores à
  // valider. Permet d'enchaîner très vite quand plusieurs games s'accumulent.
  const [acceptingAll, setAcceptingAll] = useState(false);
  const acceptAll = useCallback(async () => {
    setAcceptingAll(true);
    const ids = [...duels.map((d) => d.id), ...scores.map((s) => s.id)];
    setBusy((prev) => new Set([...prev, ...ids]));
    try {
      await Promise.allSettled([
        ...duels.map((d) => api.acceptChallenge(d.id)),
        ...scores.map((p) =>
          api.confirmMatch(p.id, p.scoreOpponent, p.scoreDeclarer, {
            game: p.game,
            bestOf: p.bestOf as 3 | 5 | undefined,
          }),
        ),
      ]);
      await refresh();
      flash.show(`${ids.length} demande${ids.length > 1 ? 's' : ''} acceptée${ids.length > 1 ? 's' : ''} ✓`, 'info');
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      setAcceptingAll(false);
    }
  }, [duels, scores, flash]);

  // ─── Actions duel ──────────────────────────────────────────────────────────
  const acceptDuel = useCallback(
    async (id: string) => {
      setBusyId(id, true);
      try {
        await api.acceptChallenge(id);
        await refresh();
        flash.show('Duel accepté ⚔️', 'info');
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      } finally {
        setBusyId(id, false);
      }
    },
    [flash, refresh, setBusyId],
  );

  const declineDuel = useCallback(
    async (c: Challenge) => {
      // Refuser un défi de SON traqueur pendant un match forcé = grosse pénalité.
      const isForcedByHunter =
        !!hunter && c.challengerLogin === hunter.ownerLogin && forcedLeftAsTarget > 0;
      if (isForcedByHunter) {
        const ok = await confirm({
          title: 'Refuser un match forcé ?',
          message: `${c.challengerLogin} t'a déclaré comme son ops. Tu ne peux pas refuser ce défi sans sanction.`,
          warning: `Refuser maintenant te coûte 3× l'ELO d'une défaite. Il te reste ${forcedLeftAsTarget} match${forcedLeftAsTarget > 1 ? 's' : ''} forcé${forcedLeftAsTarget > 1 ? 's' : ''}.`,
          confirmLabel: 'Refuser quand même',
          danger: true,
        });
        if (!ok) return;
      }
      setBusyId(c.id, true);
      try {
        const res = await api.declineChallenge(c.id);
        await refresh();
        if (res.isOps && res.eloPenalty > 0) {
          flash.show(`Match forcé refusé · −${res.eloPenalty} ELO ☠`, 'error');
        } else {
          flash.show('Duel refusé.');
        }
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      } finally {
        setBusyId(c.id, false);
      }
    },
    [flash, confirm, hunter, forcedLeftAsTarget, refresh, setBusyId],
  );

  // ─── Actions score ───────────────────────────────────────────────────────────
  const confirmScore = useCallback(
    async (p: PendingMatch) => {
      setBusyId(p.id, true);
      try {
        // Côté moi : mon score = scoreOpponent, celui du déclarant = scoreDeclarer.
        await api.confirmMatch(p.id, p.scoreOpponent, p.scoreDeclarer, {
          game: p.game,
          bestOf: p.bestOf as 3 | 5 | undefined,
        });
        await refresh();
        flash.show('Game confirmée ✓', 'info');
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      } finally {
        setBusyId(p.id, false);
      }
    },
    [flash, refresh, setBusyId],
  );

  const submitContest = useCallback(
    async (reason: 'never_played' | 'wrong_score', message: string) => {
      if (!contesting) return;
      setContestBusy(true);
      try {
        await api.rejectMatch(contesting.id, reason, message);
        await refresh();
        flash.show('Contestation envoyée.');
        setContesting(null);
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      } finally {
        setContestBusy(false);
      }
    },
    [contesting, flash, refresh],
  );

  if (!myLogin || total === 0) {
    return contesting ? renderContest() : null;
  }

  function renderContest() {
    if (!contesting) return null;
    return (
      <ContestModal
        declarerLogin={contesting.declarerLogin}
        score={`${contesting.scoreDeclarer}–${contesting.scoreOpponent}`}
        busy={contestBusy}
        onSubmit={submitContest}
        onClose={() => setContesting(null)}
      />
    );
  }

  return (
    <>
      <style>{keyframes}</style>
      <div
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 2147483646,
          width: 320,
          maxWidth: 'calc(100vw - 32px)',
          background: C.bg,
          border: `1px solid ${rgba(accent, 0.5)}`,
          borderRadius: 8,
          boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 24px ${rgba(accent, 0.15)}`,
          fontFamily: "'Inter', system-ui, sans-serif",
          animation: 'l42nb-in 220ms ease-out, l42nb-pulse 2s ease-in-out 500ms 3',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px 8px',
            borderBottom: `1px solid ${rgba(accent, 0.2)}`,
          }}
        >
          <span style={{ fontSize: 14 }}>{soleGame ? GAME_EMOJI[soleGame] : '⚡'}</span>
          <span
            style={{
              flex: 1,
              fontSize: 10,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: accent,
            }}
          >
            {total} notification{total > 1 ? 's' : ''}
          </span>
          {total > 1 && (
            <button
              onClick={acceptAll}
              disabled={acceptingAll}
              title="Tout accepter"
              style={{
                background: `linear-gradient(180deg, ${C.cyan}, ${C.cyanDark})`,
                color: '#001416',
                border: 'none',
                borderRadius: 5,
                padding: '4px 9px',
                fontSize: 9,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                cursor: acceptingAll ? 'default' : 'pointer',
                opacity: acceptingAll ? 0.5 : 1,
              }}
            >
              ✓ Tout
            </button>
          )}
          <button
            onClick={dismissAll}
            title="Fermer (réapparaît au prochain événement)"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: C.muted2,
              fontSize: 16,
              lineHeight: 1,
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 3,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ maxHeight: 'min(70vh, 460px)', overflowY: 'auto' }}>
        {/* Duels reçus — teintés à la couleur + emoji de leur discipline. */}
        {duels.map((c) => {
          const game = c.game ?? 'babyfoot';
          const color = gameColor(game);
          return (
          <Row key={c.id} accent={color}>
            <Meta>
              <span style={{ fontSize: 16 }}>{GAME_EMOJI[game]}</span>
              <span style={{ color, fontWeight: 700 }}>{c.challengerLogin}</span>
              {' te défie en duel'}
            </Meta>
            <Actions>
              <ConfirmBtn disabled={busy.has(c.id)} onClick={() => acceptDuel(c.id)}>
                ✓ Accepter
              </ConfirmBtn>
              <ContestBtn disabled={busy.has(c.id)} onClick={() => declineDuel(c)}>
                Refuser
              </ContestBtn>
            </Actions>
          </Row>
          );
        })}

        {/* Scores à valider — teintés à la couleur + emoji de leur discipline. */}
        {scores.map((p) => {
          const game = p.game ?? 'babyfoot';
          const color = gameColor(game);
          return (
          <Row key={p.id} accent={color}>
            <Meta>
              <span style={{ fontSize: 16 }}>{GAME_EMOJI[game]}</span>
              <span style={{ color, fontWeight: 700 }}>{p.declarerLogin}</span>
              {' a déclaré :'}
            </Meta>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
              <span
                style={{
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 18,
                  color: '#fff',
                  letterSpacing: '0.05em',
                }}
              >
                {p.scoreDeclarer}
                <span style={{ color: C.muted2, margin: '0 4px', fontSize: 16 }}>–</span>
                {p.scoreOpponent}
              </span>
              <span style={{ fontSize: 10, color: C.muted2 }}>(eux – toi)</span>
            </div>
            <Actions>
              <ConfirmBtn disabled={busy.has(p.id)} onClick={() => confirmScore(p)}>
                ✓ Confirmer
              </ConfirmBtn>
              <ContestBtn disabled={busy.has(p.id)} onClick={() => setContesting(p)}>
                Contester
              </ContestBtn>
            </Actions>
          </Row>
          );
        })}
        </div>
      </div>

      {renderContest()}
    </>
  );
}

// ─── Sous-composants de présentation (styles identiques à l'extension) ─────────

function Row({ children, accent }: { children: React.ReactNode; accent?: string }) {
  // Chaque case est franchement teintée à la couleur de SA discipline : voile
  // diagonal + bordure pleine + liseré gauche, pour qu'un babyfoot (jaune), un
  // smash (rouge), un échecs (vert) ou un SF (orange) se distinguent au premier
  // coup d'œil — y compris quand plusieurs disciplines coexistent dans le popup.
  const tint = accent ?? '#3a4658';
  return (
    <div
      style={{
        margin: 8,
        padding: '10px 12px',
        borderRadius: 8,
        border: `1px solid ${tint}59`,
        borderLeft: `3px solid ${tint}`,
        background: `linear-gradient(135deg, ${tint}2b 0%, ${tint}0d 55%, rgba(255,255,255,0.02) 100%)`,
        boxShadow: `0 1px 6px ${tint}1f`,
      }}
    >
      {children}
    </div>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
        fontSize: 12,
        color: C.muted,
      }}
    >
      {children}
    </div>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>{children}</div>;
}

function ConfirmBtn({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        flex: 1,
        padding: '7px 12px',
        background: `linear-gradient(180deg, ${C.cyan}, ${C.cyanDark})`,
        color: '#001416',
        fontWeight: 800,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        border: 'none',
        borderRadius: 5,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

function ContestBtn({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '7px 12px',
        background: 'transparent',
        color: C.muted,
        fontWeight: 700,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        border: `1px solid ${C.border}`,
        borderRadius: 5,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}
