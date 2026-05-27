import { useState, useCallback } from 'react';
import { useLeagueData } from '../hooks/useLeagueData';
import { useFlash } from '../hooks/useFlash';
import { api, type PendingMatch } from '../lib/api';
import { Avatar } from './Avatar';
import { ContestModal } from './ContestModal';

export function NotifPopup() {
  const { me, pending, refresh } = useLeagueData();
  const flash = useFlash();

  // Matches waiting for ME to confirm
  const toConfirm = pending.filter((p) => p.opponentLogin === me?.login);

  // Dismissed state (session-only)
  const [dismissed, setDismissed] = useState(false);

  // Contest modal state
  const [contesting, setContesting] = useState<PendingMatch | null>(null);
  const [contestBusy, setContestBusy] = useState(false);

  // Confirm busy map
  const [confirmBusy, setConfirmBusy] = useState<Record<string, boolean>>({});

  const handleConfirm = useCallback(
    async (p: PendingMatch) => {
      setConfirmBusy((prev) => ({ ...prev, [p.id]: true }));
      try {
        await api.confirmMatch(p.id, p.scoreOpponent, p.scoreDeclarer);
        flash.show('✅ Game confirmée !');
        await refresh();
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      } finally {
        setConfirmBusy((prev) => ({ ...prev, [p.id]: false }));
      }
    },
    [flash, refresh],
  );

  const handleContestSubmit = useCallback(
    async (reason: 'never_played' | 'wrong_score', message: string) => {
      if (!contesting) return;
      setContestBusy(true);
      try {
        await api.rejectMatch(contesting.id, reason, message);
        flash.show('Contestation envoyée.');
        setContesting(null);
        await refresh();
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      } finally {
        setContestBusy(false);
      }
    },
    [contesting, flash, refresh],
  );

  if (toConfirm.length === 0 || dismissed) return null;

  return (
    <>
      {/* Fixed banner top-right */}
      <div
        className="fixed top-4 right-4 z-[90] w-80 max-w-[calc(100vw-2rem)] animate-pop"
        style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.5))' }}
      >
        <div className="rounded-xl border border-gold/50 bg-bg-0/95 backdrop-blur-md overflow-hidden"
          style={{ boxShadow: '0 0 0 1px rgba(255,183,27,0.15), 0 16px 40px rgba(0,0,0,0.5)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-gold/[0.06]">
            <span className="text-base animate-pulse">⚡</span>
            <span className="flex-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-gold">
              {toConfirm.length} game{toConfirm.length > 1 ? 's' : ''} à confirmer
            </span>
            <button
              onClick={() => setDismissed(true)}
              className="text-muted hover:text-text-strong transition-colors text-lg leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-white/10"
              title="Fermer"
            >
              ×
            </button>
          </div>

          {/* Match rows */}
          <div className="divide-y divide-border/50">
            {toConfirm.map((p) => {
              const busy = confirmBusy[p.id] ?? false;
              return (
                <div key={p.id} className="px-3 py-3">
                  {/* Declarer + score */}
                  <div className="flex items-center gap-2 mb-2.5">
                    <Avatar login={p.declarerLogin} imageUrl={null} size="xs" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-muted-2">
                        <span className="font-semibold text-gold">{p.declarerLogin}</span>
                        {' '}a déclaré
                      </div>
                      <div className="text-xl font-extrabold tabular-nums text-text-strong leading-tight">
                        {p.scoreDeclarer}
                        <span className="text-muted mx-1 text-base font-normal">–</span>
                        {p.scoreOpponent}
                        <span className="text-[10px] text-muted font-normal ml-1.5">(eux – toi)</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleConfirm(p)}
                      disabled={busy}
                      className="flex-1 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-white transition-all disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #00b8ba, #00d9dc)' }}
                    >
                      {busy ? '…' : '✓ Confirmer'}
                    </button>
                    <button
                      onClick={() => setContesting(p)}
                      disabled={busy}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border border-border text-muted-2 hover:border-red/60 hover:text-red hover:bg-red/5 transition-all disabled:opacity-50"
                    >
                      Contester
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer hint */}
          <div className="px-3 py-2 border-t border-border/50 bg-bg-2/40">
            <p className="text-[10px] text-muted text-center">
              Visible aussi sur la page{' '}
              <a href="/defis" className="text-teal hover:underline">Défis</a>
            </p>
          </div>
        </div>
      </div>

      {/* Contest modal */}
      {contesting && (
        <ContestModal
          declarerLogin={contesting.declarerLogin}
          score={`${contesting.scoreDeclarer}–${contesting.scoreOpponent}`}
          busy={contestBusy}
          onSubmit={handleContestSubmit}
          onClose={() => setContesting(null)}
        />
      )}
    </>
  );
}
