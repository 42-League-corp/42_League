// Télémétrie d'usage produit — alimente l'onglet STATS du panneau GOD.
//
// File d'attente en mémoire + envoi groupé : on n'émet jamais une requête par
// clic. Flush déclenché par taille de lot, par minuterie, et au départ de page
// (visibilitychange/pagehide) via fetch keepalive — `sendBeacon` ne pourrait pas
// porter le Bearer, dont le backend a besoin pour rattacher l'événement au login.
//
// Best-effort de bout en bout : toute erreur réseau est silencieuse, la
// télémétrie ne doit jamais dégrader l'expérience.
import { getApiBase } from './config';
import { getToken } from './storage';
import { api, type TrackEventInput } from './api';
import type { Game } from './gameMode';

const FLUSH_DELAY_MS = 5000;
const MAX_QUEUE = 25;

let queue: TrackEventInput[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, FLUSH_DELAY_MS);
}

/** Vide la file vers le backend. `keepalive` pour le flush au départ de page. */
export async function flush(keepalive = false): Promise<void> {
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (keepalive) {
    const token = getToken();
    if (!token) return;
    try {
      await fetch(`${getApiBase()}/analytics/track`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      });
    } catch {
      /* best-effort */
    }
    return;
  }
  await api.trackAnalytics(batch);
}

function enqueue(event: TrackEventInput): void {
  queue.push(event);
  if (queue.length >= MAX_QUEUE) void flush();
  else scheduleFlush();
}

/** Journalise une page vue (chemin de route normalisé). */
export function trackPageview(path: string, game?: Game | null): void {
  enqueue({ type: 'pageview', name: path, game: game ?? null });
}

/** Journalise une interaction (id de bouton/fonctionnalité, ex. 'match.declare'). */
export function trackEvent(name: string, game?: Game | null): void {
  enqueue({ type: 'event', name, game: game ?? null });
}

let flushInstalled = false;
/** Installe (une seule fois) le flush au départ de page. */
export function installAnalyticsFlush(): void {
  if (flushInstalled || typeof document === 'undefined') return;
  flushInstalled = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush(true);
  });
  window.addEventListener('pagehide', () => void flush(true));
}
