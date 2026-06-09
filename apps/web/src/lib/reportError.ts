import { api } from './api';

// Anti-spam : on n'envoie pas deux fois le même message dans une courte fenêtre, et on
// borne le débit global (une boucle de rendu en erreur ne doit pas noyer Discord).
const WINDOW_MS = 5000;
let lastSentAt = 0;
const recent = new Map<string, number>();

function pruneRecent(now: number) {
  for (const [k, t] of recent) {
    if (now - t > 60_000) recent.delete(k);
  }
}

/**
 * Remonte une erreur survenue côté client (écran TV live surtout) vers le backend, qui
 * la relaie sur Discord. Totalement best-effort : jamais d'exception propagée, throttlé
 * et dédupliqué. À appeler depuis les `catch` critiques et l'`ErrorBoundary` de la page
 * live — l'utilisateur ne voit rien, l'incident part en arrière-plan.
 */
export function reportError(err: unknown, context?: string): void {
  try {
    const message =
      err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
    if (!message) return;
    const now = Date.now();
    pruneRecent(now);
    const key = `${context ?? ''}|${message}`;
    if (recent.has(key) && now - (recent.get(key) ?? 0) < WINDOW_MS) return;
    if (now - lastSentAt < 1000) return; // au plus ~1 envoi/s tous messages confondus
    recent.set(key, now);
    lastSentAt = now;
    void api
      .reportClientError({
        message: message.slice(0, 500),
        context: context?.slice(0, 200),
        stack: err instanceof Error ? err.stack?.slice(0, 2000) : undefined,
      })
      .catch(() => {});
  } catch {
    // Le reporting d'erreur ne doit JAMAIS générer une nouvelle erreur visible.
  }
}
