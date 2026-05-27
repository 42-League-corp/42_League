import { useCallback, useState } from 'react';
import { AbacusSlider } from '../../../components/AbacusSlider';
import { OutcomeButton } from '../../../components/OutcomeButton';
import { Button } from '../../../components/Button';
import { api, type LeaderboardEntry } from '../../../lib/api';
import { useFlash } from '../../../hooks/useFlash';
import { haptic } from '../../../mobile/feedback/useHaptic';
import { PlayerSearch } from './PlayerSearch';

export const WINNING_SCORE = 10;
export const LOSER_SCORE_MIN = -10;
export const LOSER_SCORE_MAX = WINNING_SCORE - 1;

const SEND_AWAY_ANIM_MS = 140;

interface DeclareGameFlowProps {
  others: LeaderboardEntry[];
  recentOpponents: LeaderboardEntry[];
  opponentCounts: Record<string, number>;
  myLogin: string | undefined;
  /** Appelé après un POST réussi. Doit refresh les data + (optionnel) fermer le container. */
  onSubmitted: () => Promise<void> | void;
  /** Mode visuel — change l'autofocus + la taille des inputs. */
  variant?: 'desktop' | 'mobile';
}

/**
 * Flow de déclaration d'une game passée — partagé entre la carte desktop
 * (DesktopDeclareGameSection) et la BottomSheet mobile (MobileDeclareGameSheet).
 *
 * Contient les 3 étapes : recherche → résultat (gagné/perdu) → score du perdant.
 * Pas de chrome (pas de card, pas de header) — c'est le rôle du wrapper.
 */
export function DeclareGameFlow({
  others,
  recentOpponents,
  opponentCounts,
  myLogin,
  onSubmitted,
  variant = 'desktop',
}: DeclareGameFlowProps) {
  const flash = useFlash();
  const [opponent, setOpponent] = useState<LeaderboardEntry | null>(null);
  const [iWon, setIWon] = useState<boolean | null>(null);
  const [loserScore, setLoserScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  const handleOutcome = (won: boolean) => {
    haptic(won ? 'success' : 'warning');
    setIWon(won);
    setLoserScore(0);
  };

  const handleSubmit = useCallback(async () => {
    if (!opponent || iWon === null) return;
    const scoreSelf = iWon ? WINNING_SCORE : loserScore;
    const scoreOpponent = iWon ? loserScore : WINNING_SCORE;
    setBusy(true);
    try {
      await api.declareMatch({ opponentLogin: opponent.login, scoreSelf, scoreOpponent });
      flash.show(`Game déclarée — ${opponent.login} doit confirmer le score`);
      haptic('success');
      await onSubmitted();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
      haptic('error');
    } finally {
      setBusy(false);
      setSending(false);
    }
  }, [opponent, iWon, loserScore, flash, onSubmitted]);

  const triggerSend = () => {
    setSending(true);
    haptic('medium');
    window.setTimeout(handleSubmit, SEND_AWAY_ANIM_MS);
  };

  const winnerLogin = iWon ? (myLogin ?? 'Moi') : (opponent?.login ?? '');
  const loserLogin = iWon ? (opponent?.login ?? '') : (myLogin ?? 'Moi');

  return (
    <div className={`relative flex flex-col ${sending ? 'animate-send-away pointer-events-none' : ''}`}>
      <div className="relative z-20">
        <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
          Adversaire
        </label>
        <PlayerSearch
          variant={variant}
          players={others}
          recentPlayers={recentOpponents}
          opponentCounts={opponentCounts}
          selected={opponent}
          onSelect={setOpponent}
          onClear={() => { setOpponent(null); setIWon(null); }}
        />
      </div>

      {opponent && iWon === null && (
        <div className="relative mt-6 animate-slide-down">
          <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-3">
            Résultat
          </label>
          <div className="grid grid-cols-2 gap-4">
            <OutcomeButton kind="win" onClick={() => handleOutcome(true)}>J'ai gagné</OutcomeButton>
            <OutcomeButton kind="loss" onClick={() => handleOutcome(false)}>J'ai perdu</OutcomeButton>
          </div>
        </div>
      )}

      {opponent && iWon !== null && (
        <div className="relative mt-6 animate-fade-in">
          <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
            Résultat
          </label>
          <button
            type="button"
            onClick={() => setIWon(null)}
            aria-label="Modifier le résultat"
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all shadow-sm hover:shadow-md tap-transparent active:scale-[0.98] ${
              iWon
                ? 'border-teal/40 bg-teal/10 text-teal hover:bg-teal/20'
                : 'border-red/40 bg-red/10 text-red hover:bg-red/20'
            }`}
          >
            <span className="text-sm font-extrabold tracking-wide">
              {iWon ? "🏆 J'ai gagné" : "💀 J'ai perdu"}
            </span>
            <span className="text-muted-2 text-lg leading-none">×</span>
          </button>
        </div>
      )}

      {opponent && iWon !== null && (
        <div className="relative mt-8 animate-slide-down">
          <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-4 text-center">
            Score de {iWon ? opponent.login : (myLogin ?? 'moi')}
          </label>

          <AbacusSlider
            value={loserScore}
            onChange={setLoserScore}
            min={LOSER_SCORE_MIN}
            max={LOSER_SCORE_MAX}
          />

          <div className="mt-8 px-4 py-3 rounded-xl bg-bg-1/80 border border-border text-center text-sm text-muted-2 leading-relaxed shadow-inner">
            <span className={`font-extrabold ${iWon ? 'text-teal' : 'text-text-strong'}`}>{winnerLogin}</span>
            {' a gagné '}
            <span className="font-extrabold text-text-strong text-base font-mono tabular-nums">{WINNING_SCORE}</span>
            <span className="text-muted mx-2 opacity-50">/</span>
            <span className={`font-extrabold text-base font-mono tabular-nums ${loserScore < 0 ? 'text-red' : 'text-text-strong'}`}>
              {loserScore}
            </span>
            {' face à '}
            <span className={`font-extrabold ${iWon ? 'text-text-strong' : 'text-teal'}`}>{loserLogin}</span>
          </div>

          <div className="mt-5">
            <Button size="md" loading={busy} onClick={triggerSend} className="w-full py-3.5 text-sm font-bold shadow-lg">
              Envoyer la déclaration
            </Button>
          </div>

          <p className="mt-3 text-[10px] text-muted/70 leading-relaxed text-center font-medium">
            {opponent.login} devra confirmer ce score pour valider la game.
          </p>
        </div>
      )}
    </div>
  );
}
