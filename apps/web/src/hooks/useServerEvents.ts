import { useEffect, useRef } from 'react';
import { getApiBase } from '../lib/config';
import { getToken } from '../lib/storage';

/**
 * S'abonne au flux SSE `/events` et appelle `onEvent` (debouncé) à chaque
 * événement dont le type figure dans `types`.
 *
 * Conçu pour des vues qui veulent se rafraîchir en temps réel sans passer par
 * le contexte global `useLeagueData` (ex. le GOD panel, qui a son propre state
 * local par onglet). EventSource se reconnecte automatiquement en cas de coupure.
 *
 * Le callback est conservé dans une ref → changer son identité entre deux
 * rendus NE relance PAS la connexion (seul `types` / `enabled` le font).
 */
export function useServerEvents(
  onEvent: () => void,
  types: string[],
  { enabled = true, debounceMs = 300 }: { enabled?: boolean; debounceMs?: number } = {},
) {
  const cbRef = useRef(onEvent);
  useEffect(() => {
    cbRef.current = onEvent;
  }, [onEvent]);

  // Clé stable : évite de relancer la connexion si l'appelant passe un nouveau
  // tableau à chaque rendu mais avec le même contenu.
  const typesKey = types.join(',');

  useEffect(() => {
    if (!enabled) return;
    const token = getToken();
    if (!token) return;

    const url = `${getApiBase()}/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cbRef.current(), debounceMs);
    };

    const handlers = typesKey.split(',').map((type) => {
      const handler = () => fire();
      es.addEventListener(type, handler);
      return [type, handler] as const;
    });

    return () => {
      if (timer) clearTimeout(timer);
      for (const [type, handler] of handlers) es.removeEventListener(type, handler);
      es.close();
    };
  }, [enabled, typesKey, debounceMs]);
}
