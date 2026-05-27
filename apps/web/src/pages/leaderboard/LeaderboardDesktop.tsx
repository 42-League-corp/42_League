import { useMemo } from 'react';
import { Panel } from '../../components/Panel';
import { PlayerLink } from '../../components/PlayerLink';
import { Avatar } from '../../components/Avatar';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useT } from '../../lib/i18n';

/**
 * Vue desktop du leaderboard — tableau dense.
 * Identique à l'ancien LeaderboardPage, juste déplacée ici pour le pattern Split View.
 */
export function LeaderboardDesktop() {
  const t = useT();
  const { leaderboard, matches, me, allOps } = useLeagueData();

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
              <tr className="text-[10px] uppercase tracking-wider text-muted">
                <th className="text-left px-2 sm:px-3 py-2">#</th>
                <th className="text-left px-2 sm:px-3 py-2">{t('lb.col.player')}</th>
                <th className="text-right px-2 sm:px-3 py-2">{t('lb.col.elo')}</th>
                <th className="text-right px-1 sm:px-3 py-2 text-gold">{t('lb.col.w')}</th>
                <th className="text-right px-1 sm:px-3 py-2 text-red">{t('lb.col.l')}</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((u) => {
                const wl = winsLossesByLogin.get(u.login) ?? { wins: 0, losses: 0 };
                const isMe = u.login === myLogin;
                const targetedBy = allOps.find((o) => o.targetLogin === u.login);
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
                      'border-t border-border/50 ' +
                      (isMe ? 'bg-teal/[0.04]' : 'hover:bg-bg-2/40')
                    }
                  >
                    <td className={`px-2 sm:px-3 py-2.5 font-extrabold tabular-nums ${rankCls}`}>
                      #{u.rank}
                    </td>
                    <td className="px-2 sm:px-3 py-2.5">
                      <PlayerLink login={u.login}>
                        <Avatar login={u.login} imageUrl={u.imageUrl} size="sm" />
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
                      {u.title && (
                        <div className="text-[10px] text-gold italic mt-0.5 ml-10 truncate">
                          « {u.title} »
                        </div>
                      )}
                    </td>
                    <td className="px-2 sm:px-3 py-2.5 text-right tabular-nums text-teal font-bold">
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
