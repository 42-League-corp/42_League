import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../hooks/useAuth';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useT } from '../../lib/i18n';
import { haptic } from '../feedback/useHaptic';

/**
 * Titre par route — visible en très gros style "iOS large title".
 * `null` ⇒ on n'affiche que le brand (fallback).
 */
const ROUTE_TITLE: Record<string, string> = {
  '/defis': 'Défis',
  '/tournois': 'Tournois',
  '/leaderboard': 'Classement',
  '/trophees': 'Trophées',
  '/profil': 'Profil',
  '/historique': 'Historique',
  '/reglages': 'Réglages',
};

function titleFor(pathname: string): string {
  // Match exact d'abord, sinon préfixe (tournois/:id → Tournois)
  if (ROUTE_TITLE[pathname]) return ROUTE_TITLE[pathname];
  for (const [route, title] of Object.entries(ROUTE_TITLE)) {
    if (pathname.startsWith(`${route}/`)) return title;
  }
  return '42 League';
}

export function MobileHeader() {
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { me, pending } = useLeagueData();
  const pendingCount = pending.filter((p) => p.opponentLogin === me?.login).length;
  const title = titleFor(location.pathname);

  return (
    <header
      className="sticky top-0 z-40 w-full glass border-b border-border/60 no-select"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center gap-3 px-4 h-14">
        {/* Brand compact */}
        <NavLink
          to="/defis"
          onClick={() => haptic('selection')}
          className="flex items-baseline gap-1.5 active:opacity-70 transition-opacity tap-transparent"
        >
          <span className="text-base font-extrabold tracking-[0.18em] uppercase gradient-text-brand">
            42·L
          </span>
        </NavLink>

        {/* Titre de page animé — change avec la route */}
        <motion.h1
          key={title}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="text-sm font-bold text-text-strong tracking-wide flex-1 truncate ml-1"
        >
          {title}
        </motion.h1>

        {/* Bell — uniquement si des pending */}
        {pendingCount > 0 && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            type="button"
            onClick={() => {
              haptic('selection');
              navigate('/defis');
            }}
            aria-label={`${pendingCount} game${pendingCount > 1 ? 's' : ''} à confirmer`}
            className="relative flex items-center justify-center w-9 h-9 rounded-full bg-gold/15 active:bg-gold/25 active:scale-90 transition-transform tap-transparent"
          >
            <Bell className="w-4 h-4 text-gold" strokeWidth={2.5} />
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red text-white text-[9px] font-extrabold flex items-center justify-center ring-2 ring-bg-0 tabular-nums">
              {pendingCount}
            </span>
          </motion.button>
        )}

        {/* Avatar utilisateur */}
        {me?.user && (
          <NavLink
            to="/profil"
            onClick={() => haptic('selection')}
            className="active:scale-90 transition-transform tap-transparent"
            aria-label={t('nav.profil')}
          >
            <Avatar login={login ?? '?'} imageUrl={me.user.imageUrl} size="sm" />
          </NavLink>
        )}
      </div>
    </header>
  );
}
