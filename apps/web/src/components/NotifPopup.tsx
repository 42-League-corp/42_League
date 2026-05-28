import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Swords, X } from 'lucide-react';
import { useLeagueData } from '../hooks/useLeagueData';
import { useFlash } from '../hooks/useFlash';
import { api, type PendingMatch } from '../lib/api';
import { Avatar } from './Avatar';
import { ContestModal } from './ContestModal';

/** One toast per pending match. Stacks in top-right, auto-dismisses after 8s. */
export function NotifPopup() {
  const { me, pending, refresh } = useLeagueData();
  const flash = useFlash();
  const navigate = useNavigate();

  const toConfirm = pending.filter((p) => p.opponentLogin === me?.login);

  // Track which match IDs have already been "seen" in this session
  const seenRef = useRef<Set<string>>(new Set());
  const [visibleIds, setVisibleIds] = useState<string[]>([]);

  useEffect(() => {
    const newIds = toConfirm
      .map((p) => p.id)
      .filter((id) => !seenRef.current.has(id));

    if (newIds.length > 0) {
      newIds.forEach((id) => seenRef.current.add(id));
      setVisibleIds((prev) => [...prev, ...newIds]);
    }
  }, [toConfirm]);

  const dismiss = useCallback((id: string) => {
    setVisibleIds((prev) => prev.filter((v) => v !== id));
  }, []);

  const [contesting, setContesting] = useState<PendingMatch | null>(null);
  const [contestBusy, setContestBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState<Record<string, boolean>>({});

  const handleConfirm = useCallback(
    async (p: PendingMatch) => {
      setConfirmBusy((prev) => ({ ...prev, [p.id]: true }));
      try {
        await api.confirmMatch(p.id, p.scoreOpponent, p.scoreDeclarer);
        flash.show('✅ Game confirmée !');
        dismiss(p.id);
        await refresh();
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      } finally {
        setConfirmBusy((prev) => ({ ...prev, [p.id]: false }));
      }
    },
    [flash, refresh, dismiss],
  );

  const handleContestSubmit = useCallback(
    async (reason: 'never_played' | 'wrong_score', message: string) => {
      if (!contesting) return;
      setContestBusy(true);
      try {
        await api.rejectMatch(contesting.id, reason, message);
        flash.show('Contestation envoyée.');
        dismiss(contesting.id);
        setContesting(null);
        await refresh();
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err), 'error');
      } finally {
        setContestBusy(false);
      }
    },
    [contesting, flash, refresh, dismiss],
  );

  const matchById = (id: string) => toConfirm.find((p) => p.id === id);

  return (
    <>
      {/* Toast stack — top right */}
      <div className="fixed top-4 right-4 z-[90] flex flex-col gap-2.5 w-80 max-w-[calc(100vw-2rem)] pointer-events-none">
        <AnimatePresence initial={false}>
          {visibleIds.map((id) => {
            const match = matchById(id);
            if (!match) return null;
            return (
              <MatchToast
                key={id}
                match={match}
                busy={confirmBusy[id] ?? false}
                onConfirm={() => handleConfirm(match)}
                onContest={() => setContesting(match)}
                onDismiss={() => dismiss(id)}
                onNavigate={() => { dismiss(id); navigate('/defis'); }}
              />
            );
          })}
        </AnimatePresence>
      </div>

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

// ─── Individual toast card ────────────────────────────────────────────────────

interface MatchToastProps {
  match: PendingMatch;
  busy: boolean;
  onConfirm: () => void;
  onContest: () => void;
  onDismiss: () => void;
  onNavigate: () => void;
}

function MatchToast({ match, busy, onConfirm, onContest, onDismiss, onNavigate }: MatchToastProps) {
  const [progress, setProgress] = useState(100);
  const AUTO_DISMISS_MS = 10000;

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100);
      setProgress(pct);
      if (pct === 0) onDismiss();
    }, 80);
    return () => clearInterval(interval);
  }, [onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className="pointer-events-auto relative overflow-hidden rounded-2xl"
      style={{
        background: 'linear-gradient(135deg, #1d1914 0%, #15120e 100%)',
        border: '1px solid rgba(255,201,74,0.3)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.55), 0 0 24px rgba(255,201,74,0.08), inset 0 1px 0 rgba(255,215,120,0.07)',
      }}
    >
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gold/10">
        <div
          className="h-full bg-gradient-to-r from-gold/70 to-gold rounded-full transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Gold top line */}
      <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <div className="p-3.5">
        {/* Header */}
        <div className="flex items-start gap-2.5 mb-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="relative">
              <Avatar login={match.declarerLogin} imageUrl={null} size="sm" />
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-gold flex items-center justify-center ring-2 ring-bg-1">
                <Swords className="w-2 h-2 text-[#1a0d00]" strokeWidth={3} />
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-muted-2 leading-snug">
              <span className="font-extrabold text-gold">{match.declarerLogin}</span>
              {' '}a déclaré une game
            </div>
            <div
              className="font-display text-xl font-black tabular-nums text-text-strong leading-none mt-0.5 cursor-pointer hover:text-gold transition-colors"
              onClick={onNavigate}
            >
              {match.scoreDeclarer}
              <span className="text-muted text-base font-normal mx-1.5">–</span>
              {match.scoreOpponent}
              <span className="text-[10px] text-muted font-normal ml-1.5">(eux–toi)</span>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-muted hover:text-gold hover:bg-gold/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={busy}
            className="shine relative overflow-hidden flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider text-[#1a0d00] disabled:opacity-50 active:scale-[0.97] transition-transform"
            style={{
              background: 'linear-gradient(180deg, #ffc94a, #d4961e)',
              boxShadow: 'inset 0 1px 0 rgba(255,247,228,0.45), 0 3px 10px rgba(255,201,74,0.3)',
            }}
          >
            <CheckCircle className="w-3.5 h-3.5" strokeWidth={2.5} />
            {busy ? '…' : 'Confirmer'}
          </button>
          <button
            onClick={onContest}
            disabled={busy}
            className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-[11px] font-extrabold uppercase tracking-wider border border-border text-muted-2 hover:border-red/50 hover:text-red hover:bg-red/5 transition-all disabled:opacity-50"
          >
            <XCircle className="w-3.5 h-3.5" strokeWidth={2.5} />
            Contester
          </button>
        </div>
      </div>
    </motion.div>
  );
}
