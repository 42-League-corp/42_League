import { Plus, Swords } from 'lucide-react';
import { BottomSheet } from '../../../mobile/primitives/BottomSheet';
import { BigActionButton } from './BigActionButton';
import { useT } from '../../../lib/i18n';

interface DefisFabMenuProps {
  open: boolean;
  onClose: () => void;
  onDeclare: () => void;
  onChallenge: () => void;
}

/**
 * Mini-menu déclenché par le FAB « + » : choix entre déclarer une game passée
 * ou défier un joueur. Ferme la sheet puis ouvre le flow choisi.
 */
export function DefisFabMenu({ open, onClose, onDeclare, onChallenge }: DefisFabMenuProps) {
  const t = useT();
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={<span className="gradient-text-brand">{t('defis.fab.title')}</span>}
      snap="auto"
    >
      <div className="px-5 pt-4 pb-6 space-y-3">
        <BigActionButton
          Icon={Plus}
          tone="amber"
          title={t('defis.cta.declarePast')}
          subtitle={t('defis.cta.declarePast.sub')}
          onClick={() => {
            onClose();
            onDeclare();
          }}
        />
        <BigActionButton
          Icon={Swords}
          tone="gold"
          title={t('defis.cta.challenge')}
          subtitle={t('defis.cta.challengeSub')}
          onClick={() => {
            onClose();
            onChallenge();
          }}
        />
      </div>
    </BottomSheet>
  );
}
