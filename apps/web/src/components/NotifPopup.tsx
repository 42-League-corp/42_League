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
        <div className="rounded-2xl border border-gold/50 glass-strong overflow-hidden"
          style={{ boxShadow: '0 0 0 1px rgba(255,201,74,0.18), 0 16px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,215,120,0.08)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gold/20 bg-gradient-to-r from-gold/[0.12] via-gold/[0.06] to-transparent">
            <span className="text-base text-gold animate-ember">⚡</span>
            <span className="flex-1 font-gaming text-[11px] font-extrabold uppercase tracking-[0.18em] text-gold">
              {toConfirm.length} game{toConfirm.length > 1 ? 's' : ''} à confirmer
            </span>
            <button
              onClick={() => setDismissed(true)}
              className="text-muted hover:text-gold transition-colors text-lg leading-none w-6 h-6 flex items-center justify-center rounded-full hover:bg-gold/10"
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
                        <span className="font-bold text-gold">{p.declarerLogin}</span>
                        {' '}a déclaré
                      </div>
                      <div className="font-display text-xl font-black tabular-nums text-text-strong leading-tight">
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
                      className="shine relative overflow-hidden flex-1 py-2 rounded-lg text-[11px] font-extrabold uppercase tracking-wider text-[#1a0d00] transition-all active:scale-[0.97] disabled:opacity-50 border border-[#ffc966]/60"
                      style={{
                        background:
                          'linear-gradient(180deg, #ffa83a, #f08020 60%, #c5520a)',
                        boxShadow:
                          'inset 0 1px 0 rgba(255,247,228,0.5), 0 4px 12px rgba(255,128,32,0.35)',
                      }}
                    >
                      <span className="relative z-10">{busy ? '…' : '✓ Confirmer'}</span>
                    </button>
                    <button
                      onClick={() => setContesting(p)}
                      disabled={busy}
                      className="px-3 py-2 rounded-lg text-[11px] font-extrabold uppercase tracking-wider border border-border text-muted-2 hover:border-red/60 hover:text-red hover:bg-red/5 transition-all disabled:opacity-50"
                    >
                      Contester
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer hint */}
          <div className="px-3 py-2 border-t border-gold/15 bg-bg-2/40">
            <p className="text-[10px] text-muted text-center">
              Visible aussi sur la page{' '}
              <a href="/defis" className="text-gold hover:underline">Défis</a>
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
