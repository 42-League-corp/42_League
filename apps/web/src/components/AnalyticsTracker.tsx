import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageview, installAnalyticsFlush } from '../lib/analytics';

// Replie les chemins à segment dynamique sur un motif stable, sinon le top des
// pages serait éclaté en une ligne par joueur / tournoi / équipe visité.
function normalizePath(pathname: string): string {
  if (/^\/player\/[^/]+$/.test(pathname)) return '/player/:login';
  if (/^\/team\/[^/]+$/.test(pathname)) return '/team/:teamId';
  // /tournaments/create est une vraie page distincte — on ne la replie pas.
  if (/^\/tournaments\/(?!create$)[^/]+$/.test(pathname)) return '/tournaments/:id';
  return pathname || '/';
}

/**
 * Émet une page vue à chaque changement de route. Monté dans la coquille
 * authentifiée : ne journalise donc que des sessions connectées.
 */
export function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    installAnalyticsFlush();
  }, []);

  useEffect(() => {
    trackPageview(normalizePath(location.pathname));
  }, [location.pathname]);

  return null;
}
