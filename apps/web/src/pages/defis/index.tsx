import { ViewportSwitch } from '../../shell/ViewportSwitch';
import { DefisDesktop } from './DefisDesktop';
import { DefisMobile } from './DefisMobile';

/**
 * Routeur Mobile/Desktop pour la page Défis.
 * La logique est partagée via useDefisLogic — chaque vue ne décrit que son rendu.
 */
export function DefisPage() {
  return <ViewportSwitch mobile={<DefisMobile />} desktop={<DefisDesktop />} />;
}
