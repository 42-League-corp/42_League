import { Panel } from '../components/Panel';
import { PlayerLink } from '../components/PlayerLink';
import { useLeagueData } from '../hooks/useLeagueData';
import { useI18n, useT } from '../lib/i18n';
import { fmtDate } from '../lib/format';

export function HistoriquePage() {
  const t = useT();
  const { locale } = useI18n();
  const { matches, me } = useLeagueData();
  const myLogin = me?.login;
  const mine = matches
    .filter((m) => m.playerALogin === myLogin || m.playerBLogin === myLogin)
    .slice(0, 50);

  return (
    <Panel title={t('panel.history.title')} sub={t('panel.history.sub')}>
      {mine.length === 0 ? (
        <div className="text-center text-muted-2 py-10">{t('history.empty')}</div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted">
                <th className="text-left px-2 sm:px-3 py-2">{t('history.col.date')}</th>
                <th className="text-left px-2 sm:px-3 py-2">{t('history.col.opp')}</th>
                <th className="text-right px-2 sm:px-3 py-2">{t('history.col.score')}</th>
                <th className="text-right px-2 sm:px-3 py-2">{t('history.col.result')}</th>
                <th className="text-right px-2 sm:px-3 py-2">{t('history.col.delta')}</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((m) => {
                const youAreA = m.playerALogin === myLogin;
                const won = (youAreA && m.winner === 'A') || (!youAreA && m.winner === 'B');
                const opponent = youAreA ? m.playerBLogin : m.playerALogin;
                const sYou = youAreA ? m.scoreA : m.scoreB;
                const sOpp = youAreA ? m.scoreB : m.scoreA;
                const delta = youAreA ? m.deltaA : m.deltaB;
                const deltaCls =
                  delta > 0 ? 'text-gold' : delta < 0 ? 'text-red' : 'text-muted-2';
                return (
                  <tr
                    key={m.id}
                    className={
                      'border-t border-border/50 ' +
                      (m.countedForElo ? '' : 'opacity-60')
                    }
                  >
                    <td className="px-2 sm:px-3 py-2.5 text-muted-2 text-xs">
                      {fmtDate(m.playedAt, locale)}
                    </td>
                    <td className="px-2 sm:px-3 py-2.5">
                      <PlayerLink login={opponent}>{opponent}</PlayerLink>
                    </td>
                    <td className="px-2 sm:px-3 py-2.5 text-right tabular-nums">
                      {sYou}–{sOpp}
                    </td>
                    <td
                      className={`px-2 sm:px-3 py-2.5 text-right text-[10px] uppercase tracking-wider font-extrabold ${won ? 'text-gold' : 'text-red'}`}
                    >
                      {won ? t('history.win') : t('history.loss')}
                    </td>
                    <td className={`px-2 sm:px-3 py-2.5 text-right tabular-nums font-bold ${deltaCls}`}>
                      {m.countedForElo ? `${delta >= 0 ? '+' : ''}${delta}` : '—'}
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
