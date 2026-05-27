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
  { to: '/defis', labelKey: 'nav.defis', Icon: Swords },
  { to: '/tournois', labelKey: 'nav.tournois', Icon: Trophy },
  { to: '/leaderboard', labelKey: 'nav.leaderboard', Icon: BarChart3 },
  { to: '/trophees', labelKey: 'nav.trophees', Icon: Award },
  { to: '/profil', labelKey: 'nav.profil', Icon: User },
];

const NAV_SECONDARY: NavDef[] = [
  { to: '/historique', labelKey: 'nav.historique', Icon: History },
  { to: '/reglages', labelKey: 'nav.reglages', Icon: Settings },
];

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
    <div className="min-h-dvh flex flex-row relative">
      {/* ─── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="relative flex flex-col w-64 sticky top-0 h-screen z-20 no-select">
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
          <div className="flex items-center gap-2">
            <BrandMark />
            <div className="flex-1 min-w-0">
              <div className="text-base font-extrabold tracking-[0.22em] uppercase gradient-text-brand font-display leading-none">
                42 League
              </div>
              <div className="text-[9px] text-brass/80 mt-1 uppercase tracking-[0.2em] font-bold">
                Babyfoot · Ranked
              </div>
            </div>
          </div>
        </div>

        {/* Navigation principale */}
        <nav className="relative flex flex-col p-3 gap-1">
          {NAV.map((n) => (
            <NavItem
              key={n.to}
              to={n.to}
              label={t(n.labelKey)}
              Icon={n.Icon}
              badge={n.to === '/defis' ? pendingCount : 0}
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
        </nav>

        {/* Bannière "à confirmer" */}
        {pendingCount > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => navigate('/defis')}
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
              to="/profil"
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
      <main className="flex-1 min-w-0 relative">
        {/* Vignette dorée derrière le contenu */}
        <div className="absolute inset-0 bg-gold-vignette pointer-events-none" />
        <div className="relative px-6 lg:px-10 py-8 max-w-5xl mx-auto w-full">
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
        `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold tracking-wide group transition-all duration-200 ${
          isActive
            ? 'text-gold bg-gold/8'
            : 'text-muted-2 hover:text-text hover:bg-bg-2/60'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Indicateur gauche actif */}
          {isActive && (
            <motion.span
              layoutId="desktop-nav-indicator"
              className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-gradient-to-b from-gold via-gold to-gold-dim"
              style={{ boxShadow: '0 0 12px rgba(255, 201, 74, 0.55)' }}
              transition={{ type: 'spring', stiffness: 520, damping: 38 }}
            />
          )}
          <Icon
            className={`w-[18px] h-[18px] transition-all ${
              isActive ? 'text-gold' : 'text-muted-2 group-hover:text-text'
            }`}
            strokeWidth={isActive ? 2.5 : 2}
          />
          <span className="flex-1">{label}</span>
          {badge > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              className="min-w-[18px] h-[18px] px-1 rounded-full bg-red text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-bg-1 tabular-nums"
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

function BrandMark() {
  return (
    <div className="relative w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 metal-plate-gold">
      <span className="font-display font-black text-[13px] tracking-tight text-[#3a1e00] relative z-10">
        42L
      </span>
    </div>
  );
}
