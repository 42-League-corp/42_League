import { useMemo } from 'react';
import { Panel } from '../../components/Panel';
import { PlayerLink } from '../../components/PlayerLink';
import { Avatar } from '../../components/Avatar';
import { OnlineBadge } from '../../components/OnlineBadge';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useT } from '../../lib/i18n';

/**
 * Vue desktop du leaderboard — tableau dense.
 * Identique à l'ancien LeaderboardPage, juste déplacée ici pour le pattern Split View.
 */
export function LeaderboardDesktop() {
  const t = useT();
  const { leaderboard, matches, me, allOps, locations } = useLeagueData();

  const winsLossesByLogin = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number }>();
    for (const u of leaderboard) map.set(u.login, { wins: 0, losses: 0 });
    for (const m of matches) {
      for (const login of [m.playerALogin, m.playerBLogin]) {
        const cur = map.get(login);
        if (!cur) continue;
        const isA = m.playerALogin === login;
        const won = (isA && m.winner === 'A') || (!isA && m.winner === 'B');
        if (won) cur.wins++;
        else cur.losses++;
      }
    }
    return map;
  }, [leaderboard, matches]);

  const myLogin = me?.login;

  // Online first, then matchesPlayed desc (ranks ELO restent affichés tels quels)
  const sortedLeaderboard = useMemo(() => {
    return [...leaderboard].sort((a, b) => {
      const aOnline = locations.has(a.login) ? 1 : 0;
      const bOnline = locations.has(b.login) ? 1 : 0;
      if (aOnline !== bOnline) return bOnline - aOnline;
      return b.matchesPlayed - a.matchesPlayed;
    });
  }, [leaderboard, locations]);

  return (
    <Panel
      title={t('panel.lb.title')}
      sub={`${leaderboard.length} ${t('panel.lb.sub')}`}
    >
      {leaderboard.length === 0 ? (
        <div className="text-center text-muted-2 py-10">{t('lb.empty')}</div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="font-gaming text-[10px] uppercase tracking-[0.18em] text-gold/80 font-extrabold border-b border-gold/20">
                <th className="text-left px-2 sm:px-3 py-2">#</th>
                <th className="text-left px-2 sm:px-3 py-2">{t('lb.col.player')}</th>
                <th className="text-right px-2 sm:px-3 py-2">{t('lb.col.elo')}</th>
                <th className="text-right px-1 sm:px-3 py-2 text-gold">{t('lb.col.w')}</th>
                <th className="text-right px-1 sm:px-3 py-2 text-red">{t('lb.col.l')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedLeaderboard.map((u) => {
                const wl = winsLossesByLogin.get(u.login) ?? { wins: 0, losses: 0 };
                const isMe = u.login === myLogin;
                const targetedBy = allOps.find((o) => o.targetLogin === u.login);
                const host = locations.get(u.login);
                const rankCls =
                  u.rank === 1
                    ? 'text-gold'
                    : u.rank === 2
                      ? 'text-muted-2'
                      : u.rank === 3
                        ? 'text-[#cd7f32]'
                        : 'text-muted';
                return (
                  <tr
                    key={u.login}
                    className={
                      'border-t border-gold/10 transition-colors ' +
                      (isMe ? 'bg-gold/[0.06] shadow-[inset_3px_0_0_0_rgba(255,201,74,0.7)]' : 'hover:bg-gold/[0.04]')
                    }
                  >
                    <td className={`px-2 sm:px-3 py-2.5 font-display font-black tabular-nums ${rankCls}`}>
                      #{u.rank}
                    </td>
                    <td className="px-2 sm:px-3 py-2.5">
                      <PlayerLink login={u.login}>
                        <div className="relative flex-shrink-0">
                          <Avatar login={u.login} imageUrl={u.imageUrl} size="sm" />
                          {host && (
                            <OnlineBadge host={host} compact className="absolute -bottom-0.5 -right-0.5" />
                          )}
                        </div>
                        <span className="truncate max-w-[120px] sm:max-w-none">
                          {u.login}
                        </span>
                        {targetedBy && (
                          <span
                            className="text-[9px] text-red font-bold uppercase ml-1"
                            title={`Ops de ${targetedBy.ownerLogin}`}
                          >
                            ☠
                          </span>
                        )}
                      </PlayerLink>
                      {host && (
                        <div className="ml-10 mt-0.5">
                          <OnlineBadge host={host} />
                        </div>
                      )}
                      {u.title && (
                        <div className="text-[10px] text-gold italic mt-0.5 ml-10 truncate">
                          « {u.title} »
                        </div>
                      )}
                    </td>
                    <td className="px-2 sm:px-3 py-2.5 text-right tabular-nums font-display font-extrabold text-gold" style={{ textShadow: '0 0 10px rgba(255,201,74,0.25)' }}>
                      {u.elo}
                    </td>
                    <td className="px-1 sm:px-3 py-2.5 text-right tabular-nums text-gold">
                      {wl.wins}
                    </td>
                    <td className="px-1 sm:px-3 py-2.5 text-right tabular-nums text-red">
                      {wl.losses}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
