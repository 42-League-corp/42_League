import { motion } from 'framer-motion';
import { Dices, Loader2, X } from 'lucide-react';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { useT } from '../lib/i18n';

/**
 * CTA « Match aléatoire » : rejoint la file de matchmaking et affiche l'animation
 * de recherche (« Tu es dans la file »). L'état vit dans le MatchmakingProvider
 * global → la recherche persiste si on quitte la page, et l'overlay VERSUS
 * (MatchmakingOverlay, monté dans l'AppShell) s'affiche sur n'importe quelle page
 * quand un adversaire est trouvé.
 */
export function MatchmakingButton({ className = '' }: { className?: string }) {
  const t = useT();
  const { state, start, cancel } = useMatchmaking();

  const searching = state === 'searching';

  return (
    <div className={className}>
      {!searching ? (
        <button
          type="button"
          onClick={() => void start()}
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
              className="text-gold flex-shrink-0"
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
                {t('defis.queue.searching')}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void cancel()}
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
  );
}
