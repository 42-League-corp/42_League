import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AbacusSlider } from '../../../components/AbacusSlider';
import { OutcomeButton } from '../../../components/OutcomeButton';
import { Button } from '../../../components/Button';
import { SmashCharIcon } from '../../../components/SmashCharIcon';
import { api, type LeaderboardEntry } from '../../../lib/api';
import { useFlash } from '../../../hooks/useFlash';
import { useGameMode } from '../../../hooks/useGameMode';
import { SMASH_ROSTER } from '../../../lib/smash';
import { haptic } from '../../../mobile/feedback/useHaptic';
import { PlayerSearch } from './PlayerSearch';

export const WINNING_SCORE = 10;
export const LOSER_SCORE_MIN = -10;
export const LOSER_SCORE_MAX = WINNING_SCORE - 1;

const smashTargetOf = (bestOf: number) => Math.ceil(bestOf / 2);

/** Grille de sélection d'un personnage Smash. */
function SmashCharPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">{label}</label>
      <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-h-44 overflow-y-auto scrollbar-none p-1 rounded-lg bg-bg-1/50 border border-border/50">
        {SMASH_ROSTER.map((c) => (
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
            <SmashCharIcon id={c.id} size={40} className="w-full aspect-square" />
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
}: DeclareGameFlowProps) {
  const flash = useFlash();
  const { game, isSmash } = useGameMode();
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

  const smashReady = !isSmash || (!!charSelf && !!charOpp);

  const handleSubmit = useCallback(async () => {
    if (!opponent || iWon === null) return;
    setBusy(true);
    try {
      if (isSmash) {
        if (!charSelf || !charOpp) {
          flash.show('Choisis les deux personnages', 'error');
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
          game: 'smash',
          bestOf,
          charSelf,
          charOpponent: charOpp,
          stocks: winnerStocks,
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
  }, [opponent, iWon, loserScore, isSmash, isChess, charSelf, charOpp, target, loserGames, bestOf, winnerStocks, flash, onSubmitted]);

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
          locations={locations}
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
              {variant === 'mobile'
                ? iWon
                  ? "J'ai gagné"
                  : "J'ai perdu"
                : iWon
                  ? "🏆 J'ai gagné"
                  : "💀 J'ai perdu"}
            </span>
            <span className="text-muted-2 text-lg leading-none">×</span>
          </button>
        </div>
      )}

      {opponent && iWon !== null && game === 'babyfoot' && (
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

      {/* ─── Variante SMASH : format, score en games, persos, vies ─────────── */}
      {opponent && iWon !== null && isSmash && (
        <div className="relative mt-6 animate-slide-down space-y-5">
          {/* Format */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">Format</label>
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
              Games de {iWon ? opponent.login : (myLogin ?? 'moi')} (perdant) · gagnant {target}
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

          {/* Vies (stocks) restantes du gagnant au game décisif */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-2">
              Vies restantes du gagnant (game décisif)
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

          {/* Persos */}
          <SmashCharPicker label="Ton perso" value={charSelf} onChange={setCharSelf} />
          <SmashCharPicker label={`Perso de ${opponent.login}`} value={charOpp} onChange={setCharOpp} />

          <div className="px-4 py-3 rounded-xl bg-bg-1/80 border border-border text-center text-sm text-muted-2 leading-relaxed shadow-inner">
            <span className={`font-extrabold ${iWon ? 'text-teal' : 'text-text-strong'}`}>{winnerLogin}</span>
            {' gagne le set '}
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
            Envoyer la déclaration
          </Button>
          <p className="text-[10px] text-muted/70 leading-relaxed text-center font-medium">
            {opponent.login} devra confirmer ce score pour valider la game.
          </p>
        </div>
      )}

      {/* ─── Variante ÉCHECS : résultat binaire (victoire / défaite) ──────── */}
      {opponent && iWon !== null && isChess && (
        <div className="relative mt-6 animate-slide-down space-y-4">
          <div className="px-4 py-3 rounded-xl bg-bg-1/80 border border-border text-center text-sm text-muted-2 leading-relaxed shadow-inner">
            <span className={`font-extrabold ${iWon ? 'text-teal' : 'text-text-strong'}`}>{winnerLogin}</span>
            {' a maté '}
            <span className={`font-extrabold ${iWon ? 'text-text-strong' : 'text-teal'}`}>{loserLogin}</span>
            <div className="text-[11px] text-muted-2 mt-1">Aux échecs, seul le résultat compte.</div>
          </div>
          <Button
            size="md"
            loading={busy}
            onClick={triggerSend}
            className="w-full py-3.5 text-sm font-bold shadow-lg"
          >
            Envoyer la déclaration
          </Button>
          <p className="text-[10px] text-muted/70 leading-relaxed text-center font-medium">
            {opponent.login} devra confirmer le résultat pour valider la partie.
          </p>
        </div>
      )}
    </motion.div>
    </div>
  );
}
