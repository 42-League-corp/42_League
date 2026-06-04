import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AbacusSlider } from '../../../components/AbacusSlider';
import { OutcomeButton } from '../../../components/OutcomeButton';
import { Button } from '../../../components/Button';
import { SmashCharIcon } from '../../../components/SmashCharIcon';
import { SfCharIcon } from '../../../components/SfCharIcon';
import { api, type LeaderboardEntry, type Game } from '../../../lib/api';
import { useFlash } from '../../../hooks/useFlash';
import { useGameMode } from '../../../hooks/useGameMode';
import { useT } from '../../../lib/i18n';
import { SMASH_ROSTER } from '../../../lib/smash';
import { SF_ROSTER } from '../../../lib/sf';
import { haptic } from '../../../mobile/feedback/useHaptic';
import { PlayerSearch } from './PlayerSearch';

export const WINNING_SCORE = 10;
export const LOSER_SCORE_MIN = -10;
export const LOSER_SCORE_MAX = WINNING_SCORE - 1;

const smashTargetOf = (bestOf: number) => Math.ceil(bestOf / 2);

/** Grille de sélection d'un personnage (Smash ou Street Fighter selon le roster). */
function CharPicker({
  label,
  value,
  onChange,
  roster,
  Icon,
}: {
  label: string;
  value: string | null;
  onChange: (id: string) => void;
  roster: { id: string; name: string }[];
  Icon: typeof SmashCharIcon;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">{label}</label>
      <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-h-44 overflow-y-auto scrollbar-none p-1 rounded-lg bg-bg-1/50 border border-border/50">
        {roster.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            title={c.name}
            className={`rounded-lg transition-all ${
              value === c.id
                ? 'ring-2 ring-[#c97bff] scale-105'
                : 'opacity-75 hover:opacity-100 ring-1 ring-transparent'
            }`}
          >
            <Icon id={c.id} size={40} className="w-full aspect-square" />
          </button>
        ))}
      </div>
    </div>
  );
}

const SEND_AWAY_ANIM_MS = 140;

interface DeclareGameFlowProps {
  others: LeaderboardEntry[];
  recentOpponents: LeaderboardEntry[];
  opponentCounts: Record<string, number>;
  myLogin: string | undefined;
  locations?: Map<string, string>;
  /** Appelé après un POST réussi. Doit refresh les data + (optionnel) fermer le container. */
  onSubmitted: () => Promise<void> | void;
  /** Mode visuel — change l'autofocus + la taille des inputs. */
  variant?: 'desktop' | 'mobile';
  /**
   * Force un mode de jeu (override le mode global). Utilisé quand on enregistre
   * le résultat d'un défi : le jeu est celui du défi, pas le mode sélectionné.
   */
  gameOverride?: Game;
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
  locations,
  onSubmitted,
  variant = 'desktop',
  gameOverride,
}: DeclareGameFlowProps) {
  const flash = useFlash();
  const t = useT();
  const { game: globalGame } = useGameMode();
  const game = gameOverride ?? globalGame;
  const isSmash = game === 'smash';
  const isSf = game === 'streetfighter';
  // Street Fighter == Smash pour la saisie (set Bo3/Bo5 + 2 persos), mais sans stocks.
  const isSetGame = isSmash || isSf;
  const charRoster = isSf ? SF_ROSTER : SMASH_ROSTER;
  const CharIcon = isSf ? SfCharIcon : SmashCharIcon;
  const isChess = game === 'chess';
  const [opponent, setOpponent] = useState<LeaderboardEntry | null>(null);
  const [iWon, setIWon] = useState<boolean | null>(null);
  const [loserScore, setLoserScore] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  // Smash : format + games du perdant + persos + vies restantes du gagnant.
  const [bestOf, setBestOf] = useState<3 | 5>(3);
  const [loserGames, setLoserGames] = useState(0);
  const [charSelf, setCharSelf] = useState<string | null>(null);
  const [charOpp, setCharOpp] = useState<string | null>(null);
  const [winnerStocks, setWinnerStocks] = useState(3);

  const target = smashTargetOf(bestOf);

  const handleOutcome = (won: boolean) => {
    haptic(won ? 'success' : 'warning');
    setIWon(won);
    setLoserScore(0);
    setLoserGames(0);
  };

  const smashReady = !isSetGame || (!!charSelf && !!charOpp);

  const handleSubmit = useCallback(async () => {
    if (!opponent || iWon === null) return;
    setBusy(true);
    try {
      if (isSetGame) {
        if (!charSelf || !charOpp) {
          flash.show(t('defis.chooseBothChars'), 'error');
          setBusy(false);
          setSending(false);
          return;
        }
        const myGames = iWon ? target : loserGames;
        const oppGames = iWon ? loserGames : target;
        await api.declareMatch({
          opponentLogin: opponent.login,
          scoreSelf: myGames,
          scoreOpponent: oppGames,
          game: isSf ? 'streetfighter' : 'smash',
          bestOf,
          charSelf,
          charOpponent: charOpp,
          // Les stocks (vies) sont spécifiques au Smash ; SF n'en a pas.
          ...(isSmash ? { stocks: winnerStocks } : {}),
        });
      } else if (isChess) {
        // Échecs : résultat binaire 1-0.
        await api.declareMatch({
          opponentLogin: opponent.login,
          scoreSelf: iWon ? 1 : 0,
          scoreOpponent: iWon ? 0 : 1,
          game: 'chess',
        });
      } else {
        const scoreSelf = iWon ? WINNING_SCORE : loserScore;
        const scoreOpponent = iWon ? loserScore : WINNING_SCORE;
        await api.declareMatch({ opponentLogin: opponent.login, scoreSelf, scoreOpponent });
      }
      flash.show(`${t('defis.gameDeclared')} ${opponent.login} ${t('defis.mustConfirmShort')}`);
      haptic('success');
      await onSubmitted();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
      haptic('error');
    } finally {
      setBusy(false);
      setSending(false);
    }
  }, [opponent, iWon, loserScore, isSetGame, isSmash, isSf, isChess, charSelf, charOpp, target, loserGames, bestOf, winnerStocks, flash, onSubmitted, t]);

  const triggerSend = () => {
    setSending(true);
    haptic('medium');
    window.setTimeout(handleSubmit, SEND_AWAY_ANIM_MS);
  };

  const winnerLogin = iWon ? (myLogin ?? 'Moi') : (opponent?.login ?? '');
  const loserLogin = iWon ? (opponent?.login ?? '') : (myLogin ?? 'Moi');

  return (
    <div className="relative">
      {/* Gold flash overlay on send */}
      <AnimatePresence>
        {sending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0] }}
            transition={{ duration: 0.4, times: [0, 0.2, 1] }}
            className="absolute inset-0 rounded-xl pointer-events-none z-30"
            style={{ background: 'radial-gradient(ellipse at center, rgba(255,201,74,0.35) 0%, transparent 70%)' }}
          />
        )}
      </AnimatePresence>
    <motion.div
      className="flex flex-col"
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
      <div className="relative z-20">
        <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
          {t('defis.opponent')}
        </label>
        <PlayerSearch
          variant={variant}
          players={others}
          recentPlayers={recentOpponents}
          opponentCounts={opponentCounts}
          selected={opponent}
          onSelect={setOpponent}
          onClear={() => { setOpponent(null); setIWon(null); }}
          locations={locations}
        />
      </div>

      {opponent && iWon === null && (
        <div className="relative mt-6 animate-slide-down">
          <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-3">
            {t('defis.result')}
          </label>
          <div className="grid grid-cols-2 gap-4">
            <OutcomeButton kind="win" onClick={() => handleOutcome(true)}>{t('defis.iWon')}</OutcomeButton>
            <OutcomeButton kind="loss" onClick={() => handleOutcome(false)}>{t('defis.iLost')}</OutcomeButton>
          </div>
        </div>
      )}

      {opponent && iWon !== null && (
        <div className="relative mt-6 animate-fade-in">
          <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
            {t('defis.result')}
          </label>
          <button
            type="button"
            onClick={() => setIWon(null)}
            aria-label={t('defis.editResult')}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all shadow-sm hover:shadow-md tap-transparent active:scale-[0.98] ${
              iWon
                ? 'border-teal/40 bg-teal/10 text-teal hover:bg-teal/20'
                : 'border-red/40 bg-red/10 text-red hover:bg-red/20'
            }`}
          >
            <span className="text-sm font-extrabold tracking-wide">
              {variant === 'mobile'
                ? iWon
                  ? t('defis.iWon')
                  : t('defis.iLost')
                : iWon
                  ? t('defis.iWonTrophy')
                  : t('defis.iLostSkull')}
            </span>
            <span className="text-muted-2 text-lg leading-none">×</span>
          </button>
        </div>
      )}

      {opponent && iWon !== null && game === 'babyfoot' && (
        <div className="relative mt-6 animate-slide-down">

          {/* ── Affichage du score en direct ───────────────────────────────── */}
          {/* Les deux camps côte à côte : le gagnant (10 verrouillé en or) et
              le perdant (valeur live du slider). Rend immédiatement lisible QUI
              marque quoi — plus de confusion "je glisse mon score ou le sien". */}
          <div className="flex items-stretch gap-2 mb-6">
            {/* Gagnant (côté gauche si iWon, droite sinon) */}
            {[
              { login: winnerLogin, score: WINNING_SCORE, isWinner: true },
              { login: loserLogin, score: loserScore, isWinner: false },
            ].map(({ login, score, isWinner }) => (
              <div
                key={login}
                className={`flex-1 rounded-2xl flex flex-col items-center justify-center py-4 gap-1 ${
                  isWinner
                    ? 'bg-gradient-to-b from-gold/15 to-gold/5 border border-gold/40'
                    : loserScore < 0
                      ? 'bg-red/[0.07] border border-red/30'
                      : 'bg-bg-2/60 border border-border/60'
                }`}
              >
                <span className="text-[10px] uppercase tracking-[0.18em] font-extrabold text-muted truncate max-w-full px-2">
                  {login === (myLogin ?? 'Moi') ? t('defis.you') : login}
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
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-gold/60">{t('defis.locked')}</span>
                )}
                {!isWinner && (
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-2">{t('defis.slideHint')}</span>
                )}
              </div>
            ))}
          </div>

          {/* Abaque */}
          <AbacusSlider
            value={loserScore}
            onChange={setLoserScore}
            min={LOSER_SCORE_MIN}
            max={LOSER_SCORE_MAX}
          />

          <div className="mt-5">
            <Button size="md" loading={busy} onClick={triggerSend} className="w-full py-3.5 text-sm font-bold shadow-lg">
              {t('defis.sendDeclaration')}
            </Button>
          </div>

          <p className="mt-3 text-[10px] text-muted/70 leading-relaxed text-center font-medium">
            {opponent.login} {t('defis.mustConfirmScore')}
          </p>
        </div>
      )}

      {/* ─── Variante SET (Smash / Street Fighter) : format, games, persos ──── */}
      {opponent && iWon !== null && isSetGame && (
        <div className="relative mt-6 animate-slide-down space-y-5">
          {/* Format */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">{t('defis.format')}</label>
            <div className="grid grid-cols-2 gap-2">
              {([3, 5] as const).map((bo) => (
                <button
                  key={bo}
                  type="button"
                  onClick={() => {
                    setBestOf(bo);
                    setLoserGames((g) => Math.min(g, smashTargetOf(bo) - 1));
                  }}
                  className={`py-2.5 rounded-xl border-2 text-sm font-extrabold uppercase tracking-wide transition-all ${
                    bestOf === bo
                      ? 'border-[#c97bff] bg-[#c97bff]/10 text-[#c97bff]'
                      : 'border-border bg-bg-2/40 text-muted-2'
                  }`}
                >
                  Bo{bo}
                </button>
              ))}
            </div>
          </div>

          {/* Games du perdant (le gagnant atteint la cible) */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
              {t('defis.gamesOf')} {iWon ? opponent.login : (myLogin ?? t('defis.me'))} {t('defis.loserSuffix')} · {t('defis.winnerTarget')} {target}
            </label>
            <div className="flex gap-2">
              {Array.from({ length: target }, (_, g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setLoserGames(g)}
                  className={`flex-1 py-2 rounded-lg border font-mono font-extrabold tabular-nums transition-all ${
                    loserGames === g
                      ? 'border-[#c97bff] bg-[#c97bff]/10 text-[#c97bff]'
                      : 'border-border bg-bg-2/40 text-muted-2'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Vies (stocks) restantes du gagnant au game décisif — Smash uniquement */}
          {isSmash && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
                {t('defis.winnerStocks')}
              </label>
              <div className="flex gap-2">
                {[1, 2, 3].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setWinnerStocks(s)}
                    className={`flex-1 py-2 rounded-lg border font-mono font-extrabold tabular-nums transition-all ${
                      winnerStocks === s
                        ? 'border-[#c97bff] bg-[#c97bff]/10 text-[#c97bff]'
                        : 'border-border bg-bg-2/40 text-muted-2'
                    }`}
                  >
                    {'❤'.repeat(s)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Persos */}
          <CharPicker label={t('defis.yourChar')} value={charSelf} onChange={setCharSelf} roster={charRoster} Icon={CharIcon} />
          <CharPicker label={`${t('defis.charOf')} ${opponent.login}`} value={charOpp} onChange={setCharOpp} roster={charRoster} Icon={CharIcon} />

          <div className="px-4 py-3 rounded-xl bg-bg-1/80 border border-border text-center text-sm text-muted-2 leading-relaxed shadow-inner">
            <span className={`font-extrabold ${iWon ? 'text-teal' : 'text-text-strong'}`}>{winnerLogin}</span>
            {' '}{t('defis.winsTheSet')}{' '}
            <span className="font-extrabold text-text-strong font-mono tabular-nums">{target}</span>
            <span className="text-muted mx-1.5 opacity-50">-</span>
            <span className="font-extrabold text-text-strong font-mono tabular-nums">{loserGames}</span>
            {' (Bo'}{bestOf}{')'}
          </div>

          <Button
            size="md"
            loading={busy}
            disabled={!smashReady}
            onClick={triggerSend}
            className="w-full py-3.5 text-sm font-bold shadow-lg"
          >
            {t('defis.sendDeclaration')}
          </Button>
          <p className="text-[10px] text-muted/70 leading-relaxed text-center font-medium">
            {opponent.login} {t('defis.mustConfirmScore')}
          </p>
        </div>
      )}

      {/* ─── Variante ÉCHECS : résultat binaire (victoire / défaite) ──────── */}
      {opponent && iWon !== null && isChess && (
        <div className="relative mt-6 animate-slide-down space-y-4">
          <div className="px-4 py-3 rounded-xl bg-bg-1/80 border border-border text-center text-sm text-muted-2 leading-relaxed shadow-inner">
            <span className={`font-extrabold ${iWon ? 'text-teal' : 'text-text-strong'}`}>{winnerLogin}</span>
            {' '}{t('defis.checkmated')}{' '}
            <span className={`font-extrabold ${iWon ? 'text-text-strong' : 'text-teal'}`}>{loserLogin}</span>
            <div className="text-[11px] text-muted-2 mt-1">{t('defis.chessOnlyResult')}</div>
          </div>
          <Button
            size="md"
            loading={busy}
            onClick={triggerSend}
            className="w-full py-3.5 text-sm font-bold shadow-lg"
          >
            {t('defis.sendDeclaration')}
          </Button>
          <p className="text-[10px] text-muted/70 leading-relaxed text-center font-medium">
            {opponent.login} {t('defis.mustConfirmResult')}
          </p>
        </div>
      )}
    </motion.div>
    </div>
  );
}
