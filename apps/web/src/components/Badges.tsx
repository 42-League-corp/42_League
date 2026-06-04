import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, type LucideIcon } from 'lucide-react';
import { badgeDef } from '../lib/badges';
import { badgeIcon } from '../lib/badgeIcons';
import type { EquippedBadge } from '../lib/api';

/** Def de rendu d'un badge (catalogue OU badge acheté en boutique). */
export interface BadgeRenderDef {
  label: string;
  color: string;
  icon: LucideIcon;
  description?: string;
}

/** Convertit un badge acheté (icône = nom string) en def de rendu. */
function defFromEquipped(b: EquippedBadge): BadgeRenderDef {
  return { label: b.label, color: b.color ?? '#a89880', icon: badgeIcon(b.icon) };
}

/**
 * Pastille de badge — façon badge ELO mais teintée selon le badge, avec un léger
 * dégradé animé (sheen) qui balaie en continu pour donner de la vie.
 *
 * `def` (badge acheté, inline) prime sur `code` (badge du catalogue).
 */
export function BadgeChip({
  code,
  def,
  size = 'sm',
  onClick,
}: {
  code?: string;
  def?: BadgeRenderDef;
  size?: 'xs' | 'sm' | 'md';
  onClick?: () => void;
}) {
  const b = def ?? badgeDef(code ?? '');
  const Icon = b.icon;
  const sizeCls =
    size === 'xs'
      ? 'text-[8px] px-1.5 py-0.5 gap-0.5'
      : size === 'md'
        ? 'text-xs px-3 py-1.5 gap-1.5'
        : 'text-[10px] px-2 py-0.5 gap-1';
  const iconCls = size === 'xs' ? 'w-2.5 h-2.5' : size === 'md' ? 'w-4 h-4' : 'w-3 h-3';
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
export function BadgesRow({
  codes,
  extra,
  size = 'sm',
}: {
  codes: string[];
  /** Badge(s) acheté(s) & équipé(s) (boutique), rendus avec leur def inline. */
  extra?: EquippedBadge[];
  size?: 'xs' | 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  const extras = extra ?? [];
  if ((!codes || codes.length === 0) && extras.length === 0) return null;
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {codes.map((code) => (
          <BadgeChip key={code} code={code} size={size} onClick={() => setOpen(true)} />
        ))}
        {extras.map((b) => (
          <BadgeChip key={`shop-${b.code}`} def={defFromEquipped(b)} size={size} onClick={() => setOpen(true)} />
        ))}
      </div>
      <AnimatePresence>
        {open && <BadgesModal codes={codes} extra={extras} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
}

function BadgesModal({
  codes,
  extra = [],
  onClose,
}: {
  codes: string[];
  extra?: EquippedBadge[];
  onClose: () => void;
}) {
  const total = codes.length + extra.length;
  return (
    <motion.div
      className="fixed inset-0 z-[130] overflow-y-auto bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex min-h-full items-center justify-center p-4" onClick={onClose}>
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
            Badges · {total}
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
          {[
            ...codes.map((code) => ({ key: code, b: badgeDef(code) as BadgeRenderDef })),
            ...extra.map((e) => ({ key: `shop-${e.code}`, b: defFromEquipped(e) })),
          ].map(({ key, b }) => {
            const Icon = b.icon;
            return (
              <div key={key} className="flex items-center gap-3 p-2.5 rounded-xl bg-bg-2/40 border border-border/40">
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
      </div>
    </motion.div>
  );
}
