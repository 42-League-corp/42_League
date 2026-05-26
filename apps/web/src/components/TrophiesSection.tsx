import { useMemo } from 'react';
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
  cyan: 'text-teal',
  violet: 'text-[#a259ff]',
  magenta: 'text-[#ff3bd9]',
  bronze: 'text-[#cd7f32]',
  crimson: 'text-[#dc143c]',
  green: 'text-[#10b981]',
  sapphire: 'text-[#3b82f6]',
};

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
      <section className="mt-8 pt-6 border-t border-border">
        <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-text-strong mb-2 flex items-center gap-2">
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
    <section className="mt-8 pt-6 border-t border-border">
      <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-text-strong mb-3 flex items-center gap-2">
        <span>🏆</span>
        <span>{title}</span>
        <span className="text-[10px] text-muted font-semibold normal-case tracking-[0.12em]">
          · récompenses légendaires
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {trophies.map((t) => (
          <div
            key={t.title}
            className={`bg-bg-2/60 border ${COLOR_BORDER[t.color]} rounded p-4 flex flex-col gap-2`}
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
          </div>
        ))}
      </div>
    </section>
  );
}
