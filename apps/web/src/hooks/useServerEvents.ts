import { useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { getApiBase } from '../lib/config';
import { getToken } from '../lib/storage';

/**
 * S'abonne au flux SSE `/events` et appelle `onEvent` (debouncé) à chaque
 * événement dont le type figure dans `types`.
 *
 * Conçu pour des vues qui veulent se rafraîchir en temps réel sans passer par
 * le contexte global `useLeagueData` (ex. le GOD panel, qui a son propre state
 * local par onglet).
 *
 * Sécurité : l'URL du flux porte un token en query string (EventSource ne peut
 * pas envoyer de header Authorization). On n'y met JAMAIS le Bearer 30 jours —
 * une query string fuite dans les logs / l'historique / le header Referer. On
 * échange d'abord le Bearer contre un token éphémère de scope SSE
 * (GET /auth/stream-token, TTL ~60 s) et c'est lui qu'on passe en ?token=.
 *
 * Comme ce token est court, on gère la reconnexion nous-mêmes : à chaque coupure
 * on redemande un token frais et on rouvre l'EventSource (l'auto-reconnexion
 * native rejouerait la même URL avec un token expiré).
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
    if (!getToken()) return;

    let closed = false;
    let es: EventSource | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let backoffMs = 1000;

    const fire = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => cbRef.current(), debounceMs);
    };

    const scheduleReconnect = () => {
      if (closed || reconnect) return;
      reconnect = setTimeout(() => {
        reconnect = undefined;
        void connect();
      }, backoffMs);
      // Backoff plafonné : évite de marteler le serveur s'il est down.
      backoffMs = Math.min(backoffMs * 2, 30_000);
    };

    const connect = async () => {
      if (closed) return;
      let streamToken: string;
      try {
        ({ token: streamToken } = await api.streamToken());
      } catch {
        // Bearer invalide/expiré ou serveur indispo → on retente plus tard.
        scheduleReconnect();
        return;
      }
      if (closed) return;

      const url = `${getApiBase()}/events?token=${encodeURIComponent(streamToken)}`;
      es = new EventSource(url);

      es.addEventListener('open', () => {
        backoffMs = 1000; // connexion saine → on réinitialise le backoff.
      });
      for (const type of typesKey.split(',')) {
        es.addEventListener(type, fire);
      }
      es.onerror = () => {
        // EventSource tenterait de rejouer la MÊME URL (token bientôt expiré) :
        // on coupe et on rouvre avec un token frais.
        es?.close();
        es = undefined;
        scheduleReconnect();
      };
    };

    void connect();

    return () => {
      closed = true;
      if (debounce) clearTimeout(debounce);
      if (reconnect) clearTimeout(reconnect);
      es?.close();
    };
  }, [enabled, typesKey, debounceMs]);
}
