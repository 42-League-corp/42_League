import { useMemo, useRef, useState, type ReactNode } from 'react';
import { PlayerLink } from './PlayerLink';
import { Avatar } from './Avatar';
import { useLeagueData } from '../hooks/useLeagueData';
import { computeTrophies, type TrophyColor } from '../lib/trophies';

const COLOR_BORDER: Record<TrophyColor, string> = {
  gold: 'border-gold/40',
  red: 'border-red/40',
  cyan: 'border-teal/40',
  violet: 'border-[#a259ff]/40',
  magenta: 'border-[#ff3bd9]/40',
  bronze: 'border-[#cd7f32]/40',
  crimson: 'border-[#dc143c]/40',
  green: 'border-[#10b981]/40',
  sapphire: 'border-[#3b82f6]/40',
};

const COLOR_TEXT: Record<TrophyColor, string> = {
  gold: 'text-gold',
  red: 'text-red',
  cyan: 'text-[#f5b942]',
  violet: 'text-[#c97bff]',
  magenta: 'text-[#ff5bb0]',
  bronze: 'text-[#cd7f32]',
  crimson: 'text-[#dc143c]',
  green: 'text-[#7fd66e]',
  sapphire: 'text-[#7aa8ff]',
};

const COLOR_GLOW: Record<TrophyColor, string> = {
  gold: 'rgba(255,201,74,0.12)',
  red: 'rgba(255,83,102,0.1)',
  cyan: 'rgba(245,185,66,0.1)',
  violet: 'rgba(162,89,255,0.1)',
  magenta: 'rgba(255,59,217,0.1)',
  bronze: 'rgba(205,127,50,0.1)',
  crimson: 'rgba(220,20,60,0.1)',
  green: 'rgba(16,185,129,0.1)',
  sapphire: 'rgba(59,130,246,0.1)',
};

// ─── Tilt card wrapper ────────────────────────────────────────────────────────

function TiltCard({
  children,
  className,
  color,
}: {
  children: ReactNode;
  className: string;
  color: TrophyColor;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)');
  const [shine, setShine] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const tX = (y - 0.5) * -10;
    const tY = (x - 0.5) * 10;
    setTransform(`perspective(600px) rotateX(${tX}deg) rotateY(${tY}deg) scale(1.025)`);
    setShine({ x: x * 100, y: y * 100, opacity: 1 });
  };

  const handleMouseLeave = () => {
    setTransform('perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)');
    setShine((s) => ({ ...s, opacity: 0 }));
  };

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{ transform, transition: 'transform 0.12s ease-out', transformStyle: 'preserve-3d' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {/* Shine overlay */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${shine.x}% ${shine.y}%, ${COLOR_GLOW[color].replace('0.12', '0.22')} 0%, transparent 65%)`,
          opacity: shine.opacity,
          transition: 'opacity 0.25s ease',
        }}
      />
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

interface TrophiesSectionProps {
  title?: string;
}

export function TrophiesSection({ title = 'Trophées' }: TrophiesSectionProps) {
  const { leaderboard, matches } = useLeagueData();
  const trophies = useMemo(
    () => computeTrophies(leaderboard, matches),
    [leaderboard, matches],
  );

  if (trophies.length === 0) {
    return (
      <section className="mt-8 pt-6 border-t border-gold/15">
        <div className="font-gaming text-xs font-extrabold uppercase tracking-[0.18em] text-gold mb-2 flex items-center gap-2">
          <span>🏆</span>
          <span>{title}</span>
        </div>
        <div className="text-center text-muted-2 py-6 text-sm">
          Pas encore assez de matchs pour décerner des trophées.
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 pt-6 border-t border-gold/15">
      <div className="font-gaming text-xs font-extrabold uppercase tracking-[0.18em] text-gold mb-3 flex items-center gap-2">
        <span className="text-base">🏆</span>
        <span>{title}</span>
        <span className="text-[10px] text-muted font-semibold normal-case tracking-[0.12em]">
          · récompenses légendaires
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-gold/30 via-gold/10 to-transparent ml-2" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {trophies.map((t) => (
          <TiltCard
            key={t.title}
            color={t.color}
            className={`card-hud overflow-hidden hover-glow ${COLOR_BORDER[t.color]} rounded-xl p-4 flex flex-col gap-2`}
          >
            <div className="flex items-center gap-3">
              <div className="text-3xl leading-none">{t.emoji}</div>
              <div className="min-w-0">
                <div className={`text-xs font-extrabold uppercase tracking-wider ${COLOR_TEXT[t.color]}`}>
                  {t.title}
                </div>
                <div className="text-[10px] text-muted-2">{t.subtitle}</div>
              </div>
            </div>
            {t.winner ? (
              <PlayerLink login={t.winner.login}>
                <Avatar login={t.winner.login} imageUrl={t.winner.imageUrl} size="sm" />
                <span className="font-semibold">{t.winner.login}</span>
              </PlayerLink>
            ) : (
              <div className="text-text-strong font-semibold text-sm">{t.value}</div>
            )}
            <div className="flex items-center gap-2 mt-auto pt-1">
              {t.winner && (
                <span className={`text-sm font-extrabold ${COLOR_TEXT[t.color]}`}>
                  {t.value}
                </span>
              )}
              {t.hint && <span className="text-[10px] text-muted">{t.hint}</span>}
            </div>
          </TiltCard>
        ))}
      </div>
    </section>
  );
}
