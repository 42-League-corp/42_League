import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronRight, Crown, Users } from 'lucide-react';
import type { Tournament } from '../../../lib/api';
import { haptic } from '../../../mobile/feedback/useHaptic';
import { RivetCorners } from '../../../mobile/primitives/RivetCorners';

interface TournamentCardProps {
  tournament: Tournament;
}

const STATUS_LABEL: Record<Tournament['status'], string> = {
  registration: 'INSCRIPTIONS',
  in_progress: 'EN COURS',
  finished: 'TERMINÉ',
  cancelled: 'ANNULÉ',
};

const STATUS_STYLE: Record<Tournament['status'], { ring: string; bg: string; chip: string; glow: string }> = {
  registration: {
    ring: 'border-teal/40',
    bg: 'bg-gradient-to-br from-teal/[0.06] to-bg-1/80',
    chip: 'bg-teal/15 text-teal',
    glow: 'shadow-teal-glow',
  },
  in_progress: {
    ring: 'border-gold/40',
    bg: 'bg-gradient-to-br from-gold/[0.06] to-bg-1/80',
    chip: 'bg-gold/15 text-gold',
    glow: 'shadow-gold-glow',
  },
  finished: {
    ring: 'border-border',
    bg: 'bg-bg-1/70',
    chip: 'bg-bg-2 text-muted-2',
    glow: '',
  },
  cancelled: {
    ring: 'border-red/30',
    bg: 'bg-red/[0.04]',
    chip: 'bg-red/15 text-red',
    glow: '',
  },
};

/**
 * Card mobile premium d'un tournoi.
 * - Couleur de bordure selon le status
 * - Barre de progression des inscriptions
 * - Tap → page détail
 * - Mise en avant du vainqueur si terminé
 */
export function TournamentCard({ tournament: t }: TournamentCardProps) {
  const count = t.entries?.length ?? 0;
  const fillPct = Math.min(100, Math.round((count / t.capacity) * 100));
  const isOfficial = t.kind === 'official';
  const isLive = t.status === 'in_progress';
  const isReg = t.status === 'registration';
  const style = STATUS_STYLE[t.status];

  return (
    <motion.div layout>
      <Link
        to={`/tournaments/${encodeURIComponent(t.id)}`}
        onClick={() => haptic('selection')}
        className={`block relative overflow-hidden rounded-2xl border ${style.ring} ${style.bg} ${isLive ? style.glow : ''} active:scale-[0.98] transition-transform tap-transparent shadow-[inset_0_1px_0_rgba(255,215,120,0.10),0_4px_14px_rgba(0,0,0,0.35)]`}
      >
        {/* Filets laiton décoratifs en haut/bas (côté HUD) */}
        <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-gold/40 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-gold/25 to-transparent pointer-events-none" />

        {/* Rivets — uniquement pour les tournois "à action" (live/reg) */}
        {(isLive || isReg) && <RivetCorners size={6} inset={4} />}

        {/* Scanline pour les tournois en cours */}
        {isLive && (
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent animate-pulse" />
        )}

        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                {isOfficial && <Crown className="w-3.5 h-3.5 text-gold flex-shrink-0" strokeWidth={2.5} fill="rgba(255,201,74,0.35)" />}
                <h3 className="font-extrabold text-text-strong text-base truncate">
                  {t.name}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-2">
                <span className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-[9px] ${isOfficial ? 'text-gold bg-gold/10 border border-gold/30' : 'text-muted-2 bg-bg-2'}`}>
                  {isOfficial ? '★ Officiel' : 'Amical'}
                </span>
                <span className="opacity-60">·</span>
                <span>par <span className="text-text-strong font-semibold">{t.createdByLogin}</span></span>
              </div>
            </div>

            <span
              className={`text-[9px] font-extrabold uppercase tracking-[0.14em] px-2 py-1 rounded-full whitespace-nowrap ${style.chip}`}
            >
              {STATUS_LABEL[t.status]}
            </span>
          </div>

          {/* Barre de capacité (uniquement pour reg/in_progress) */}
          {(isReg || isLive) && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] mb-1.5">
                <div className="flex items-center gap-1 text-muted-2">
                  <Users className="w-3 h-3" strokeWidth={2.5} />
                  <span className="font-mono tabular-nums font-bold">{count}/{t.capacity}</span>
                  <span className="uppercase tracking-wider">joueurs</span>
                </div>
                {isReg && (
                  <span className="text-teal font-mono font-bold">{fillPct}%</span>
                )}
              </div>
              <div className="h-1 rounded-full bg-bg-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${fillPct}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
                  className={`h-full rounded-full ${isLive ? 'bg-gradient-to-r from-gold to-[#ffdb8a]' : 'bg-gradient-to-r from-teal to-teal-dim'}`}
                />
              </div>
            </div>
          )}

          {/* Winner pour les tournois terminés */}
          {t.winner && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-gold/10 border border-gold/30">
              <Crown className="w-4 h-4 text-gold flex-shrink-0" strokeWidth={2.5} fill="rgba(255,201,74,0.55)" />
              <div className="text-xs">
                <span className="text-muted-2">Vainqueur · </span>
                <span className="font-extrabold text-gold">{t.winner.login}</span>
              </div>
            </div>
          )}

          {/* Chevron action */}
          <div className="absolute right-3 bottom-3 text-muted opacity-50">
            <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
