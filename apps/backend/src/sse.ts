import type { SSEStreamingApi } from 'hono/streaming';

export interface SseEvent {
  type: string;
  payload: unknown;
}

// login → active SSE connections for that user
const connections = new Map<string, Set<SSEStreamingApi>>();

export function registerSse(login: string, stream: SSEStreamingApi): () => void {
  if (!connections.has(login)) connections.set(login, new Set());
  const set = connections.get(login)!;
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
