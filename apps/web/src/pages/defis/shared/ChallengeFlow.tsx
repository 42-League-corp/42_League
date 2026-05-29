import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords } from 'lucide-react';
import { Button } from '../../../components/Button';
import { TimePicker } from '../../../components/TimePicker';
import { api, type LeaderboardEntry } from '../../../lib/api';
import { useFlash } from '../../../hooks/useFlash';
import { useI18n } from '../../../lib/i18n';
import { fmtDayLabel, fmtTime } from '../../../lib/format';
import { haptic } from '../../../mobile/feedback/useHaptic';
import { PlayerSearch } from './PlayerSearch';

const SEND_AWAY_ANIM_MS = 140;

interface ChallengeFlowProps {
  others: LeaderboardEntry[];
  recentOpponents: LeaderboardEntry[];
  opponentCounts: Record<string, number>;
  myLogin: string | undefined;
  /** Pré-sélectionne un adversaire (depuis une carte joueur) → saute l'étape recherche. */
  presetOpponent?: LeaderboardEntry | null;
  /** Appelé après un POST réussi. Doit refresh les data + (optionnel) fermer le container. */
  onSubmitted: () => Promise<void> | void;
  variant?: 'desktop' | 'mobile';
}

/** Heure par défaut : maintenant + 30 min, arrondie au quart d'heure. */
function defaultWhen(): Date {
  const d = new Date(Date.now() + 30 * 60_000);
  d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0);
  return d;
}

/**
 * Flow « Défier un joueur » — calque exact du DeclareGameFlow en termes de
 * fluidité : recherche d'adversaire identique, puis sélecteur d'heure premium
 * (TimePicker à molettes) au lieu de l'abaque, mêmes animations d'envoi.
 */
export function ChallengeFlow({
  others,
  recentOpponents,
  opponentCounts,
  presetOpponent = null,
  onSubmitted,
  variant = 'desktop',
}: ChallengeFlowProps) {
  const flash = useFlash();
  const { lang } = useI18n();
  const [opponent, setOpponent] = useState<LeaderboardEntry | null>(presetOpponent);
  const [when, setWhen] = useState<Date>(defaultWhen);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!opponent) return;
    setBusy(true);
    try {
      await api.createChallenge({
        opponentLogin: opponent.login,
        scheduledAt: when.toISOString(),
      });
      flash.show(`Défi envoyé à @${opponent.login}`);
      haptic('success');
      await onSubmitted();
    } catch (err) {
      flash.show(err instanceof Error ? err.message : String(err), 'error');
      haptic('error');
    } finally {
      setBusy(false);
      setSending(false);
    }
  }, [opponent, when, flash, onSubmitted]);

  const triggerSend = () => {
    setSending(true);
    haptic('medium');
    window.setTimeout(handleSubmit, SEND_AWAY_ANIM_MS);
  };

  // Adversaire pré-sélectionné → on masque la recherche (l'adversaire est imposé).
  const locked = presetOpponent != null;

  return (
    <div className="relative">
      {/* Flash doré à l'envoi */}
      <AnimatePresence>
        {sending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0] }}
            transition={{ duration: 0.4, times: [0, 0.2, 1] }}
            className="absolute inset-0 rounded-xl pointer-events-none z-30"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(255,201,74,0.35) 0%, transparent 70%)',
            }}
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
        {!locked && (
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
              onClear={() => setOpponent(null)}
            />
          </div>
        )}

        {opponent && (
          <div className="relative mt-6 animate-slide-down">
            <label className="block text-[10px] uppercase tracking-wider text-muted font-bold mb-4 text-center">
              Quand ?
            </label>

            <TimePicker value={when} onChange={setWhen} lang={lang} />

            <div className="mt-6 px-4 py-3 rounded-xl bg-bg-1/80 border border-border text-center text-sm text-muted-2 leading-relaxed shadow-inner">
              {'Défi à '}
              <span className="font-extrabold text-teal">{opponent.login}</span>
              {lang === 'fr' ? ' — ' : ' — '}
              <span className="font-extrabold text-text-strong">
                {fmtDayLabel(when.toISOString(), lang).toLowerCase()}
              </span>
              {' à '}
              <span className="font-extrabold text-text-strong font-mono tabular-nums">
                {fmtTime(when)}
              </span>
            </div>

            <div className="mt-5">
              <Button
                size="md"
                loading={busy}
                onClick={triggerSend}
                className="w-full py-3.5 text-sm font-bold shadow-lg"
              >
                <Swords className="w-4 h-4 mr-1.5" strokeWidth={2.5} />
                Envoyer le défi
              </Button>
            </div>

            <p className="mt-3 text-[10px] text-muted/70 leading-relaxed text-center font-medium">
              {opponent.login} devra accepter le défi pour le programmer.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
