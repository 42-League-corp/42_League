import { useCallback, useMemo, useState } from 'react';
import { useLeagueData } from '../hooks/useLeagueData';
import { useFlash } from '../hooks/useFlash';
import { api, type PendingMatch } from '../lib/api';
import { ContestModal } from './ContestModal';

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

const KEYFRAMES = `
@keyframes l42nb-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes l42nb-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,183,27,0.4); } 50% { box-shadow: 0 0 0 6px rgba(255,183,27,0); } }
`;

export function NotifBanner() {
  const { me, pending, challenges } = useLeagueData();
  const flash = useFlash();
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

  // ─── Actions duel ──────────────────────────────────────────────────────────
  const acceptDuel = useCallback(
    async (id: string) => {
      setBusyId(id, true);
      try {
        await api.acceptChallenge(id);
        flash.show('Duel accepté ⚔️', 'info');
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      } finally {
        setBusyId(id, false);
      }
    },
    [flash, setBusyId],
  );

  const declineDuel = useCallback(
    async (id: string) => {
      setBusyId(id, true);
      try {
        await api.declineChallenge(id);
        flash.show('Duel refusé.');
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      } finally {
        setBusyId(id, false);
      }
    },
    [flash, setBusyId],
  );

  // ─── Actions score ───────────────────────────────────────────────────────────
  const confirmScore = useCallback(
    async (p: PendingMatch) => {
      setBusyId(p.id, true);
      try {
        // Côté moi : mon score = scoreOpponent, celui du déclarant = scoreDeclarer.
        await api.confirmMatch(p.id, p.scoreOpponent, p.scoreDeclarer);
        flash.show('Game confirmée ✓', 'info');
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      } finally {
        setBusyId(p.id, false);
      }
    },
    [flash, setBusyId],
  );

  const submitContest = useCallback(
    async (reason: 'never_played' | 'wrong_score', message: string) => {
      if (!contesting) return;
      setContestBusy(true);
      try {
        await api.rejectMatch(contesting.id, reason, message);
        flash.show('Contestation envoyée.');
        setContesting(null);
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      } finally {
        setContestBusy(false);
      }
    },
    [contesting, flash],
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
      <style>{KEYFRAMES}</style>
      <div
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 2147483646,
          width: 320,
          maxWidth: 'calc(100vw - 32px)',
          background: C.bg,
          border: `1px solid rgba(255,183,27,0.5)`,
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(255,183,27,0.15)',
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
            borderBottom: '1px solid rgba(255,183,27,0.2)',
          }}
        >
          <span style={{ fontSize: 14 }}>⚡</span>
          <span
            style={{
              flex: 1,
              fontSize: 10,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: C.amber,
            }}
          >
            {total} notification{total > 1 ? 's' : ''}
          </span>
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

        {/* Duels reçus */}
        {duels.map((c) => (
          <Row key={c.id}>
            <Meta>
              <span style={{ color: C.amber, fontWeight: 700 }}>{c.challengerLogin}</span>
              {' te défie en duel ⚔️'}
            </Meta>
            <Actions>
              <ConfirmBtn disabled={busy.has(c.id)} onClick={() => acceptDuel(c.id)}>
                ✓ Accepter
              </ConfirmBtn>
              <ContestBtn disabled={busy.has(c.id)} onClick={() => declineDuel(c.id)}>
                Refuser
              </ContestBtn>
            </Actions>
          </Row>
        ))}

        {/* Scores à valider */}
        {scores.map((p) => (
          <Row key={p.id}>
            <Meta>
              <span style={{ color: C.amber, fontWeight: 700 }}>{p.declarerLogin}</span>
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
        ))}
      </div>

      {renderContest()}
    </>
  );
}

// ─── Sous-composants de présentation (styles identiques à l'extension) ─────────

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
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
