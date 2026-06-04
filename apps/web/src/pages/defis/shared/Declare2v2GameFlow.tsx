import { useCallback, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { AbacusSlider } from '../../../components/AbacusSlider';
import { OutcomeButton } from '../../../components/OutcomeButton';
import { Button } from '../../../components/Button';
import { api, type LeaderboardEntry, type Declare2v2Response } from '../../../lib/api';
import { useFlash } from '../../../hooks/useFlash';
import { useT } from '../../../lib/i18n';
import { haptic } from '../../../mobile/feedback/useHaptic';
import { PlayerSearch } from './PlayerSearch';

const WINNING_SCORE = 10;
const LOSER_SCORE_MIN = -10;
const LOSER_SCORE_MAX = 9;
const SEND_AWAY_MS = 140;

// ─── Slot "moi" ────────────────────────────────────────────────────────────────

function MeSlot({ login, elo, youLabel }: { login: string; elo?: number; youLabel: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-3 bg-gold/10 border-2 border-gold/40 rounded-xl">
      <div
        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-display font-black text-[#1a1100]"
        style={{ background: 'linear-gradient(135deg, #d4a04a 0%, #8a5e10 50%, #c79122 100%)' }}
      >
        {login[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-extrabold text-gold truncate">{login}</div>
        {elo !== undefined && (
          <div className="text-[10px] text-muted font-mono tabular-nums">{elo} ELO</div>
        )}
      </div>
      <span className="text-[9px] font-extrabold uppercase tracking-wider text-gold/60">{youLabel}</span>
    </div>
  );
}

// ─── Step indicator ────────────────────────────────────────────────────────────

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 ${
          done
            ? 'bg-teal text-[#0a1a14]'
            : active
              ? 'bg-gold text-[#1a1100] shadow-[0_0_10px_rgba(255,201,74,0.5)]'
              : 'bg-bg-3 border border-border'
        }`}
      >
        {done ? (
          <Check className="w-3 h-3" strokeWidth={3} />
        ) : (
          <span className="text-[9px] font-black">{active ? '●' : '○'}</span>
        )}
      </div>
      <span
        className={`text-[8px] font-extrabold uppercase tracking-wider transition-colors duration-300 ${
          done ? 'text-teal' : active ? 'text-gold' : 'text-muted'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-start justify-center gap-4 pb-4 mb-1">
      <StepDot active={step === 1} done={step > 1} label="Joueurs" />
      <div className="mt-3 flex-1 h-px bg-border/60 max-w-[40px]" />
      <StepDot active={step === 2} done={step > 2} label="Résultat" />
      <div className="mt-3 flex-1 h-px bg-border/60 max-w-[40px]" />
      <StepDot active={step === 3} done={false} label="Score" />
    </div>
  );
}

// ─── Label de section ──────────────────────────────────────────────────────────

function SectionLabel({
  children,
  color = 'gold',
}: {
  children: React.ReactNode;
  color?: 'gold' | 'red';
}) {
  return (
    <div
      className={`text-[10px] font-extrabold uppercase tracking-[0.18em] mb-2 ${
        color === 'gold' ? 'text-gold' : 'text-red'
      }`}
    >
      {children}
    </div>
  );
}

// ─── Étiquette "prochain slot" ─────────────────────────────────────────────────

function NextHint({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      className="mb-1.5 flex items-center gap-1.5"
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
      <span className="text-[9px] font-extrabold uppercase tracking-wider text-gold/80">
        {text}
      </span>
    </motion.div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Declare2v2GameFlowProps {
  others: LeaderboardEntry[];
  recentOpponents: LeaderboardEntry[];
  opponentCounts: Record<string, number>;
  myLogin: string | undefined;
  myElo?: number;
  locations?: Map<string, string>;
  /** Appelé après un POST réussi avec les infos de l'équipe et le login du partenaire. */
  onSubmitted: (result: Declare2v2Response, partnerLogin: string) => Promise<void> | void;
  variant?: 'desktop' | 'mobile';
}

// ─── Framer Motion variants partagés ──────────────────────────────────────────

const PHASE_ENTER = {
  initial: { opacity: 0, y: -12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
} as const;

/**
 * Flow de déclaration d'une game 2v2 Babyfoot.
 *
 * Trois phases :
 *   1. Sélection des 4 joueurs (moi + partenaire | 2 adversaires)
 *   2. Résultat (gagné / perdu)
 *   3. Score du perdant (AbacusSlider)
 *
 * Strictement Babyfoot — ne gère aucun autre jeu.
 */
export function Declare2v2GameFlow({
  others,
  recentOpponents,
  opponentCounts,
  myLogin,
  myElo,
  locations,
  onSubmitted,
  variant = 'desktop',
}: Declare2v2GameFlowProps) {
  const flash = useFlash();
  const t = useT();

  const [partner, setPartner] = useState<LeaderboardEntry | null>(null);
  const [opponent1, setOpponent1] = useState<LeaderboardEntry | null>(null);
  const [opponent2, setOpponent2] = useState<LeaderboardEntry | null>(null);
  const [iWon, setIWon] = useState<boolean | null>(null);
  const [loserScore, setLoserScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  // Refs pour auto-scroll à chaque nouvelle phase.
  const outcomeRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);

  // Pools filtrés — chaque picker exclut les joueurs déjà choisis + moi.
  const excluded = useMemo(
    () =>
      new Set(
        [myLogin ?? '', partner?.login ?? '', opponent1?.login ?? '', opponent2?.login ?? ''].filter(
          Boolean,
        ),
      ),
    [myLogin, partner, opponent1, opponent2],
  );

  const partnerPool = useMemo(
    () =>
      others.filter(
        (p) =>
          p.login !== (myLogin ?? '') &&
          p.login !== opponent1?.login &&
          p.login !== opponent2?.login,
      ),
    [others, myLogin, opponent1, opponent2],
  );
  const opp1Pool = useMemo(
    () =>
      others.filter(
        (p) =>
          p.login !== (myLogin ?? '') &&
          p.login !== partner?.login &&
          p.login !== opponent2?.login,
      ),
    [others, myLogin, partner, opponent2],
  );
  const opp2Pool = useMemo(
    () =>
      others.filter(
        (p) =>
          p.login !== (myLogin ?? '') &&
          p.login !== partner?.login &&
          p.login !== opponent1?.login,
      ),
    [others, myLogin, partner, opponent1],
  );

  const recentPool = useMemo(
    () => recentOpponents.filter((p) => !excluded.has(p.login)),
    [recentOpponents, excluded],
  );

  const allSelected = !!partner && !!opponent1 && !!opponent2;

  // Prochain slot vide → étiquette d'accompagnement
  const nextEmpty = !partner ? 'partner' : !opponent1 ? 'opp1' : !opponent2 ? 'opp2' : null;

  // Étape courante pour le step indicator
  const step: 1 | 2 | 3 = !allSelected ? 1 : iWon === null ? 2 : 3;

  const winnerLabel = iWon
    ? t('defis.myTeamPlain')
    : `${opponent1?.login ?? ''} & ${opponent2?.login ?? ''}`;
  const loserLabel = iWon
    ? `${opponent1?.login ?? ''} & ${opponent2?.login ?? ''}`
    : t('defis.myTeamPlain');

  const handleOutcome = (won: boolean) => {
    haptic(won ? 'success' : 'warning');
    setIWon(won);
    setLoserScore(0);
  };

  const handleSubmit = useCallback(async () => {
    if (!partner || !opponent1 || !opponent2 || iWon === null) return;
    setBusy(true);
    try {
      const scoreSelf = iWon ? WINNING_SCORE : loserScore;
      const scoreOpponent = iWon ? loserScore : WINNING_SCORE;
      const result = await api.declare2v2Match({
        partnerLogin: partner.login,
        opponentLogin: opponent1.login,
        opponent2Login: opponent2.login,
        scoreSelf,
        scoreOpponent,
      });
      flash.show(t('defis.game2v2Declared'));
      haptic('success');
      await onSubmitted(result, partner.login);
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
      haptic('error');
    } finally {
      setBusy(false);
      setSending(false);
    }
  }, [partner, opponent1, opponent2, iWon, loserScore, flash, onSubmitted, t]);

  const triggerSend = () => {
    setSending(true);
    haptic('medium');
    window.setTimeout(handleSubmit, SEND_AWAY_MS);
  };

  // ── Scroll helpers ──────────────────────────────────────────────────────────
  // Appelés depuis onAnimationComplete des phases 2 & 3 → l'élément est déjà
  // à sa position finale, le scroll est précis.
  const scrollToOutcome = useCallback(() => {
    outcomeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const scrollToScore = useCallback(() => {
    scoreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="relative">
      {/* Gold flash overlay */}
      <AnimatePresence>
        {sending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0] }}
            transition={{ duration: 0.4, times: [0, 0.2, 1] }}
            className="absolute inset-0 rounded-xl pointer-events-none z-30"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(255,83,102,0.3) 0%, transparent 70%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* initial={false} : pas d'animation à l'entrée — seul l'état "sending" anime */}
      <motion.div
        className="flex flex-col gap-5"
        initial={false}
        animate={
          sending
            ? { opacity: 0, y: -36, scale: 0.94, filter: 'blur(5px)' }
            : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }
        }
        transition={
          sending
            ? { duration: 0.32, ease: [0.55, 0, 1, 0.45] }
            : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }
        }
        style={{ pointerEvents: sending ? 'none' : undefined }}
      >
        {/* ── Indicateur d'étape ── */}
        <StepIndicator step={step} />

        {/* ── Phase 1 : Sélection des 4 joueurs ────────────────────────── */}
        <div
          className="rounded-2xl border border-gold/25 p-4 space-y-3"
          style={{ background: 'rgba(255,201,74,0.04)' }}
        >
          <SectionLabel color="gold">{t('defis.myTeam')}</SectionLabel>

          {myLogin && <MeSlot login={myLogin} elo={myElo} youLabel={t('defis.you')} />}

          <div className="relative z-30">
            {nextEmpty === 'partner' && <NextHint text="Commence ici — choisis ton partenaire" />}
            <label className="block text-[9px] font-bold text-muted uppercase tracking-wider mb-1.5">
              {t('defis.myTeammate')}
            </label>
            <div
              className={`rounded-xl transition-all duration-300 ${
                nextEmpty === 'partner'
                  ? 'ring-2 ring-gold/60 ring-offset-1 ring-offset-bg-1'
                  : ''
              }`}
            >
              <PlayerSearch
                variant={variant}
                players={partnerPool}
                recentPlayers={recentPool}
                opponentCounts={opponentCounts}
                selected={partner}
                onSelect={setPartner}
                onClear={() => {
                  setPartner(null);
                  setIWon(null);
                }}
                locations={locations}
              />
            </div>
          </div>
        </div>

        {/* VS divider */}
        <div className="flex items-center gap-3 -my-1">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-red/40 to-red/40" />
          <span className="font-gaming text-xs font-extrabold text-red/80 uppercase tracking-widest px-1">
            VS
          </span>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent via-red/40 to-red/40" />
        </div>

        <div
          className="rounded-2xl border border-red/25 p-4 space-y-3"
          style={{ background: 'rgba(255,83,102,0.04)' }}
        >
          <SectionLabel color="red">{t('defis.opponentTeam')}</SectionLabel>

          <div className="relative z-20">
            {nextEmpty === 'opp1' && <NextHint text="Adversaire 1 — qui jouait en face ?" />}
            <label className="block text-[9px] font-bold text-muted uppercase tracking-wider mb-1.5">
              {t('defis.opponent1')}
            </label>
            <div
              className={`rounded-xl transition-all duration-300 ${
                nextEmpty === 'opp1'
                  ? 'ring-2 ring-red/60 ring-offset-1 ring-offset-bg-1'
                  : ''
              }`}
            >
              <PlayerSearch
                variant={variant}
                players={opp1Pool}
                recentPlayers={recentPool}
                opponentCounts={opponentCounts}
                selected={opponent1}
                onSelect={setOpponent1}
                onClear={() => {
                  setOpponent1(null);
                  setIWon(null);
                }}
                locations={locations}
              />
            </div>
          </div>

          <div className="relative z-10">
            {nextEmpty === 'opp2' && <NextHint text="Dernier joueur — et le quatrième ?" />}
            <label className="block text-[9px] font-bold text-muted uppercase tracking-wider mb-1.5">
              {t('defis.opponent2')}
            </label>
            <div
              className={`rounded-xl transition-all duration-300 ${
                nextEmpty === 'opp2'
                  ? 'ring-2 ring-red/60 ring-offset-1 ring-offset-bg-1'
                  : ''
              }`}
            >
              <PlayerSearch
                variant={variant}
                players={opp2Pool}
                recentPlayers={recentPool}
                opponentCounts={opponentCounts}
                selected={opponent2}
                onSelect={setOpponent2}
                onClear={() => {
                  setOpponent2(null);
                  setIWon(null);
                }}
                locations={locations}
              />
            </div>
          </div>
        </div>

        {/* ── Phase 2 : Résultat ──────────────────────────────────────── */}
        {/*
          motion.div au lieu de div + animate-slide-down → compatible avec le
          `layout` du parent HeroCTACard (pas de conflit de transform CSS).
          onAnimationComplete déclenche le scroll une fois l'animation terminée.
        */}
        <AnimatePresence mode="wait">
          {allSelected && iWon === null && (
            <motion.div
              key="outcome-buttons"
              ref={outcomeRef}
              {...PHASE_ENTER}
              onAnimationComplete={scrollToOutcome}
            >
              <label className="block text-[10px] uppercase tracking-wider text-gold font-extrabold mb-1 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                {t('defis.result')} — qui a gagné ?
              </label>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <OutcomeButton kind="win" onClick={() => handleOutcome(true)}>
                  {t('defis.myTeamWon')}
                </OutcomeButton>
                <OutcomeButton kind="loss" onClick={() => handleOutcome(false)}>
                  {t('defis.myTeamLost')}
                </OutcomeButton>
              </div>
            </motion.div>
          )}

          {allSelected && iWon !== null && (
            <motion.div
              key="outcome-badge"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
                {t('defis.result')}
              </label>
              <button
                type="button"
                onClick={() => setIWon(null)}
                aria-label={t('defis.editResult')}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all tap-transparent active:scale-[0.98] ${
                  iWon
                    ? 'border-teal/40 bg-teal/10 text-teal hover:bg-teal/20'
                    : 'border-red/40 bg-red/10 text-red hover:bg-red/20'
                }`}
              >
                <span className="text-sm font-extrabold tracking-wide">
                  {iWon ? t('defis.myTeamWon') : t('defis.myTeamLost')}
                </span>
                <span className="text-muted-2 text-lg leading-none">×</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Phase 3 : Score ─────────────────────────────────────────── */}
        <AnimatePresence>
          {allSelected && iWon !== null && (
            <motion.div
              key="score"
              ref={scoreRef}
              {...PHASE_ENTER}
              onAnimationComplete={scrollToScore}
              className="space-y-5"
            >
              {/* Affichage score en direct */}
              <div className="flex items-stretch gap-2">
                {[
                  { label: winnerLabel, score: WINNING_SCORE, isWinner: true },
                  { label: loserLabel, score: loserScore, isWinner: false },
                ].map(({ label, score, isWinner }) => (
                  <div
                    key={label}
                    className={`flex-1 rounded-2xl flex flex-col items-center justify-center py-4 gap-1 ${
                      isWinner
                        ? 'bg-gradient-to-b from-gold/15 to-gold/5 border border-gold/40'
                        : loserScore < 0
                          ? 'bg-red/[0.07] border border-red/30'
                          : 'bg-bg-2/60 border border-border/60'
                    }`}
                  >
                    <span className="text-[9px] uppercase tracking-[0.18em] font-extrabold text-muted truncate max-w-full px-2 text-center leading-tight">
                      {label}
                    </span>
                    <span
                      className={`font-display text-5xl font-black tabular-nums leading-none ${
                        isWinner
                          ? 'text-gold'
                          : loserScore < 0
                            ? 'text-red'
                            : 'text-text-strong'
                      }`}
                      style={
                        isWinner ? { textShadow: '0 0 24px rgba(255,201,74,0.45)' } : undefined
                      }
                    >
                      {score}
                    </span>
                    {isWinner && (
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-gold/60">
                        {t('defis.locked')}
                      </span>
                    )}
                    {!isWinner && (
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-2">
                        {t('defis.slideHint')}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <AbacusSlider
                value={loserScore}
                onChange={setLoserScore}
                min={LOSER_SCORE_MIN}
                max={LOSER_SCORE_MAX}
              />

              {/* Récap lisible avant envoi */}
              <div
                className="px-4 py-3.5 rounded-2xl border text-center leading-relaxed shadow-inner"
                style={{
                  background: iWon ? 'rgba(255,201,74,0.05)' : 'rgba(255,83,102,0.05)',
                  borderColor: iWon
                    ? 'rgba(255,201,74,0.25)'
                    : 'rgba(255,83,102,0.25)',
                }}
              >
                <div className="text-xs">
                  <span
                    className={`font-extrabold ${iWon ? 'text-gold' : 'text-text-strong'}`}
                  >
                    {myLogin ?? 'Toi'}
                  </span>
                  <span className="text-muted-2"> &amp; </span>
                  <span
                    className={`font-extrabold ${iWon ? 'text-gold' : 'text-text-strong'}`}
                  >
                    {partner?.login}
                  </span>
                  <span className="text-muted-2">
                    {' '}
                    {iWon ? 'ont gagné' : 'ont perdu'}{' '}
                  </span>
                  <span
                    className="font-display font-black tabular-nums text-base"
                    style={{ color: iWon ? '#ffc94a' : undefined }}
                  >
                    {iWon ? WINNING_SCORE : loserScore}
                  </span>
                  <span className="text-muted-2 mx-1">–</span>
                  <span
                    className="font-display font-black tabular-nums text-base"
                    style={{ color: !iWon ? '#ffc94a' : undefined }}
                  >
                    {iWon ? loserScore : WINNING_SCORE}
                  </span>
                  <span className="text-muted-2"> face à </span>
                  <span
                    className={`font-extrabold ${!iWon ? 'text-gold' : 'text-text-strong'}`}
                  >
                    {opponent1?.login}
                  </span>
                  <span className="text-muted-2"> &amp; </span>
                  <span
                    className={`font-extrabold ${!iWon ? 'text-gold' : 'text-text-strong'}`}
                  >
                    {opponent2?.login}
                  </span>
                </div>
              </div>

              <Button
                size="md"
                variant="danger"
                loading={busy}
                onClick={triggerSend}
                className="w-full py-3.5 text-sm font-bold shadow-lg"
              >
                {t('defis.send2v2')}
              </Button>

              <p className="text-[10px] text-muted/70 leading-relaxed text-center font-medium">
                {t('defis.others3Confirm')}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
