import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronRight, Star } from 'lucide-react';
import { useT } from '../lib/i18n';

interface XpBarProps {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  /** Affiche le bouton « Passe de combat » sous la barre. Défaut true. */
  withLink?: boolean;
  className?: string;
}

/**
 * Barre d'XP / niveau du passe de combat — affichée sur le profil (mobile +
 * desktop). Niveau courant, barre de progression dorée (xpIntoLevel /
 * xpForNextLevel) animée en largeur (Framer Motion), et compteurs d'XP.
 * Optionnellement, un bouton vers la page /passe.
 */
export function XpBar({
  level,
  xpIntoLevel,
  xpForNextLevel,
  withLink = true,
  className = '',
}: XpBarProps) {
  const t = useT();
  const pct =
    xpForNextLevel > 0
      ? Math.min(100, Math.max(0, Math.round((xpIntoLevel / xpForNextLevel) * 100)))
      : 0;

  return (
    <div className={`card-hud rounded-xl px-4 py-3 border-gold/25 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5 font-display text-xs font-black uppercase tracking-[0.16em] text-gold">
          <Star className="w-3.5 h-3.5" strokeWidth={2.5} fill="currentColor" />
          {t('battlepass.level')} {level}
        </span>
        <span className="font-mono text-[11px] font-bold tabular-nums text-muted-2">
          {xpIntoLevel} / {xpForNextLevel} {t('battlepass.xp')}
        </span>
      </div>

      {/* Piste + remplissage doré animé */}
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-bg-1/80 border border-gold/15">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: 'linear-gradient(90deg, #ffb347 0%, #ffc94a 60%, #ffe39a 100%)',
            boxShadow: '0 0 12px rgba(255,201,74,0.6)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {withLink && (
        <Link
          to="/passe"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-gold transition-colors hover:bg-gold/15 tap-transparent"
        >
          {t('battlepass.profileBtn')}
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
        </Link>
      )}
    </div>
  );
}
