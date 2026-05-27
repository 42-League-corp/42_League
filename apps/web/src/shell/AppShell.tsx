import type { ReactNode } from 'react';
import { DesktopShell } from './DesktopShell';
import { MobileShell } from './MobileShell';
import { ViewportSwitch } from './ViewportSwitch';

interface AppShellProps {
  children: ReactNode;
}

/**
 * Racine du chrome de l'app authentifiée.
 * Choisit Mobile ou Desktop selon le viewport.
 * Le contenu (les <Routes>) est passé en children — il est rendu une seule fois
 * et reçoit le bon wrapper.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <ViewportSwitch
      mobile={<MobileShell>{children}</MobileShell>}
      desktop={<DesktopShell>{children}</DesktopShell>}
    />
  );
}
