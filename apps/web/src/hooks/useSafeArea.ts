import { useEffect, useState } from 'react';

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const ZERO: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

function readInsets(): SafeAreaInsets {
  if (typeof window === 'undefined' || typeof getComputedStyle === 'undefined') {
    return ZERO;
  }
  // Lit les vraies valeurs CSS env(safe-area-inset-*) via une div sonde.
  // C'est le seul moyen fiable de récupérer ces valeurs en JS.
  const probe = document.getElementById('__safe-area-probe__') ?? createProbe();
  const style = getComputedStyle(probe);
  return {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
  };
}

function createProbe(): HTMLDivElement {
  const probe = document.createElement('div');
  probe.id = '__safe-area-probe__';
  probe.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:0',
    'height:0',
    'visibility:hidden',
    'pointer-events:none',
    'padding-top:env(safe-area-inset-top)',
    'padding-right:env(safe-area-inset-right)',
    'padding-bottom:env(safe-area-inset-bottom)',
    'padding-left:env(safe-area-inset-left)',
  ].join(';');
  document.body.appendChild(probe);
  return probe;
}

/**
 * Retourne les safe-area-insets en pixels. Utile quand on a besoin de calculer
 * un offset en JS (ex. position d'un Sheet draggable).
 * Pour du CSS pur, préférer les classes utilitaires Tailwind `pt-safe`, `pb-safe`, etc.
 */
export function useSafeArea(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>(ZERO);

  useEffect(() => {
    setInsets(readInsets());
    const onResize = () => setInsets(readInsets());
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return insets;
}
