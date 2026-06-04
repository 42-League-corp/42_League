import { Panel } from '../components/Panel';
import { TrophiesSection } from '../components/TrophiesSection';
import { useT } from '../lib/i18n';

export function TropheesPage() {
  const t = useT();
  return (
    <Panel title={t('trophy.title')} sub={t('trophy.sub')} accent="medal">
      <TrophiesSection title="" />
    </Panel>
  );
}
