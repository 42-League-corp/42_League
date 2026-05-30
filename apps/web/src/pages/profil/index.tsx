import { ViewportSwitch } from '../../shell/ViewportSwitch';
import { ProfilMobile } from './ProfilMobile';

/**
 * Profil — on réutilise la vue « mobile » (carte héro premium) aussi sur la
 * version web/desktop, centrée dans une colonne de largeur téléphone.
 */
export function ProfilPage() {
  return (
    <ViewportSwitch
      mobile={<ProfilMobile />}
      desktop={
        <div className="mx-auto w-full max-w-lg">
          <ProfilMobile />
        </div>
      }
    />
  );
}
