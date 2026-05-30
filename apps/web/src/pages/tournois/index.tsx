import { ViewportSwitch } from '../../shell/ViewportSwitch';
import { TournoisDesktop } from './TournoisDesktop';

// Sur mobile, on réutilise la version web des tournois (mêmes fonctionnalités et
// même présentation, responsive) plutôt qu'une vue mobile dédiée.
export function TournoisPage() {
  return <ViewportSwitch mobile={<TournoisDesktop />} desktop={<TournoisDesktop />} />;
}
