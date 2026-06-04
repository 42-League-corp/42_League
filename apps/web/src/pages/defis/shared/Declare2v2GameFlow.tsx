import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

// ─── Slot "moi" — plaquette non-interactive ───────────────────────────────────

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

// ─── Silhouettes déco ─────────────────────────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────────

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

  // Refs pour auto-scroll à chaque nouvelle étape visible.
  const outcomeRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);

  // Pools filtrés — chaque picker exclut les joueurs déjà choisis + moi.
  const excluded = useMemo(
    () =>
      new Set([
        myLogin ?? '',
        partner?.login ?? '',
        opponent1?.login ?? '',
        opponent2?.login ?? '',
      ].filter(Boolean)),
    [myLogin, partner, opponent1, opponent2],
  );

  const partnerPool = useMemo(
    () => others.filter((p) => p.login !== (myLogin ?? '') && p.login !== opponent1?.login && p.login !== opponent2?.login),
    [others, myLogin, opponent1, opponent2],
  );
  const opp1Pool = useMemo(
    () => others.filter((p) => p.login !== (myLogin ?? '') && p.login !== partner?.login && p.login !== opponent2?.login),
    [others, myLogin, partner, opponent2],
  );
  const opp2Pool = useMemo(
    () => others.filter((p) => p.login !== (myLogin ?? '') && p.login !== partner?.login && p.login !== opponent1?.login),
    [others, myLogin, partner, opponent1],
  );

  const recentPool = useMemo(
    () => recentOpponents.filter((p) => !excluded.has(p.login)),
    [recentOpponents, excluded],
  );

  const allSelected = !!partner && !!opponent1 && !!opponent2;

  // ── Auto-scroll ──────────────────────────────────────────────────────────────
  // Scroll vers le résultat quand les 4 joueurs sont sélectionnés.
  useEffect(() => {
    if (!allSelected || iWon !== null) return;
    const id = window.setTimeout(() => {
      outcomeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 120); // laisse l'animation slide-down démarrer
    return () => window.clearTimeout(id);
  }, [allSelected, iWon]);

  // Scroll vers le score dès que le résultat est choisi.
  useEffect(() => {
    if (iWon === null) return;
    const id = window.setTimeout(() => {
      scoreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 120);
    return () => window.clearTimeout(id);
  }, [iWon]);

  const winnerLabel = iWon ? t('defis.myTeamPlain') : `${opponent1?.login ?? ''} & ${opponent2?.login ?? ''}`;
  const loserLabel = iWon ? `${opponent1?.login ?? ''} & ${opponent2?.login ?? ''}` : t('defis.myTeamPlain');

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
            style={{ background: 'radial-gradient(ellipse at center, rgba(255,83,102,0.3) 0%, transparent 70%)' }}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="flex flex-col gap-5"
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
        {/* ── Phase 1 : Sélection des 4 joueurs ──────────────────────────── */}
        <div
          className="rounded-2xl border border-gold/25 p-4 space-y-3"
          style={{ background: 'rgba(255,201,74,0.04)' }}
        >
          <SectionLabel color="gold">{t('defis.myTeam')}</SectionLabel>

          {myLogin && <MeSlot login={myLogin} elo={myElo} youLabel={t('defis.you')} />}

          <div className="relative z-30">
            <label className="block text-[9px] font-bold text-muted uppercase tracking-wider mb-1.5">
              {t('defis.myTeammate')}
            </label>
            <PlayerSearch
              variant={variant}
              players={partnerPool}
              recentPlayers={recentPool}
              opponentCounts={opponentCounts}
              selected={partner}
              onSelect={setPartner}
              onClear={() => { setPartner(null); setIWon(null); }}
              locations={locations}
            />
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
            <label className="block text-[9px] font-bold text-muted uppercase tracking-wider mb-1.5">
              {t('defis.opponent1')}
            </label>
            <PlayerSearch
              variant={variant}
              players={opp1Pool}
              recentPlayers={recentPool}
              opponentCounts={opponentCounts}
              selected={opponent1}
              onSelect={setOpponent1}
              onClear={() => { setOpponent1(null); setIWon(null); }}
              locations={locations}
            />
          </div>

          <div className="relative z-10">
            <label className="block text-[9px] font-bold text-muted uppercase tracking-wider mb-1.5">
              {t('defis.opponent2')}
            </label>
            <PlayerSearch
              variant={variant}
              players={opp2Pool}
              recentPlayers={recentPool}
              opponentCounts={opponentCounts}
              selected={opponent2}
              onSelect={setOpponent2}
              onClear={() => { setOpponent2(null); setIWon(null); }}
              locations={locations}
            />
          </div>
        </div>

        {/* ── Phase 2 : Résultat ─────────────────────────────────────────── */}
        {allSelected && iWon === null && (
          <div ref={outcomeRef} className="animate-slide-down">
            <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-3">
              {t('defis.result')}
            </label>
            <div className="grid grid-cols-2 gap-4">
              <OutcomeButton kind="win" onClick={() => handleOutcome(true)}>
                {t('defis.myTeamWon')}
              </OutcomeButton>
              <OutcomeButton kind="loss" onClick={() => handleOutcome(false)}>
                {t('defis.myTeamLost')}
              </OutcomeButton>
            </div>
          </div>
        )}

        {allSelected && iWon !== null && (
          <div className="animate-fade-in">
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
          </div>
        )}

        {/* ── Phase 3 : Score ─────────────────────────────────────────────── */}
        {allSelected && iWon !== null && (
          <div ref={scoreRef} className="animate-slide-down space-y-5">
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
                    style={isWinner ? { textShadow: '0 0 24px rgba(255,201,74,0.45)' } : undefined}
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

            {/* ── Récap lisible avant envoi ────────────────────────────── */}
            <div className="px-4 py-3.5 rounded-2xl border text-center leading-relaxed shadow-inner"
              style={{
                background: iWon ? 'rgba(255,201,74,0.05)' : 'rgba(255,83,102,0.05)',
                borderColor: iWon ? 'rgba(255,201,74,0.25)' : 'rgba(255,83,102,0.25)',
              }}
            >
              {/* Équipe gagnante */}
              <div className="text-xs">
                <span className={`font-extrabold ${iWon ? 'text-gold' : 'text-text-strong'}`}>
                  {myLogin ?? 'Toi'}
                </span>
                <span className="text-muted-2"> &amp; </span>
                <span className={`font-extrabold ${iWon ? 'text-gold' : 'text-text-strong'}`}>
                  {partner?.login}
                </span>
                <span className="text-muted-2"> {iWon ? 'ont gagné' : 'ont perdu'} </span>
                {/* Score */}
                <span className="font-display font-black tabular-nums text-base"
                  style={{ color: iWon ? '#ffc94a' : undefined }}
                >
                  {iWon ? WINNING_SCORE : loserScore}
                </span>
                <span className="text-muted-2 mx-1">–</span>
                <span className="font-display font-black tabular-nums text-base"
                  style={{ color: !iWon ? '#ffc94a' : undefined }}
                >
                  {iWon ? loserScore : WINNING_SCORE}
                </span>
                <span className="text-muted-2"> face à </span>
                <span className={`font-extrabold ${!iWon ? 'text-gold' : 'text-text-strong'}`}>
                  {opponent1?.login}
                </span>
                <span className="text-muted-2"> &amp; </span>
                <span className={`font-extrabold ${!iWon ? 'text-gold' : 'text-text-strong'}`}>
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
          </div>
        )}
      </motion.div>
    </div>
  );
}
