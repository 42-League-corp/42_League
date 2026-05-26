import { type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Avatar } from './Avatar';
import { useAuth } from '../hooks/useAuth';
import { useLeagueData } from '../hooks/useLeagueData';
import { useT } from '../lib/i18n';

interface NavDef {
  to: string;
  labelKey: string;
  icon: string;
}

const NAV: NavDef[] = [
  { to: '/defis', labelKey: 'nav.defis', icon: '⚔' },
  { to: '/tournois', labelKey: 'nav.tournois', icon: '🏟' },
  { to: '/leaderboard', labelKey: 'nav.leaderboard', icon: '★' },
  { to: '/profil', labelKey: 'nav.profil', icon: '◆' },
];

const NAV_SECONDARY: NavDef[] = [
  { to: '/historique', labelKey: 'nav.historique', icon: '▣' },
  { to: '/reglages', labelKey: 'nav.reglages', icon: '⚙' },
];

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const t = useT();
  const { login } = useAuth();
  const { me } = useLeagueData();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Topbar (toujours visible) */}
      <header className="sticky top-0 z-30 lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-bg-1/95 backdrop-blur">
        <h1 className="text-sm font-extrabold tracking-[0.22em] uppercase bg-gradient-to-r from-teal via-white to-gold bg-clip-text text-transparent">
          42 League
        </h1>
        <div className="flex-1" />
        {me?.user && (
          <NavLink to="/profil" className="flex items-center gap-2">
            <span className="text-xs text-muted-2 hidden sm:inline">{login}</span>
            <Avatar login={login ?? '?'} imageUrl={me.user.imageUrl} size="sm" />
          </NavLink>
        )}
      </header>

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex lg:flex-col w-60 border-r border-border bg-bg-1/60 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-border">
          <div className="text-base font-extrabold tracking-[0.22em] uppercase bg-gradient-to-r from-teal via-white to-gold bg-clip-text text-transparent">
            42 League
          </div>
          <div className="text-[10px] text-muted-2 mt-1 uppercase tracking-[0.2em]">
            Babyfoot · Ranked
          </div>
        </div>
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
              <span>{t(n.labelKey)}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto p-3 border-t border-border">
          {me?.user ? (
            <NavLink to="/profil" className="flex items-center gap-2.5">
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

      {/* Contenu */}
      <main className="flex-1 min-w-0 px-3 sm:px-6 py-4 sm:py-8 pb-24 lg:pb-8 max-w-4xl mx-auto w-full">
        {children}
      </main>

      {/* Bottom nav mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 border-t border-border bg-bg-1/95 backdrop-blur">
        {NAV.map((n) => {
          const active =
            location.pathname === n.to || location.pathname.startsWith(`${n.to}/`);
          return (
            <NavLink
              key={n.to}
              to={n.to}
              className={
                'flex flex-col items-center justify-center py-2 gap-0.5 transition ' +
                (active ? 'text-teal' : 'text-muted-2 hover:text-text')
              }
            >
              <span className="text-lg leading-none">{n.icon}</span>
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
