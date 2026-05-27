import { type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
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
  { to: '/trophees', labelKey: 'nav.trophees', icon: '🏆' },
  { to: '/profil', labelKey: 'nav.profil', icon: '◆' },
];

const NAV_SECONDARY: NavDef[] = [
  { to: '/historique', labelKey: 'nav.historique', icon: '▣' },
  { to: '/reglages', labelKey: 'nav.reglages', icon: '⚙' },
];

interface DesktopShellProps {
  children: ReactNode;
}

/**
 * Shell desktop : sidebar fixe à gauche + main content à droite.
 * Rendu uniquement pour les viewports >= lg via <ViewportSwitch>.
 * Extrait depuis l'ancien Layout.tsx, sans la partie mobile (déplacée dans MobileShell).
 */
export function DesktopShell({ children }: DesktopShellProps) {
  const t = useT();
  const { login } = useAuth();
  const { me, pending } = useLeagueData();
  const navigate = useNavigate();

  const pendingCount = pending.filter((p) => p.opponentLogin === me?.login).length;

  return (
    <div className="min-h-dvh flex flex-row">
      <aside className="flex flex-col w-60 border-r border-border bg-bg-1/60 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-border">
          <div className="text-base font-extrabold tracking-[0.22em] uppercase gradient-text-brand">
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
              <span className="flex-1">{t(n.labelKey)}</span>
              {n.to === '/defis' && pendingCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red text-white text-[10px] font-bold flex items-center justify-center animate-pop">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {pendingCount > 0 && (
          <button
            onClick={() => navigate('/defis')}
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

      <main className="flex-1 min-w-0 px-6 py-8 max-w-4xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
