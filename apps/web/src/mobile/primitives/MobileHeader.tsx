import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, Shield } from 'lucide-react';
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
  '/challenges': 'Défis',
  '/tournaments': 'Tournois',
  '/leaderboard': 'Classement',
  '/trophies': 'Trophées',
  '/profile': 'Profil',
  '/history': 'Historique',
  '/settings': 'Réglages',
};

function titleFor(pathname: string): string {
  // Match exact d'abord, sinon préfixe (tournaments/:id → Tournois)
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
      className="sticky top-0 z-40 w-full glass border-b border-gold/20 no-select"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Filet doré décoratif en bas (effet HUD) */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent pointer-events-none" />

      <div className="relative flex items-center gap-3 px-4 h-14">
        {/* Brand compact — plaque dorée mini */}
        <NavLink
          to="/"
          onClick={() => haptic('selection')}
          className="flex items-center gap-1.5 active:opacity-70 transition-opacity tap-transparent"
        >
          <span className="relative inline-flex items-center justify-center w-7 h-7 rounded-md metal-plate-gold">
            <span className="font-display font-black text-[10px] tracking-tight text-[#3a1e00]">
              42L
            </span>
          </span>
        </NavLink>

        {/* Titre de page animé — change avec la route */}
        <motion.h1
          key={title}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="font-gaming text-base font-extrabold text-text-strong tracking-wide flex-1 truncate ml-1 uppercase"
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
              navigate('/challenges');
            }}
            aria-label={`${pendingCount} game${pendingCount > 1 ? 's' : ''} à confirmer`}
            className="relative flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-gold/25 to-gold/10 border border-gold/40 active:bg-gold/30 active:scale-90 transition-transform tap-transparent shadow-[inset_0_1px_0_rgba(255,247,228,0.18),0_2px_8px_rgba(255,201,74,0.15)]"
          >
            <Bell className="w-4 h-4 text-gold animate-ember" strokeWidth={2.5} />
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red text-white text-[9px] font-extrabold flex items-center justify-center ring-2 ring-bg-0 tabular-nums">
              {pendingCount}
            </span>
          </motion.button>
        )}

        {/* GOD shortcut — admins uniquement */}
        {(me?.role === 'ADMIN' || me?.role === 'SUPERADMIN') && (
          <NavLink
            to="/GOD"
            onClick={() => haptic('selection')}
            aria-label="GOD"
            className="relative flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-red/20 to-red/5 border border-red/40 active:scale-90 transition-transform tap-transparent"
          >
            <Shield className="w-4 h-4 text-red" strokeWidth={2.5} />
          </NavLink>
        )}

        {/* Avatar utilisateur */}
        {me?.user && (
          <NavLink
            to="/profile"
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
