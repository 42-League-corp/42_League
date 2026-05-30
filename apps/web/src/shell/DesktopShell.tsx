import { type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Swords,
  Trophy,
  BarChart3,
  Award,
  User,
  History,
  Settings,
  Zap,
  Cog,
  Shield,
  Info,
} from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../hooks/useAuth';
import { useLeagueData } from '../hooks/useLeagueData';
import { useT } from '../lib/i18n';

interface NavDef {
  to: string;
  labelKey: string;
  Icon: typeof Swords;
}

const NAV: NavDef[] = [
  { to: '/challenges', labelKey: 'nav.defis', Icon: Swords },
  { to: '/tournaments', labelKey: 'nav.tournois', Icon: Trophy },
  { to: '/leaderboard', labelKey: 'nav.leaderboard', Icon: BarChart3 },
  { to: '/trophies', labelKey: 'nav.trophees', Icon: Award },
  { to: '/profile', labelKey: 'nav.profil', Icon: User },
];

const NAV_SECONDARY: NavDef[] = [
  { to: '/history', labelKey: 'nav.historique', Icon: History },
  { to: '/settings', labelKey: 'nav.reglages', Icon: Settings },
  { to: '/about', labelKey: 'nav.about', Icon: Info },
];

const NAV_ADMIN: NavDef = { to: '/GOD', labelKey: 'nav.god', Icon: Shield };

interface DesktopShellProps {
  children: ReactNode;
}

/**
 * Shell desktop — refonte premium « RPG / Esport ».
 * Sidebar dorée avec rivets, fond anthracite chaud, glow doré.
 * Le contenu garde une largeur lisible, centré, avec deux tubes en laiton sur les côtés.
 */
export function DesktopShell({ children }: DesktopShellProps) {
  const t = useT();
  const { login } = useAuth();
  const { me, pending } = useLeagueData();
  const navigate = useNavigate();

  const pendingCount = pending.filter((p) => p.opponentLogin === me?.login).length;

  return (
    <div className="h-dvh flex flex-row relative overflow-hidden">
      {/* ─── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="relative flex flex-col w-64 h-dvh z-20 no-select">
        {/* Fond + grille HUD */}
        <div className="absolute inset-0 bg-gradient-to-b from-bg-1 via-bg-1/95 to-bg-0 hud-grid" />
        {/* Bordure droite « tube laiton » */}
        <div className="absolute top-0 bottom-0 right-0 w-[3px] brass-pipe pointer-events-none" />
        {/* Rivet décoratif */}
        <Cog
          className="absolute top-3 right-3 w-4 h-4 text-gold/40 animate-gear-spin pointer-events-none"
          strokeWidth={2}
        />

        {/* Brand */}
        <div className="relative px-5 py-5 border-b border-gold/20">
          <NavLink to="/" className="flex flex-col gap-1.5 group" aria-label="42 League">
            <img
              src="/logo-wordmark.png"
              alt="42 League"
              className="w-full h-auto select-none drop-shadow-[0_2px_8px_rgba(255,201,74,0.25)]"
              draggable={false}
            />
            <div className="text-[9px] text-brass/80 uppercase tracking-[0.2em] font-bold text-center">
              Babyfoot · Ranked
            </div>
          </NavLink>
        </div>

        {/* Navigation principale */}
        <nav className="relative flex flex-col p-3 gap-1">
          {NAV.map((n) => (
            <NavItem
              key={n.to}
              to={n.to}
              label={t(n.labelKey)}
              Icon={n.Icon}
              badge={n.to === '/challenges' ? pendingCount : 0}
            />
          ))}
          <div className="my-2 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
          {NAV_SECONDARY.map((n) => (
            <NavItem
              key={n.to}
              to={n.to}
              label={t(n.labelKey)}
              Icon={n.Icon}
            />
          ))}
          {(me?.role === 'ADMIN' || me?.role === 'SUPERADMIN') && (
            <>
              <div className="my-2 h-px bg-gradient-to-r from-transparent via-red/30 to-transparent" />
              <NavItem
                to={NAV_ADMIN.to}
                label={t(NAV_ADMIN.labelKey)}
                Icon={NAV_ADMIN.Icon}
              />
            </>
          )}
        </nav>

        {/* Bannière "à confirmer" */}
        {pendingCount > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => navigate('/challenges')}
            className="relative mx-3 mb-3 p-3 rounded-xl text-left group hover-glow"
            style={{
              background:
                'linear-gradient(135deg, rgba(255, 201, 74, 0.12), rgba(255, 201, 74, 0.04))',
              border: '1px solid rgba(255, 201, 74, 0.35)',
              boxShadow:
                'inset 0 1px 0 rgba(255, 215, 120, 0.18), 0 4px 14px rgba(255, 201, 74, 0.12)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3.5 h-3.5 text-gold animate-ember" strokeWidth={2.5} />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gold font-gaming">
                {pendingCount} game{pendingCount > 1 ? 's' : ''} à confirmer
              </span>
            </div>
            <div className="text-[10px] text-muted-2 group-hover:text-gold/80 transition-colors">
              Un adversaire attend ta réponse →
            </div>
          </motion.button>
        )}

        {/* Profil bas */}
        <div className="relative mt-auto p-3 border-t border-gold/20">
          {me?.user ? (
            <NavLink
              to="/profile"
              className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gold/5 transition-colors group"
            >
              <Avatar login={login ?? '?'} imageUrl={me.user.imageUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-text-strong truncate group-hover:text-gold transition-colors">
                  {login}
                </div>
                <div className="text-[10px] text-gold uppercase tracking-wider font-extrabold tabular-nums">
                  {me.user.elo} ELO
                </div>
              </div>
            </NavLink>
          ) : (
            <div className="text-xs text-muted-2">{t('auth.notConnected')}</div>
          )}
        </div>
      </aside>

      {/* ─── Main ────────────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 relative overflow-y-auto custom-scrollbar">
        {/* Vignette dorée derrière le contenu */}
        <div className="absolute inset-0 bg-gold-vignette pointer-events-none" />
        <div className="relative px-6 lg:px-10 py-8 max-w-[1600px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}

// ─── NavItem ─────────────────────────────────────────────────────────────

interface NavItemProps {
  to: string;
  label: string;
  Icon: typeof Swords;
  badge?: number;
}

function NavItem({ to, label, Icon, badge = 0 }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold tracking-wide group transition-colors duration-150 ${
          isActive ? 'text-gold' : 'text-muted-2 hover:text-text'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Smooth sliding background pill — motion.dev tabs pattern */}
          {isActive && (
            <motion.span
              layoutId="desktop-nav-bg"
              className="absolute inset-0 rounded-lg"
              style={{
                background: 'rgba(255,201,74,0.09)',
                border: '1px solid rgba(255,201,74,0.22)',
                boxShadow: 'inset 0 1px 0 rgba(255,215,120,0.10)',
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 0.7 }}
            />
          )}
          {/* Left accent bar (slides with the bg pill) */}
          {isActive && (
            <motion.span
              layoutId="desktop-nav-bar"
              className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r"
              style={{
                background: 'linear-gradient(to bottom, #ffc94a, #e0a82a)',
                boxShadow: '0 0 10px rgba(255,201,74,0.6)',
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 0.7 }}
            />
          )}
          <Icon
            className={`relative w-[18px] h-[18px] transition-all duration-150 ${
              isActive ? 'text-gold' : 'text-muted-2 group-hover:text-text'
            }`}
            strokeWidth={isActive ? 2.5 : 2}
          />
          <span className="relative flex-1">{label}</span>
          {badge > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              className="relative min-w-[18px] h-[18px] px-1 rounded-full bg-red text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-bg-1 tabular-nums"
            >
              {badge}
            </motion.span>
          )}
        </>
      )}
    </NavLink>
  );
}

// ─── Brand mark (petit rouage doré) ─────────────────────────────────────

