import { useEffect, useRef } from 'react';

/**
 * Fait tourner un élément (typiquement une photo de profil) en fonction de la
 * vitesse à laquelle la souris le survole — comme si on lançait une toupie.
 *
 * Le mouvement horizontal de la souris pendant le survol injecte de la vitesse
 * angulaire ; une fois la souris partie, la rotation continue puis ralentit par
 * inertie (friction) jusqu'à s'arrêter.
 *
 * À brancher sur l'élément qui doit tourner (img / div), via la ref retournée.
 * N'interfère pas avec les transforms du parent (scale au hover, lévitation…).
 */
export function useFlickSpin<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Respecte la préférence d'accessibilité « réduire les animations ».
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let angle = 0; // degrés
    let velocity = 0; // degrés / frame
    let raf = 0;
    let running = false;

    const SENSITIVITY = 0.45; // px de souris -> deg/frame
    const FRICTION = 0.94; // décélération par frame
    const MAX_VELOCITY = 45; // garde-fou (deg/frame)
    const MIN_VELOCITY = 0.05; // seuil d'arrêt

    const tick = () => {
      angle += velocity;
      velocity *= FRICTION;
      el.style.transform = `rotate(${angle}deg)`;
      if (Math.abs(velocity) > MIN_VELOCITY) {
        raf = requestAnimationFrame(tick);
      } else {
        running = false;
      }
    };

    const onMove = (e: PointerEvent) => {
      velocity += e.movementX * SENSITIVITY;
      if (velocity > MAX_VELOCITY) velocity = MAX_VELOCITY;
      else if (velocity < -MAX_VELOCITY) velocity = -MAX_VELOCITY;
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };

    el.style.willChange = 'transform';
    el.addEventListener('pointermove', onMove);
    return () => {
      el.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return ref;
}
