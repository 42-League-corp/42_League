/**
 * Déclencheur global de la cinématique « coup de foudre → VERSUS ».
 *
 * Quand on accepte un duel (ou qu'on en lance un), on veut une animation
 * spectaculaire en plusieurs temps : la foudre s'abat sur le bouton cliqué, puis
 * l'écran bascule en plein écran sur un gros « VS » façon jeu de combat.
 *
 * Comme l'action part d'une page (Défis) mais que l'overlay vit dans l'AppShell
 * (au-dessus de tout), on passe par un petit store hors-React (même pattern que
 * `gameMode`) : la page appelle `triggerDuelStrike(...)`, l'overlay s'abonne.
 */
import type { Game } from './gameMode';

export interface DuelStrike {
  /** Login du joueur courant (moi). */
  meLogin: string;
  /** Login de l'adversaire. */
  opponentLogin: string;
  /** Univers concerné (couleur de l'éclair + logo du VS). */
  game?: Game;
  /** Point d'impact de la foudre en pixels (centre du bouton cliqué). */
  origin?: { x: number; y: number };
  /** 'accept' (on accepte) ou 'challenge' (on lance le duel) — change le sous-titre. */
  kind: 'accept' | 'challenge';
  /** Identifiant unique pour re-déclencher même avec des données identiques. */
  nonce: number;
}

let current: DuelStrike | null = null;
const listeners = new Set<() => void>();

// Dernière position de pointeur (clic/tap) — sert de point d'impact par défaut
// pour que la foudre tombe pile là où on vient de cliquer, sans avoir à faire
// circuler l'évènement jusqu'au store.
let lastPointer: { x: number; y: number } | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (e) => {
      lastPointer = { x: e.clientX, y: e.clientY };
    },
    { capture: true, passive: true },
  );
}

export function getLastPointer(): { x: number; y: number } | undefined {
  return lastPointer ?? undefined;
}

export function getDuelStrike(): DuelStrike | null {
  return current;
}

/**
 * Lance la cinématique. `origin` se déduit au mieux de l'événement de clic pour
 * que la foudre frappe pile le bouton ; à défaut elle tombe au centre de l'écran.
 */
export function triggerDuelStrike(payload: Omit<DuelStrike, 'nonce'>): void {
  current = {
    ...payload,
    origin: payload.origin ?? lastPointer ?? undefined,
    nonce: Date.now() + Math.random(),
  };
  for (const l of listeners) l();
}

/** Extrait le centre (en px viewport) de l'élément ciblé par un évènement de clic. */
export function originFromEvent(e: { currentTarget?: EventTarget | null }): { x: number; y: number } | undefined {
  const el = e.currentTarget as HTMLElement | null | undefined;
  if (el && typeof el.getBoundingClientRect === 'function') {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  return undefined;
}

export function clearDuelStrike(): void {
  if (current === null) return;
  current = null;
  for (const l of listeners) l();
}

export function subscribeDuelStrike(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
