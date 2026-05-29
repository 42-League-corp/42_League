import { useMemo, useState } from 'react';
import { Panel } from '../../components/Panel';
import { SegmentedControl, type SegmentChoice } from '../../mobile/primitives/SegmentedControl';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useI18n, useT } from '../../lib/i18n';
import { useHistoriqueLogic } from './shared/useHistoriqueLogic';
import { HistoriqueList, type HistoTab } from './shared/HistoriqueList';

export function HistoriqueDesktop() {
  const t = useT();
  const { lang } = useI18n();
  const data = useHistoriqueLogic();
  const { leaderboard } = useLeagueData();
  const [tab, setTab] = useState<HistoTab>('global');

  const imgByLogin = useMemo(
    () => new Map(leaderboard.map((u) => [u.login, u.imageUrl] as const)),
    [leaderboard],
  );

  const choices: SegmentChoice<HistoTab>[] = [
    { value: 'global', label: t('history.tab.global'), badge: data.global.length },
    { value: 'mine', label: t('history.tab.mine'), badge: data.mine.length },
  ];

  return (
    <Panel
      title={t('panel.history.title')}
      sub={tab === 'mine' ? t('history.mine.sub') : t('history.global.sub')}
    >
      <div className="mb-5 max-w-xs">
        <SegmentedControl<HistoTab> value={tab} onChange={setTab} choices={choices} />
      </div>

      <div className="max-w-xl">
        <HistoriqueList
          tab={tab}
          data={data}
          imgByLogin={imgByLogin}
          lang={lang}
          emptyText={tab === 'mine' ? t('history.empty.mine') : t('history.empty')}
        />
      </div>
    </Panel>
  );
}
