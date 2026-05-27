import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Swords, Trophy, BarChart3, Award, User } from 'lucide-react';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useT } from '../../lib/i18n';
import { haptic } from '../feedback/useHaptic';

interface TabDef {
  to: string;
  labelKey: string;
  Icon: typeof Swords;
}

const TABS: TabDef[] = [
  { to: '/defis', labelKey: 'nav.defis', Icon: Swords },
  { to: '/tournois', labelKey: 'nav.tournois', Icon: Trophy },
  { to: '/leaderboard', labelKey: 'nav.leaderboard', Icon: BarChart3 },
  { to: '/trophees', labelKey: 'nav.trophees', Icon: Award },
  { to: '/profil', labelKey: 'nav.profil', Icon: User },
];

function activeIndex(pathname: string): number {
  return TABS.findIndex(
    (t) => pathname === t.to || pathname.startsWith(`${t.to}/`),
  );
}

/**
 * Bottom tab bar premium :
 * - Glassmorphism + safe-area-bottom
 * - Indicateur fluide qui glisse entre les tabs (layoutId framer-motion)
 * - Bounce sur l'icône active (key-driven re-mount)
 * - Badge animé sur Défis
 * - Haptique au tap
 * - Tap-highlight transparent + scale au press
 */
export function MobileTabBar() {
  const t = useT();
  const location = useLocation();
  const { me, pending } = useLeagueData();
  const pendingCount = pending.filter((p) => p.opponentLogin === me?.login).length;

  const idx = activeIndex(location.pathname);
  const navRef = useRef<HTMLElement>(null);
  // Largeur calculée du highlight : permet à la position de coller pile à la cellule
  // sans dépendre des % et de la responsivité interne du flex.
  const [tabWidth, setTabWidth] = useState(0);

  useEffect(() => {
    const measure = () => {
      const w = navRef.current?.offsetWidth ?? 0;
      setTabWidth(w / TABS.length);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return (
    <nav
      ref={navRef}
      className="fixed bottom-0 left-0 right-0 z-40 glass-strong border-t border-border/60 no-select"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navigation principale"
    >
      {/* Filet doré décoratif en haut */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent pointer-events-none" />

      {/* Indicateur fluide qui se déplace */}
      {idx >= 0 && tabWidth > 0 && (
        <motion.div
          className="absolute top-0 h-[2px] bg-gradient-to-r from-gold via-gold to-gold-dim"
          initial={false}
          animate={{ x: idx * tabWidth, width: tabWidth }}
          transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.6 }}
          style={{
            boxShadow: '0 0 14px rgba(255,201,74,0.7), 0 0 28px rgba(255,201,74,0.35)',
          }}
        />
      )}

      <div className="flex h-[60px] items-stretch">
        {TABS.map((tab, i) => {
          const active = i === idx;
          const showBadge = tab.to === '/defis' && pendingCount > 0;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              onClick={() => haptic(active ? 'selection' : 'light')}
              className={`relative flex flex-col items-center justify-center flex-1 gap-0.5 tap-transparent transition-colors ${
                active ? 'text-gold' : 'text-muted-2 active:text-text'
              }`}
              aria-label={t(tab.labelKey)}
            >
              {/* Halo de fond au tap actif */}
              {active && (
                <motion.div
                  layoutId="tab-halo"
                  className="absolute inset-x-3 inset-y-1.5 rounded-xl bg-gradient-to-b from-gold/15 to-gold/5 border border-gold/25"
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                  style={{ boxShadow: 'inset 0 1px 0 rgba(255,215,120,0.15)' }}
                />
              )}

              {/* Icône */}
              <motion.div
                key={active ? `${tab.to}-on` : `${tab.to}-off`}
                initial={active ? { scale: 0.7, y: 4 } : false}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 600, damping: 22 }}
                className="relative"
              >
                <tab.Icon
                  className="w-[22px] h-[22px]"
                  strokeWidth={active ? 2.5 : 2}
                  fill={active ? 'rgba(255,201,74,0.22)' : 'transparent'}
                />
                <AnimatePresence>
                  {showBadge && (
                    <motion.span
                      key={pendingCount}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 600, damping: 20 }}
                      className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red text-white text-[9px] font-extrabold flex items-center justify-center ring-2 ring-bg-1 tabular-nums"
                    >
                      {pendingCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Label */}
              <span
                className={`font-gaming text-[9px] uppercase tracking-[0.14em] font-extrabold leading-none transition-all ${
                  active ? 'opacity-100' : 'opacity-70'
                }`}
              >
                {t(tab.labelKey)}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
