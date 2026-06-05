import { useEffect } from 'react';

/**
 * Ferme une fenêtre/modale quand l'utilisateur appuie sur Échap.
 *
 * @param active  La modale est-elle ouverte ? (si false, aucun listener n'est posé)
 * @param onClose Callback de fermeture (ex: () => setOpen(false))
 */
export function useEscapeKey(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [active, onClose]);
}
