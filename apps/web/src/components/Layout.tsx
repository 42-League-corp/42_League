import { type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Avatar } from './Avatar';
import { NotifBanner } from './NotifBanner';
import { useAuth } from '../hooks/useAuth';
import { useLeagueData } from '../hooks/useLeagueData';
import { useT } from '../lib/i18n';

interface NavDef {
  to: string;
  labelKey: string;
  icon: string;
}

const NAV: NavDef[] = [
  { to: '/challenges', labelKey: 'nav.defis', icon: '⚔' },
  { to: '/tournaments', labelKey: 'nav.tournois', icon: '🏟' },
  { to: '/leaderboard', labelKey: 'nav.leaderboard', icon: '★' },
  { to: '/trophies', labelKey: 'nav.trophees', icon: '🏆' },
  { to: '/profile', labelKey: 'nav.profil', icon: '◆' },
];

const NAV_SECONDARY: NavDef[] = [
  { to: '/history', labelKey: 'nav.historique', icon: '▣' },
  { to: '/settings', labelKey: 'nav.reglages', icon: '⚙' },
];

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const t = useT();
  const { login } = useAuth();
  const { me, pending } = useLeagueData();
  const location = useLocation();
  const navigate = useNavigate();

  const pendingCount = pending.filter((p) => p.opponentLogin === me?.login).length;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Topbar mobile */}
      <header className="sticky top-0 z-30 lg:hidden flex items-center gap-3 px-4 py-3 border-b border-gold/20 glass">
        <NavLink to="/" aria-label="42 League">
          <h1 className="text-sm font-extrabold tracking-[0.22em] uppercase gradient-text-brand font-display">
            42 League
          </h1>
        </NavLink>
        <div className="flex-1" />
        {/* Notification bell mobile */}
        <NotifBell count={pendingCount} onClick={() => navigate('/challenges')} />
        {me?.user && (
          <NavLink to="/profile" className="flex items-center gap-2">
            <span className="text-xs text-muted-2 hidden sm:inline">{login}</span>
            <Avatar login={login ?? '?'} imageUrl={me.user.imageUrl} size="sm" />
          </NavLink>
        )}
      </header>

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex lg:flex-col w-60 border-r border-gold/20 bg-bg-1/80 sticky top-0 h-screen hud-grid">
        <NavLink to="/" className="block px-5 py-5 border-b border-gold/20" aria-label="42 League">
          <div className="text-base font-extrabold tracking-[0.22em] uppercase gradient-text-brand font-display">
            42 League
          </div>
          <div className="text-[10px] text-brass/80 mt-1 uppercase tracking-[0.2em] font-bold">
            Babyfoot · Ranked
          </div>
        </NavLink>
        <nav className="flex flex-col p-3 gap-1">
          {NAV.concat(NAV_SECONDARY).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded transition text-sm ` +
                (isActive
                  ? 'bg-teal-deep/20 text-teal font-semibold'
                  : 'text-muted-2 hover:text-text hover:bg-bg-2')
              }
            >
              <span className="text-base w-5 text-center">{n.icon}</span>
              <span className="flex-1">{t(n.labelKey)}</span>
              {/* Badge sur Défis */}
              {n.to === '/challenges' && pendingCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red text-white text-[10px] font-bold flex items-center justify-center animate-pop">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bannière d'alerte si games à confirmer */}
        {pendingCount > 0 && (
          <button
            onClick={() => navigate('/challenges')}
            className="mx-3 mb-3 p-3 rounded border border-gold/40 bg-gold/5 text-left hover:bg-gold/10 transition-colors animate-pop group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base animate-pulse">⚡</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gold">
                {pendingCount} game{pendingCount > 1 ? 's' : ''} à confirmer
              </span>
            </div>
            <div className="text-[10px] text-muted-2 group-hover:text-muted transition-colors">
              Un adversaire attend ta réponse →
            </div>
          </button>
        )}

        <div className="mt-auto p-3 border-t border-border">
          {me?.user ? (
            <NavLink to="/profile" className="flex items-center gap-2.5">
              <Avatar login={login ?? '?'} imageUrl={me.user.imageUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-text-strong truncate">
                  {login}
                </div>
                <div className="text-[10px] text-gold uppercase tracking-wider">
                  {me.user.elo} ELO
                </div>
              </div>
            </NavLink>
          ) : (
            <div className="text-xs text-muted-2">{t('auth.notConnected')}</div>
          )}
        </div>
      </aside>

      {/* Bannière de notifs temps réel (duels + scores à valider) */}
      <NotifBanner />

      {/* Contenu */}
      <main className="flex-1 min-w-0 px-3 sm:px-6 py-4 sm:py-8 pb-24 lg:pb-8 max-w-4xl mx-auto w-full">
        {children}
      </main>

      {/* Bottom nav mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-gold/20 glass-strong">
        {NAV.map((n) => {
          const active =
            location.pathname === n.to || location.pathname.startsWith(`${n.to}/`);
          return (
            <NavLink
              key={n.to}
              to={n.to}
              className={
                'relative flex flex-col items-center justify-center py-2 gap-0.5 transition ' +
                (active ? 'text-teal' : 'text-muted-2 hover:text-text')
              }
            >
              <span className="text-lg leading-none relative">
                {n.icon}
                {n.to === '/challenges' && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red text-white text-[8px] font-bold flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </span>
              <span className="text-[9px] uppercase tracking-wider font-bold">
                {t(n.labelKey)}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

function NotifBell({ count, onClick }: { count: number; onClick: () => void }) {
  if (count === 0) return null;
  return (
    <button
      onClick={onClick}
      className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-gold/10 transition-colors animate-pop"
      title={`${count} game${count > 1 ? 's' : ''} à confirmer`}
    >
      <span className="text-gold text-lg">🔔</span>
      <span className="absolute top-0 right-0 min-w-[16px] h-4 px-1 rounded-full bg-red text-white text-[9px] font-bold flex items-center justify-center">
        {count}
      </span>
    </button>
  );
}
