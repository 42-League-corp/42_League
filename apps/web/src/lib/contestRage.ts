// Petit bus d'événement pour l'animation « rage » de contestation.
//
// Deux écrans doivent réagir quand une game est contestée :
//   • le CONTESTEUR (sender) — déclenché localement au succès de l'appel API
//     (rejectMatch / contestFfa / contestDarts), voir lib/api.ts ;
//   • le CONTESTÉ (receiver) — déclenché à la réception de l'event SSE
//     (match:rejected / ffa:contested / darts:contested), voir
//     components/ContestRageOverlay.tsx.
//
// On passe par un CustomEvent DOM global plutôt qu'un contexte React : ça permet
// de le déclencher depuis la couche API (hors de l'arbre React) sans couplage.

export type ContestRageRole = 'sender' | 'receiver';

export const CONTEST_RAGE_EVENT = 'contest:rage';

export function fireContestRage(role: ContestRageRole = 'sender'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CONTEST_RAGE_EVENT, { detail: { role } }));
}
