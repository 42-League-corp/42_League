/**
 * Feedback haptique léger via navigator.vibrate.
 * Sur iOS Safari, vibrate est ignoré silencieusement (pas d'erreur).
 * Sur Android Chrome et Chrome desktop avec un device tactile, ça fonctionne.
 *
 * Pour iOS, l'effet "tactile" doit venir du visuel : scale au tap, micro-bounce,
 * couleur qui pulse — d'où l'importance des animations parallèles à useHaptic.
 */

export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 8,
  medium: 14,
  heavy: 22,
  selection: 6,
  success: [10, 40, 10],
  warning: [20, 60, 20],
  error: [40, 60, 40, 60, 40],
};

function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/**
 * Déclenche un feedback haptique. Safe à appeler partout —
 * no-op si pas supporté.
 */
export function haptic(pattern: HapticPattern = 'light'): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // ignore — certains browsers throw si vibrate appelé hors interaction utilisateur
  }
}

/**
 * Hook qui retourne une référence stable à `haptic`. Pratique pour le passer
 * en dépendance d'useCallback ou useEffect sans causer de re-render.
 */
export function useHaptic(): typeof haptic {
  return haptic;
}
