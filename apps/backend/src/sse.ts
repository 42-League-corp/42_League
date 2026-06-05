import type { SSEStreamingApi } from 'hono/streaming';

export interface SseEvent {
  type: string;
  payload: unknown;
}

// login → active SSE connections for that user
const connections = new Map<string, Set<SSEStreamingApi>>();

// Plafond de flux SSE simultanés PAR utilisateur. Empêche l'épuisement du pool
// de sockets / de la mémoire serveur : sans borne, un client pouvait ouvrir des
// centaines de connexions /events jamais refermées (chaque broadcast itère alors
// sur toutes) et rendre le site indisponible. Les admins en sont exemptés
// (`unlimited`) pour tester librement (multi-onglets / outils).
const MAX_SSE_PER_LOGIN = 5;

export function registerSse(
  login: string,
  stream: SSEStreamingApi,
  opts: { unlimited?: boolean } = {},
): () => void {
  if (!connections.has(login)) connections.set(login, new Set());
  const set = connections.get(login)!;
  // Au-delà du plafond, on ferme la connexion la PLUS ANCIENNE (le Set conserve
  // l'ordre d'insertion) pour faire de la place — borne stricte par login.
  if (!opts.unlimited) {
    while (set.size >= MAX_SSE_PER_LOGIN) {
      const oldest = set.values().next().value as SSEStreamingApi | undefined;
      if (!oldest) break;
      set.delete(oldest);
      void oldest.close().catch(() => {});
    }
  }
  set.add(stream);
  return () => {
    set.delete(stream);
    if (set.size === 0) connections.delete(login);
  };
}

// Diffuse un événement à TOUS les utilisateurs connectés (ex. mise à jour du
// classement / des tournois qui concerne tout le monde, pas juste 2 joueurs).
export function broadcast(event: SseEvent): void {
  emit([...connections.keys()], event);
}

export function emit(logins: string[], event: SseEvent): void {
  const data = JSON.stringify(event.payload);
  for (const login of logins) {
    const set = connections.get(login);
    if (!set || set.size === 0) continue;
    for (const stream of [...set]) {
      stream.writeSSE({ event: event.type, data }).catch(() => {
        // Stream already closed — remove stale ref
        set.delete(stream);
        if (set.size === 0) connections.delete(login);
      });
    }
  }
}
