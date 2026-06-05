import { motion } from 'framer-motion';
import { Dices, Loader2, X } from 'lucide-react';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { useGameMode } from '../hooks/useGameMode';
import { useT } from '../lib/i18n';
import { GAME_META } from '../lib/gameMeta';
import type { Game } from '../lib/gameMode';

type TFn = (key: string) => string;

/**
 * Grand bouton « Match aléatoire ». Garde son design (dégradé, brillance, relief)
 * mais emprunte la palette du mode courant (cf. GAME_META[game].button) : gold
 * pour le babyfoot, rouge pour Smash, vert pour les échecs, etc.
 */
function RandomButton({
  game,
  onClick,
  label,
  className = '',
}: {
  game: Game;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  const b = GAME_META[game].button;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        backgroundImage: `linear-gradient(to bottom, ${b.from}, ${b.via}, ${b.to})`,
        color: b.text,
        borderColor: b.border,
        boxShadow: `inset 0 1px 0 rgba(255,247,228,0.5), 0 4px 14px ${b.glow}`,
      }}
      className={`shine relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-xl border
                  px-5 py-3.5 font-display font-black uppercase tracking-wider text-sm
                  transition-all duration-200 hover:brightness-105 active:scale-[0.98] ${className}`}
    >
      <Dices className="w-5 h-5" strokeWidth={2.5} />
      {label}
    </button>
  );
}

/**
 * Case « en recherche » d'un mode. Indique clairement le mode de jeu (libellé +
 * logo en filigrane), spinner aux couleurs du mode, et croix pour annuler. Pour
 * un mode autre que celui de la page, toute la case est cliquable et bascule
 * dessus (le clic sur la croix annule sans basculer).
 */
function SearchBox({
  game,
  current = false,
  onPick,
  onCancel,
  t,
  className = '',
}: {
  game: Game;
  current?: boolean;
  onPick?: (g: Game) => void;
  onCancel: () => void;
  t: TFn;
  className?: string;
}) {
  const gm = GAME_META[game];
  return (
    <div
      className={`relative flex items-stretch overflow-hidden rounded-xl border ${className}`}
      style={{ borderColor: gm.borderColor, background: gm.bgColor }}
    >
      {/* Fond cliquable pour basculer sur ce mode (sauf s'il est déjà courant). */}
      {!current && onPick && (
        <button
          type="button"
          onClick={() => onPick(game)}
          aria-label={`${gm.label} — ${t('defis.queue.searching')}`}
          className="absolute inset-0 z-0"
        />
      )}

      {/* Logo du mode en filigrane. */}
      <span className="pointer-events-none absolute right-1.5 bottom-0 opacity-10" style={{ color: gm.color }}>
        {gm.icon(true)}
      </span>

      <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-center gap-2 px-3 py-3">
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
          className="flex-shrink-0"
          style={{ color: gm.color }}
        >
          <Loader2 className="h-5 w-5" strokeWidth={2.5} />
        </motion.span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-display text-xs font-bold leading-tight" style={{ color: gm.color }}>
            {gm.label}
          </span>
          <motion.span
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ repeat: Infinity, duration: 1.4 }}
            className="truncate text-[9px] uppercase tracking-wider text-muted-2 leading-tight"
          >
            {t('defis.queue.searching')}
          </motion.span>
        </div>
      </div>

      <button
        type="button"
        onClick={onCancel}
        aria-label={t('defis.queue.cancel')}
        className="relative z-10 flex flex-shrink-0 items-center self-stretch px-2 text-muted-2
                   transition-colors hover:text-red"
      >
        <X className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

/**
 * CTA « Match aléatoire ». Chaque mode de jeu a sa PROPRE recherche (cf.
 * MatchmakingProvider). La ligne est partagée équitablement (flex-1) entre :
 *  - le slot du mode courant : grand bouton « Match aléatoire » s'il ne cherche
 *    pas, sinon sa propre case de recherche ;
 *  - une case de recherche par autre mode en file d'attente (clic → bascule).
 * Chaque case indique le mode concerné ; le bouton reprend la palette du mode.
 * L'overlay VERSUS (MatchmakingOverlay) s'affiche sur n'importe quelle page dès
 * qu'un mode trouve un adversaire, avec le logo du mode concerné.
 */
export function MatchmakingButton({ className = '' }: { className?: string }) {
  const t = useT();
  const { game, setGame } = useGameMode();
  const { searching, start, cancel } = useMatchmaking();

  const currentSearching = searching.includes(game);
  const others = searching.filter((g) => g !== game);

  return (
    <div className={`flex items-stretch gap-2 ${className}`}>
      {!currentSearching ? (
        <RandomButton
          game={game}
          onClick={() => void start(game)}
          label={t('defis.random')}
          className="min-w-0 flex-1"
        />
      ) : (
        <SearchBox game={game} current onCancel={() => void cancel(game)} t={t} className="min-w-0 flex-1" />
      )}

      {/* Cases des autres modes en recherche, équitablement réparties. */}
      {others.map((g) => (
        <SearchBox
          key={g}
          game={g}
          onPick={setGame}
          onCancel={() => void cancel(g)}
          t={t}
          className="min-w-0 flex-1"
        />
      ))}
    </div>
  );
}
