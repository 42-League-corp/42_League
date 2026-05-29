import { ViewportSwitch } from '../../shell/ViewportSwitch';
import { HistoriqueDesktop } from './HistoriqueDesktop';
import { HistoriqueMobile } from './HistoriqueMobile';

/**
 * Routeur Mobile/Desktop pour la page Historique.
 * Logique partagée via useHistoriqueLogic — chaque vue ne décrit que son rendu.
 */
export function HistoriquePage() {
  return <ViewportSwitch mobile={<HistoriqueMobile />} desktop={<HistoriqueDesktop />} />;
}
