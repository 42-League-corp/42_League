import { motion } from 'framer-motion';
import { Dices, Loader2, X } from 'lucide-react';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { useGameMode } from '../hooks/useGameMode';
import { useT } from '../lib/i18n';
import { GAME_META } from '../lib/gameMeta';
import type { Game } from '../lib/gameMode';

/**
 * Petite pastille carrée « en recherche » d'un AUTRE mode que celui de la page.
 * Couleur = identité du mode, logo en filigrane, spinner qui tourne. Clic =
 * bascule sur ce mode (où le grand panneau « Dans la file » prendra le relais).
 */
function SearchChip({ game, onPick }: { game: Game; onPick: (g: Game) => void }) {
  const gm = GAME_META[game];
  return (
    <button
      type="button"
      onClick={() => onPick(game)}
      title={gm.label}
      aria-label={gm.label}
      className="relative grid w-[52px] flex-shrink-0 place-items-center self-stretch overflow-hidden rounded-xl border transition-transform active:scale-95"
      style={{ borderColor: gm.borderColor, background: gm.bgColor }}
    >
      {/* Logo du mode en filigrane */}
      <span className="absolute opacity-20" style={{ color: gm.color }}>
        {gm.icon(true)}
      </span>
      <motion.span
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
        className="relative flex-shrink-0"
        style={{ color: gm.color }}
      >
        <Loader2 className="h-5 w-5" strokeWidth={2.5} />
      </motion.span>
    </button>
  );
}

/**
 * CTA « Match aléatoire ». Chaque mode de jeu a sa PROPRE recherche (cf.
 * MatchmakingProvider) :
 *  - le mode de la page courante occupe le grand bouton (ou le panneau « Dans la
 *    file… / Annuler » quand il cherche) ;
 *  - les autres modes en recherche apparaissent en petites pastilles colorées à
 *    droite, sur la même ligne (clic → bascule sur ce mode).
 * L'overlay VERSUS (MatchmakingOverlay) s'affiche sur n'importe quelle page dès
 * qu'un mode trouve un adversaire, avec le logo du mode concerné.
 */
export function MatchmakingButton({ className = '' }: { className?: string }) {
  const t = useT();
  const { game, setGame } = useGameMode();
  const { searching, start, cancel } = useMatchmaking();

  const currentSearching = searching.includes(game);
  const others = searching.filter((g) => g !== game);
  const meta = GAME_META[game];

  return (
    <div className={`flex items-stretch gap-2 ${className}`}>
      <div className="min-w-0 flex-1">
        {!currentSearching ? (
          <button
            type="button"
            onClick={() => void start(game)}
            className="shine relative w-full overflow-hidden inline-flex items-center justify-center gap-2 rounded-xl
                       px-5 py-3.5 font-display font-black uppercase tracking-wider text-sm text-[#1a0d00]
                       bg-gradient-to-b from-[#ffd87a] via-[#f0a020] to-[#c5520a] border border-[#ffc966]/60
                       shadow-[inset_0_1px_0_rgba(255,247,228,0.5),0_4px_14px_rgba(255,128,32,0.4)]
                       transition-all duration-200 hover:brightness-105 active:scale-[0.98]"
          >
            <Dices className="w-5 h-5" strokeWidth={2.5} />
            {t('defis.random')}
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-xl px-5 py-3.5 flex items-center justify-between gap-3
                       border border-gold/40 bg-gold/5"
          >
            <div className="flex items-center gap-3 min-w-0">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
                className="flex-shrink-0"
                style={{ color: meta.color }}
              >
                <Loader2 className="w-5 h-5" strokeWidth={2.5} />
              </motion.span>
              <div className="flex flex-col min-w-0">
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ repeat: Infinity, duration: 1.4 }}
                  className="font-display font-bold text-text-strong text-sm truncate"
                >
                  {t('defis.queue.inQueue')}
                </motion.span>
                <span className="text-[10px] text-muted-2 uppercase tracking-wider truncate">
                  {meta.label} · {t('defis.queue.searching')}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void cancel(game)}
              className="flex-shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[10px]
                         font-extrabold uppercase tracking-wider text-muted-2 border border-border
                         hover:text-red hover:border-red/60 transition-colors"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2.5} />
              {t('defis.queue.cancel')}
            </button>
          </motion.div>
        )}
      </div>

      {/* Pastilles des autres modes en recherche (clic → bascule sur ce mode). */}
      {others.map((g) => (
        <SearchChip key={g} game={g} onPick={setGame} />
      ))}
    </div>
  );
}
