import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Zap } from 'lucide-react';
import { AbacusSlider } from '../../../components/AbacusSlider';
import { Button } from '../../../components/Button';
import { ContestModal } from '../../../components/ContestModal';
import { PlayerLink } from '../../../components/PlayerLink';
import { api, type PendingMatch } from '../../../lib/api';
import { useFlash } from '../../../hooks/useFlash';
import { haptic } from '../../../mobile/feedback/useHaptic';

const WINNING_SCORE = 10;
const LOSER_SCORE_MIN = -10;
const LOSER_SCORE_MAX = WINNING_SCORE - 1;

interface PendingMatchCardProps {
  match: PendingMatch;
  onDone: () => Promise<void>;
}

/**
 * Carte d'un match en attente de confirmation côté mobile.
 * Style premium : border-gold animée, abaque intégré, actions tactiles XL.
 */
export function PendingMatchCard({ match, onDone }: PendingMatchCardProps) {
  const flash = useFlash();
  const [confirming, setConfirming] = useState(false);
  const [contesting, setContesting] = useState(false);
  const [busy, setBusy] = useState(false);

  const iWon = match.scoreOpponent === WINNING_SCORE;
  const loserDeclaredScore = iWon ? match.scoreDeclarer : match.scoreOpponent;
  const [loserScore, setLoserScore] = useState(loserDeclaredScore);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const scoreSelf = iWon ? WINNING_SCORE : loserScore;
      const scoreOpp = iWon ? loserScore : WINNING_SCORE;
      await api.confirmMatch(match.id, scoreSelf, scoreOpp);
      flash.show('✓ Match confirmé — ELO mis à jour !');
      haptic('success');
      await onDone();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
      haptic('error');
    } finally {
      setBusy(false);
    }
  };

  const handleContestSubmit = async (
    reason: 'never_played' | 'wrong_score',
    message: string,
  ) => {
    setBusy(true);
    try {
      await api.rejectMatch(match.id, reason, message);
      flash.show('Contestation envoyée.');
      haptic('warning');
      await onDone();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
      haptic('error');
    } finally {
      setBusy(false);
      setContesting(false);
    }
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="relative overflow-hidden rounded-2xl border-2 border-gold/60 bg-gradient-to-br from-gold/[0.10] to-bg-1/85 backdrop-blur-md shadow-lg"
        style={{ boxShadow: '0 6px 28px -8px rgba(255,201,74,0.35), inset 0 1px 0 rgba(255,215,120,0.12)' }}
      >
        {/* Liseré animé en haut */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent animate-pulse" />
        {/* Petite trame HUD */}
        <div className="absolute inset-0 hud-diag opacity-40 pointer-events-none" />

        <div className="p-4">
          <div className="flex items-center gap-2 text-xs mb-3">
            <Zap className="w-4 h-4 text-gold animate-ember" strokeWidth={2.5} fill="rgba(255,201,74,0.35)" />
            <PlayerLink login={match.declarerLogin} className="font-bold text-gold">
              {match.declarerLogin}
            </PlayerLink>
            <span className="text-muted-2">a déclaré :</span>
          </div>

          <div className="relative flex items-baseline justify-center gap-2 mb-4 font-display">
            <span
              className={`text-4xl font-black tabular-nums ${
                match.scoreDeclarer === WINNING_SCORE ? 'text-gold text-gold-emboss' : 'text-text-strong'
              }`}
            >
              {match.scoreDeclarer}
            </span>
            <span className="text-2xl text-muted">–</span>
            <span
              className={`text-4xl font-black tabular-nums ${
                match.scoreOpponent === WINNING_SCORE ? 'text-gold text-gold-emboss' : 'text-text-strong'
              }`}
            >
              {match.scoreOpponent}
            </span>
          </div>
          <div className="text-center text-[10px] text-muted uppercase tracking-wider font-bold mb-4">
            {match.declarerLogin} <span className="opacity-50 mx-1">/</span> toi
          </div>

          {!confirming ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="md"
                onClick={() => {
                  haptic('light');
                  setConfirming(true);
                }}
                className="py-3 text-sm"
              >
                <Check className="w-4 h-4 mr-1.5" strokeWidth={3} />
                Confirmer
              </Button>
              <Button
                size="md"
                variant="ghost"
                onClick={() => {
                  haptic('light');
                  setContesting(true);
                }}
                className="py-3 text-sm text-red border-red/30 hover:border-red hover:bg-red/5 hover:text-red"
              >
                <X className="w-4 h-4 mr-1.5" strokeWidth={3} />
                Contester
              </Button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="space-y-3"
            >
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold ${
                  iWon
                    ? 'bg-gold/10 text-gold border border-gold/30'
                    : 'bg-red/10 text-red border border-red/30'
                }`}
              >
                <span aria-hidden>{iWon ? '🏆' : '💀'}</span>
                <span>
                  Selon {match.declarerLogin}, tu as {iWon ? 'gagné' : 'perdu'} {WINNING_SCORE}–{loserDeclaredScore}
                </span>
              </div>
              <p className="text-[10px] text-muted leading-relaxed">
                Ajuste le score si ta version diffère.
              </p>
              <AbacusSlider
                value={loserScore}
                onChange={setLoserScore}
                min={LOSER_SCORE_MIN}
                max={LOSER_SCORE_MAX}
              />
              <div className="grid grid-cols-[1fr_auto] gap-2 pt-1">
                <Button size="md" loading={busy} onClick={handleConfirm} className="py-3 text-sm">
                  Valider
                </Button>
                <Button
                  size="md"
                  variant="ghost"
                  onClick={() => setConfirming(false)}
                  className="py-3 px-4 text-sm"
                >
                  Retour
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {contesting && (
        <ContestModal
          declarerLogin={match.declarerLogin}
          score={`${match.scoreDeclarer}–${match.scoreOpponent}`}
          busy={busy}
          onSubmit={handleContestSubmit}
          onClose={() => setContesting(false)}
        />
      )}
    </>
  );
}
