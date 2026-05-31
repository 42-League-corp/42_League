import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { badgeDef } from '../lib/badges';

/**
 * Pastille de badge — façon badge ELO mais teintée selon le badge, avec un léger
 * dégradé animé (sheen) qui balaie en continu pour donner de la vie.
 */
export function BadgeChip({
  code,
  size = 'sm',
  onClick,
}: {
  code: string;
  size?: 'xs' | 'sm';
  onClick?: () => void;
}) {
  const b = badgeDef(code);
  const Icon = b.icon;
  const sizeCls = size === 'xs' ? 'text-[8px] px-1.5 py-0.5 gap-0.5' : 'text-[10px] px-2 py-0.5 gap-1';
  const iconCls = size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3';
  return (
    <motion.button
      type="button"
      onClick={onClick}
      title={b.label}
      className={`inline-flex items-center rounded-full font-extrabold uppercase tracking-[0.1em] border leading-none ${sizeCls}`}
      style={{
        color: b.color,
        borderColor: `${b.color}55`,
        // Dégradé tricolore (teinte du badge) balayé en boucle → effet brillant.
        background: `linear-gradient(110deg, ${b.color}14 0%, ${b.color}33 45%, ${b.color}14 70%)`,
        backgroundSize: '220% 100%',
      }}
      animate={{ backgroundPosition: ['0% 0%', '220% 0%'] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
    >
      <Icon className={iconCls} strokeWidth={2.6} />
      {b.label}
    </motion.button>
  );
}

/**
 * Rangée de badges d'un joueur. Cliquer ouvre une modale listant tous ses badges
 * avec leur description (« clique sur le badge pour voir ceux qu'on a »).
 */
export function BadgesRow({ codes, size = 'sm' }: { codes: string[]; size?: 'xs' | 'sm' }) {
  const [open, setOpen] = useState(false);
  if (!codes || codes.length === 0) return null;
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {codes.map((code) => (
          <BadgeChip key={code} code={code} size={size} onClick={() => setOpen(true)} />
        ))}
      </div>
      <AnimatePresence>{open && <BadgesModal codes={codes} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function BadgesModal({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="card-hud rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
        initial={{ scale: 0.94, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 10 }}
        transition={{ type: 'spring', stiffness: 360, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gold/15 bg-bg-2/50">
          <span className="font-gaming text-xs uppercase tracking-[0.16em] text-gold font-extrabold">
            Badges · {codes.length}
          </span>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-7 h-7 flex items-center justify-center rounded-full text-muted hover:text-red hover:bg-red/10 transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
        <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {codes.map((code) => {
            const b = badgeDef(code);
            const Icon = b.icon;
            return (
              <div key={code} className="flex items-center gap-3 p-2.5 rounded-xl bg-bg-2/40 border border-border/40">
                <span
                  className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
                  style={{ color: b.color, background: `${b.color}1a`, border: `1px solid ${b.color}40` }}
                >
                  <Icon className="w-5 h-5" strokeWidth={2.4} />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold" style={{ color: b.color }}>
                    {b.label}
                  </div>
                  <div className="text-[11px] text-muted-2 leading-snug">{b.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
