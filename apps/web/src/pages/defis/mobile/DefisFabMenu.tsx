import { Plus, Swords } from 'lucide-react';
import { BottomSheet } from '../../../mobile/primitives/BottomSheet';
import { BigActionButton } from './BigActionButton';

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
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={<span className="gradient-text-brand">Nouvelle action</span>}
      snap="auto"
    >
      <div className="px-5 pt-4 pb-6 space-y-3">
        <BigActionButton
          Icon={Plus}
          tone="amber"
          title="Déclarer une game"
          subtitle="Game déjà jouée · 2 clics"
          accessory={
            <>
              <span aria-hidden className="text-gold/80"></span>
              <span aria-hidden className="text-muted-2"></span>
            </>
          }
          onClick={() => {
            onClose();
            onDeclare();
          }}
        />
        <BigActionButton
          Icon={Swords}
          tone="gold"
          title="Défier un joueur"
          subtitle="Programme un duel à venir"
          accessory={<span aria-hidden className="text-gold/80"></span>}
          onClick={() => {
            onClose();
            onChallenge();
          }}
        />
      </div>
    </BottomSheet>
  );
}
