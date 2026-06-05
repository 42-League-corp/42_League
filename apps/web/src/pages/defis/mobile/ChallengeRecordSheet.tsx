import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomSheet } from '../../../mobile/primitives/BottomSheet';
import { AbacusSlider } from '../../../components/AbacusSlider';
import { OutcomeButton } from '../../../components/OutcomeButton';
import { SmashCharIcon } from '../../../components/SmashCharIcon';
import { SfCharIcon } from '../../../components/SfCharIcon';
import { Button } from '../../../components/Button';
import { api, type Challenge } from '../../../lib/api';
import { useLeagueData } from '../../../hooks/useLeagueData';
import { useFlash } from '../../../hooks/useFlash';
import { useT } from '../../../lib/i18n';
import { SMASH_ROSTER } from '../../../lib/smash';
import { SF_ROSTER } from '../../../lib/sf';
import { haptic } from '../../../mobile/feedback/useHaptic';
import { mostPlayedChars } from '../../../lib/chars';
import { CharPicker, PerGameCharsEditor, type PerGameChars } from '../shared/CharPicker';

const WINNING_SCORE = 10;
const LOSER_SCORE_MIN = -10;
const LOSER_SCORE_MAX = 9;

function smashTarget(bestOf: 3 | 5) {
  return Math.ceil(bestOf / 2);
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
  const t = useT();
  return (
    <BottomSheet
      open={challenge !== null}
      onClose={onClose}
      title={<span className="gradient-text-brand">{t('defis.enterScoreTitle')}</span>}
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
  const t = useT();
  const { refresh, me, matches } = useLeagueData();
  const flash = useFlash();

  const game = challenge.game ?? 'babyfoot';
  const isSmash = game === 'smash';
  const isSf = game === 'streetfighter';
  // Street Fighter == Smash pour la saisie (set Bo3/Bo5 + 2 persos), mais sans stocks.
  const isSetGame = isSmash || isSf;
  const charRoster = isSf ? SF_ROSTER : SMASH_ROSTER;
  const CharIcon = isSf ? SfCharIcon : SmashCharIcon;
  const myFavorites = (isSf ? me?.user?.favSf : me?.user?.favSmash) ?? [];
  const isChess = game === 'chess';
  const opponent = challenge.challengerLogin === myLogin ? challenge.opponentLogin : challenge.challengerLogin;
  // Persos les plus joués (moi / adversaire) — remontés en tête de la grille.
  const myMostPlayed = useMemo(
    () => (isSetGame ? mostPlayedChars(matches, myLogin, isSf ? 'streetfighter' : 'smash') : []),
    [isSetGame, matches, myLogin, isSf],
  );
  const oppMostPlayed = useMemo(
    () => (isSetGame ? mostPlayedChars(matches, opponent, isSf ? 'streetfighter' : 'smash') : []),
    [isSetGame, matches, opponent, isSf],
  );

  const [iWon, setIWon] = useState<boolean | null>(null);
  const [loserScore, setLoserScore] = useState(0);
  const [bestOf, setBestOf] = useState<3 | 5>(3);
  const [loserGames, setLoserGames] = useState(0);
  const [charSelf, setCharSelf] = useState<string | null>(null);
  const [charOpp, setCharOpp] = useState<string | null>(null);
  const [winnerStocks, setWinnerStocks] = useState(3);
  const [perGameChars, setPerGameChars] = useState<PerGameChars | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  const target = smashTarget(bestOf);
  const totalGames = target + loserGames;

  const handleSubmit = useCallback(async () => {
    if (iWon === null) return;
    setBusy(true);
    try {
      if (isSetGame) {
        if (!charSelf || !charOpp) { flash.show(t('defis.chooseBothChars'), 'error'); setBusy(false); setSending(false); return; }
        // Par défaut un seul perso pour tout le set ; sinon liste encodée par manche.
        const finalSelf = perGameChars ? perGameChars.self || charSelf : charSelf;
        const finalOpp = perGameChars ? perGameChars.opp || charOpp : charOpp;
        await api.recordChallengeResult(challenge.id, {
          scoreSelf: iWon ? target : loserGames,
          scoreOpponent: iWon ? loserGames : target,
          game: isSf ? 'streetfighter' : 'smash', bestOf, charSelf: finalSelf, charOpponent: finalOpp,
          // Les stocks (vies) sont spécifiques au Smash ; SF n'en a pas.
          ...(isSmash ? { stocks: winnerStocks } : {}),
        });
      } else if (isChess) {
        await api.recordChallengeResult(challenge.id, { scoreSelf: iWon ? 1 : 0, scoreOpponent: iWon ? 0 : 1, game: 'chess' });
      } else {
        await api.recordChallengeResult(challenge.id, {
          scoreSelf: iWon ? WINNING_SCORE : loserScore,
          scoreOpponent: iWon ? loserScore : WINNING_SCORE,
        });
      }
      flash.show(`${t('defis.scoreSentPrefix')} ${opponent} ${t('defis.scoreSentMustConfirm')}`);
      haptic('success');
      await refresh();
      await onDone();
      onClose();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
      haptic('error');
    } finally { setBusy(false); setSending(false); }
  }, [iWon, isSetGame, isSmash, isSf, isChess, charSelf, charOpp, perGameChars, target, loserGames, bestOf, winnerStocks, loserScore, challenge.id, opponent, flash, refresh, onDone, onClose]);

  const triggerSend = () => { setSending(true); haptic('medium'); window.setTimeout(handleSubmit, 140); };

  const winnerLogin = iWon ? (myLogin ?? t('defis.me')) : opponent;
  const loserLogin = iWon ? opponent : (myLogin ?? t('defis.me'));

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
          {t('defis.matchAgainst')} <span className="font-extrabold text-text-strong">{opponent}</span>
          {game !== 'babyfoot' && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-bg-2 border border-border">
              {game === 'smash' ? t('game.smash') : game === 'streetfighter' ? t('game.streetfighter') : t('game.chess')}
            </span>
          )}
        </div>

        {/* Résultat */}
        {iWon === null ? (
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-3 text-center">{t('defis.result')}</label>
            <div className="grid grid-cols-2 gap-4">
              <OutcomeButton kind="win" onClick={() => { setIWon(true); haptic('success'); }}>{t('defis.iWon')}</OutcomeButton>
              <OutcomeButton kind="loss" onClick={() => { setIWon(false); haptic('warning'); }}>{t('defis.iLost')}</OutcomeButton>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setIWon(null)}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all ${iWon ? 'border-teal/40 bg-teal/10 text-teal' : 'border-red/40 bg-red/10 text-red'}`}
          >
            <span className="text-sm font-extrabold">{iWon ? t('defis.iWon') : t('defis.iLost')}</span>
            <span className="text-muted-2 text-lg">×</span>
          </button>
        )}

        {/* Babyfoot */}
        {iWon !== null && !isSetGame && !isChess && (
          <div className="space-y-4">
            <label className="block text-[10px] uppercase tracking-wider text-muted font-bold text-center">
              {t('defis.scoreOf')} {iWon ? opponent : (myLogin ?? t('defis.me'))}
            </label>
            <AbacusSlider value={loserScore} onChange={setLoserScore} min={LOSER_SCORE_MIN} max={LOSER_SCORE_MAX} />
            <div className="px-4 py-3 rounded-xl bg-bg-1/80 border border-border text-center text-sm text-muted-2 shadow-inner">
              <span className={`font-extrabold ${iWon ? 'text-teal' : 'text-text-strong'}`}>{winnerLogin}</span>
              {' '}{t('defis.wonScore')}{' '}
              <span className="font-extrabold text-text-strong font-mono tabular-nums">{WINNING_SCORE}</span>
              <span className="text-muted mx-2 opacity-50">/</span>
              <span className={`font-extrabold font-mono tabular-nums ${loserScore < 0 ? 'text-red' : 'text-text-strong'}`}>{loserScore}</span>
              {' '}{t('defis.against')}{' '}
              <span className={`font-extrabold ${iWon ? 'text-text-strong' : 'text-teal'}`}>{loserLogin}</span>
            </div>
            <Button size="md" loading={busy} onClick={triggerSend} className="w-full py-3.5 text-sm font-bold shadow-lg">{t('defis.sendScore')}</Button>
          </div>
        )}

        {/* Set (Smash / Street Fighter) */}
        {iWon !== null && isSetGame && (
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">{t('defis.format')}</label>
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
                {t('defis.gamesOf')} {iWon ? opponent : (myLogin ?? t('defis.me'))} · {t('defis.winnerTarget')} {target}
              </label>
              <div className="flex gap-2">
                {Array.from({ length: target }, (_, g) => (
                  <button key={g} type="button" onClick={() => setLoserGames(g)}
                    className={`flex-1 py-2 rounded-lg border font-mono font-extrabold tabular-nums transition-all ${loserGames === g ? 'border-[#c97bff] bg-[#c97bff]/10 text-[#c97bff]' : 'border-border bg-bg-2/40 text-muted-2'}`}
                  >{g}</button>
                ))}
              </div>
            </div>
            {isSmash && (
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">{t('defis.winnerStocksShort')}</label>
                <div className="flex gap-2">
                  {[1, 2, 3].map((s) => (
                    <button key={s} type="button" onClick={() => setWinnerStocks(s)}
                      className={`flex-1 py-2 rounded-lg border font-mono font-extrabold tabular-nums transition-all ${winnerStocks === s ? 'border-[#c97bff] bg-[#c97bff]/10 text-[#c97bff]' : 'border-border bg-bg-2/40 text-muted-2'}`}
                    >{'❤'.repeat(s)}</button>
                  ))}
                </div>
              </div>
            )}
            <CharPicker label={t('defis.yourChar')} value={charSelf} onChange={setCharSelf} roster={charRoster} Icon={CharIcon} favorites={myFavorites} favoritesLabel={t('favorites.label')} mostPlayed={myMostPlayed} />
            <CharPicker label={`${t('defis.charOf')} ${opponent}`} value={charOpp} onChange={setCharOpp} roster={charRoster} Icon={CharIcon} mostPlayed={oppMostPlayed} />
            <PerGameCharsEditor
              totalGames={totalGames}
              defaultSelf={charSelf}
              defaultOpp={charOpp}
              roster={charRoster}
              Icon={CharIcon}
              myFavorites={myFavorites}
              myMostPlayed={myMostPlayed}
              oppMostPlayed={oppMostPlayed}
              oppLabel={opponent}
              onChange={setPerGameChars}
            />
            <div className="px-4 py-3 rounded-xl bg-bg-1/80 border border-border text-center text-sm text-muted-2 shadow-inner">
              <span className={`font-extrabold ${iWon ? 'text-teal' : 'text-text-strong'}`}>{winnerLogin}</span>
              {' '}{t('defis.winsShort')}{' '}<span className="font-extrabold text-text-strong font-mono tabular-nums">{target}</span>
              <span className="text-muted mx-1.5 opacity-50">–</span>
              <span className="font-extrabold text-text-strong font-mono tabular-nums">{loserGames}</span>
              {' (Bo'}{bestOf}{')'}
            </div>
            <Button size="md" loading={busy} disabled={!charSelf || !charOpp} onClick={triggerSend} className="w-full py-3.5 text-sm font-bold shadow-lg">{t('defis.sendScore')}</Button>
          </div>
        )}

        {/* Échecs */}
        {iWon !== null && isChess && (
          <div className="space-y-4">
            <div className="px-4 py-3 rounded-xl bg-bg-1/80 border border-border text-center text-sm text-muted-2 shadow-inner">
              <span className={`font-extrabold ${iWon ? 'text-teal' : 'text-text-strong'}`}>{winnerLogin}</span>
              {' '}{t('defis.checkmated')}{' '}
              <span className={`font-extrabold ${iWon ? 'text-text-strong' : 'text-teal'}`}>{loserLogin}</span>
            </div>
            <Button size="md" loading={busy} onClick={triggerSend} className="w-full py-3.5 text-sm font-bold shadow-lg">{t('defis.sendScore')}</Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
