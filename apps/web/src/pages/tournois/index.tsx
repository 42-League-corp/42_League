import { ViewportSwitch } from '../../shell/ViewportSwitch';
import { TournoisDesktop } from './TournoisDesktop';
import { TournoisMobile } from './TournoisMobile';

export function TournoisPage() {
  return <ViewportSwitch mobile={<TournoisMobile />} desktop={<TournoisDesktop />} />;
}
