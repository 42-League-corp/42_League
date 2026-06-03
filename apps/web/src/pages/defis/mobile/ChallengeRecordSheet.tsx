import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomSheet } from '../../../mobile/primitives/BottomSheet';
import { AbacusSlider } from '../../../components/AbacusSlider';
import { OutcomeButton } from '../../../components/OutcomeButton';
import { SmashCharIcon } from '../../../components/SmashCharIcon';
import { Button } from '../../../components/Button';
import { api, type Challenge } from '../../../lib/api';
import { useLeagueData } from '../../../hooks/useLeagueData';
import { useFlash } from '../../../hooks/useFlash';
import { SMASH_ROSTER } from '../../../lib/smash';
import { haptic } from '../../../mobile/feedback/useHaptic';

const WINNING_SCORE = 10;
const LOSER_SCORE_MIN = -10;
const LOSER_SCORE_MAX = 9;

function smashTarget(bestOf: 3 | 5) {
  return Math.ceil(bestOf / 2);
}

function SmashCharPicker({ label, value, onChange }: {
  label: string; value: string | null; onChange: (id: string) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">{label}</label>
      <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto scrollbar-none p-1 rounded-lg bg-bg-1/50 border border-border/50">
        {SMASH_ROSTER.map((c) => (
          <button key={c.id} type="button" onClick={() => onChange(c.id)} title={c.name}
            className={`rounded-lg transition-all ${value === c.id ? 'ring-2 ring-[#c97bff] scale-105' : 'opacity-75 hover:opacity-100 ring-1 ring-transparent'}`}
          >
            <SmashCharIcon id={c.id} size={38} className="w-full aspect-square" />
          </button>
        ))}
      </div>
    </div>
  );
}

interface ChallengeRecordSheetProps {
  challenge: Challenge | null;
  myLogin: string | undefined;
  onClose: () => void;
  onDone: () => Promise<void>;
}

/**
 * Sheet mobile pour enregistrer le résultat d'un défi accepté.
 * Utilise `challenge.game` (pas le mode global) → interface correcte smash/baby/chess.
 */
export function ChallengeRecordSheet({ challenge, myLogin, onClose, onDone }: ChallengeRecordSheetProps) {
  return (
    <BottomSheet
      open={challenge !== null}
      onClose={onClose}
      title={<span className="gradient-text-brand">Saisir le score</span>}
      snap={94}
    >
      <div className="px-5 pt-4 pb-4">
        {challenge && (
          <RecordForm challenge={challenge} myLogin={myLogin} onClose={onClose} onDone={onDone} />
        )}
      </div>
    </BottomSheet>
  );
}

function RecordForm({ challenge, myLogin, onClose, onDone }: {
  challenge: Challenge; myLogin: string | undefined; onClose: () => void; onDone: () => Promise<void>;
}) {
  const { refresh } = useLeagueData();
  const flash = useFlash();

  const game = challenge.game ?? 'babyfoot';
  const isSmash = game === 'smash';
  const isChess = game === 'chess';
  const opponent = challenge.challengerLogin === myLogin ? challenge.opponentLogin : challenge.challengerLogin;

  const [iWon, setIWon] = useState<boolean | null>(null);
  const [loserScore, setLoserScore] = useState(0);
  const [bestOf, setBestOf] = useState<3 | 5>(3);
  const [loserGames, setLoserGames] = useState(0);
  const [charSelf, setCharSelf] = useState<string | null>(null);
  const [charOpp, setCharOpp] = useState<string | null>(null);
  const [winnerStocks, setWinnerStocks] = useState(3);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  const target = smashTarget(bestOf);

  const handleSubmit = useCallback(async () => {
    if (iWon === null) return;
    setBusy(true);
    try {
      if (isSmash) {
        if (!charSelf || !charOpp) { flash.show('Choisis les deux personnages', 'error'); setBusy(false); setSending(false); return; }
        await api.recordChallengeResult(challenge.id, {
          scoreSelf: iWon ? target : loserGames,
          scoreOpponent: iWon ? loserGames : target,
          game: 'smash', bestOf, charSelf, charOpponent: charOpp, stocks: winnerStocks,
        });
      } else if (isChess) {
        await api.recordChallengeResult(challenge.id, { scoreSelf: iWon ? 1 : 0, scoreOpponent: iWon ? 0 : 1, game: 'chess' });
      } else {
        await api.recordChallengeResult(challenge.id, {
          scoreSelf: iWon ? WINNING_SCORE : loserScore,
          scoreOpponent: iWon ? loserScore : WINNING_SCORE,
        });
      }
      flash.show(`Score envoyé — ${opponent} doit confirmer`);
      haptic('success');
      await refresh();
      await onDone();
      onClose();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
      haptic('error');
    } finally { setBusy(false); setSending(false); }
  }, [iWon, isSmash, isChess, charSelf, charOpp, target, loserGames, bestOf, winnerStocks, loserScore, challenge.id, opponent, flash, refresh, onDone, onClose]);

  const triggerSend = () => { setSending(true); haptic('medium'); window.setTimeout(handleSubmit, 140); };

  const winnerLogin = iWon ? (myLogin ?? 'Moi') : opponent;
  const loserLogin = iWon ? opponent : (myLogin ?? 'Moi');

  return (
    <div className="relative space-y-4">
      <AnimatePresence>
        {sending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 0.55, 0] }} transition={{ duration: 0.4, times: [0, 0.2, 1] }}
            className="absolute inset-0 rounded-xl pointer-events-none z-30"
            style={{ background: 'radial-gradient(ellipse at center, rgba(255,201,74,0.35) 0%, transparent 70%)' }}
          />
        )}
      </AnimatePresence>

      <motion.div
        animate={sending ? { opacity: 0, y: -30, scale: 0.95, filter: 'blur(4px)' } : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        transition={sending ? { duration: 0.3 } : { duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        style={{ pointerEvents: sending ? 'none' : undefined }}
        className="space-y-4"
      >
        {/* Contexte */}
        <div className="text-center text-sm text-muted-2">
          Match contre <span className="font-extrabold text-text-strong">{opponent}</span>
          {game !== 'babyfoot' && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-bg-2 border border-border">
              {game === 'smash' ? 'Smash' : 'Échecs'}
            </span>
          )}
        </div>

        {/* Résultat */}
        {iWon === null ? (
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-3 text-center">Résultat</label>
            <div className="grid grid-cols-2 gap-4">
              <OutcomeButton kind="win" onClick={() => { setIWon(true); haptic('success'); }}>J'ai gagné</OutcomeButton>
              <OutcomeButton kind="loss" onClick={() => { setIWon(false); haptic('warning'); }}>J'ai perdu</OutcomeButton>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setIWon(null)}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all ${iWon ? 'border-teal/40 bg-teal/10 text-teal' : 'border-red/40 bg-red/10 text-red'}`}
          >
            <span className="text-sm font-extrabold">{iWon ? "J'ai gagné" : "J'ai perdu"}</span>
            <span className="text-muted-2 text-lg">×</span>
          </button>
        )}

        {/* Babyfoot */}
        {iWon !== null && !isSmash && !isChess && (
          <div className="space-y-4">
            <label className="block text-[10px] uppercase tracking-wider text-muted font-bold text-center">
              Score de {iWon ? opponent : (myLogin ?? 'moi')}
            </label>
            <AbacusSlider value={loserScore} onChange={setLoserScore} min={LOSER_SCORE_MIN} max={LOSER_SCORE_MAX} />
            <div className="px-4 py-3 rounded-xl bg-bg-1/80 border border-border text-center text-sm text-muted-2 shadow-inner">
              <span className={`font-extrabold ${iWon ? 'text-teal' : 'text-text-strong'}`}>{winnerLogin}</span>
              {' a gagné '}
              <span className="font-extrabold text-text-strong font-mono tabular-nums">{WINNING_SCORE}</span>
              <span className="text-muted mx-2 opacity-50">/</span>
              <span className={`font-extrabold font-mono tabular-nums ${loserScore < 0 ? 'text-red' : 'text-text-strong'}`}>{loserScore}</span>
              {' face à '}
              <span className={`font-extrabold ${iWon ? 'text-text-strong' : 'text-teal'}`}>{loserLogin}</span>
            </div>
            <Button size="md" loading={busy} onClick={triggerSend} className="w-full py-3.5 text-sm font-bold shadow-lg">Envoyer le score</Button>
          </div>
        )}

        {/* Smash */}
        {iWon !== null && isSmash && (
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">Format</label>
              <div className="grid grid-cols-2 gap-2">
                {([3, 5] as const).map((bo) => (
                  <button key={bo} type="button"
                    onClick={() => { setBestOf(bo); setLoserGames((g) => Math.min(g, smashTarget(bo) - 1)); }}
                    className={`py-2.5 rounded-xl border-2 text-sm font-extrabold uppercase transition-all ${bestOf === bo ? 'border-[#c97bff] bg-[#c97bff]/10 text-[#c97bff]' : 'border-border bg-bg-2/40 text-muted-2'}`}
                  >Bo{bo}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
                Games de {iWon ? opponent : (myLogin ?? 'moi')} · gagnant {target}
              </label>
              <div className="flex gap-2">
                {Array.from({ length: target }, (_, g) => (
                  <button key={g} type="button" onClick={() => setLoserGames(g)}
                    className={`flex-1 py-2 rounded-lg border font-mono font-extrabold tabular-nums transition-all ${loserGames === g ? 'border-[#c97bff] bg-[#c97bff]/10 text-[#c97bff]' : 'border-border bg-bg-2/40 text-muted-2'}`}
                  >{g}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">Vies restantes du gagnant</label>
              <div className="flex gap-2">
                {[1, 2, 3].map((s) => (
                  <button key={s} type="button" onClick={() => setWinnerStocks(s)}
                    className={`flex-1 py-2 rounded-lg border font-mono font-extrabold tabular-nums transition-all ${winnerStocks === s ? 'border-[#c97bff] bg-[#c97bff]/10 text-[#c97bff]' : 'border-border bg-bg-2/40 text-muted-2'}`}
                  >{'❤'.repeat(s)}</button>
                ))}
              </div>
            </div>
            <SmashCharPicker label="Ton perso" value={charSelf} onChange={setCharSelf} />
            <SmashCharPicker label={`Perso de ${opponent}`} value={charOpp} onChange={setCharOpp} />
            <div className="px-4 py-3 rounded-xl bg-bg-1/80 border border-border text-center text-sm text-muted-2 shadow-inner">
              <span className={`font-extrabold ${iWon ? 'text-teal' : 'text-text-strong'}`}>{winnerLogin}</span>
              {' gagne '}<span className="font-extrabold text-text-strong font-mono tabular-nums">{target}</span>
              <span className="text-muted mx-1.5 opacity-50">–</span>
              <span className="font-extrabold text-text-strong font-mono tabular-nums">{loserGames}</span>
              {' (Bo'}{bestOf}{')'}
            </div>
            <Button size="md" loading={busy} disabled={!charSelf || !charOpp} onClick={triggerSend} className="w-full py-3.5 text-sm font-bold shadow-lg">Envoyer le score</Button>
          </div>
        )}

        {/* Échecs */}
        {iWon !== null && isChess && (
          <div className="space-y-4">
            <div className="px-4 py-3 rounded-xl bg-bg-1/80 border border-border text-center text-sm text-muted-2 shadow-inner">
              <span className={`font-extrabold ${iWon ? 'text-teal' : 'text-text-strong'}`}>{winnerLogin}</span>
              {' a maté '}
              <span className={`font-extrabold ${iWon ? 'text-text-strong' : 'text-teal'}`}>{loserLogin}</span>
            </div>
            <Button size="md" loading={busy} onClick={triggerSend} className="w-full py-3.5 text-sm font-bold shadow-lg">Envoyer le score</Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
