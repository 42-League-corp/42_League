import { ViewportSwitch } from '../../shell/ViewportSwitch';
import { LeaderboardDesktop } from './LeaderboardDesktop';
import { LeaderboardMobile } from './LeaderboardMobile';

export function LeaderboardPage() {
  return (
    <ViewportSwitch
      mobile={<LeaderboardMobile />}
      desktop={<LeaderboardDesktop />}
    />
  );
}
