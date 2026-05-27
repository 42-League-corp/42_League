import { ViewportSwitch } from '../../shell/ViewportSwitch';
import { ProfilDesktop } from './ProfilDesktop';
import { ProfilMobile } from './ProfilMobile';

export function ProfilPage() {
  return <ViewportSwitch mobile={<ProfilMobile />} desktop={<ProfilDesktop />} />;
}
