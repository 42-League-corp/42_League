import { useEffect, useRef } from 'react';

/**
 * Fait tourner un élément (typiquement une photo de profil) sur lui-même en 3D
 * — comme une pièce de monnaie qu'on lance sur une table — en fonction de la
 * vitesse à laquelle la souris le survole.
 *
 * Le mouvement horizontal de la souris pendant le survol injecte de la vitesse
 * angulaire autour de l'axe VERTICAL (rotateY + perspective → la photo pivote en
 * profondeur, se rétrécit de profil puis revient de face). Une fois la souris
 * partie, la rotation continue par inertie (friction) puis, quand l'élan est
 * retombé, la photo REVIENT en douceur à sa position d'origine (de face).
 *
 * À brancher sur l'élément qui doit tourner (img / div), via la ref retournée.
 * N'interfère pas avec les transforms du parent (scale au hover, lévitation…) —
 * on n'écrit que sur l'élément ciblé.
 */
export function useFlickSpin<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Respecte la préférence d'accessibilité « réduire les animations ».
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let angle = 0; // degrés (rotateY)
    let velocity = 0; // degrés / frame
    let raf = 0;
    let running = false;

    const SENSITIVITY = 0.5; // px de souris -> deg/frame
    const FRICTION = 0.95; // décélération par frame
    const MAX_VELOCITY = 45; // garde-fou (deg/frame)
    const SETTLE_VELOCITY = 0.6; // sous ce seuil, on bascule en « retour maison »
    const RETURN_EASE = 0.14; // vitesse du retour vers la face d'origine
    const PERSPECTIVE = 520; // px — profondeur de la perspective 3D

    // Une pièce qui ralentit s'incline puis se couche : on ajoute un léger
    // basculement (rotateX) proportionnel à la vitesse, qui s'efface au repos.
    const apply = () => {
      const tilt = Math.min(Math.abs(velocity) * 0.18, 7);
      el.style.transform = `perspective(${PERSPECTIVE}px) rotateX(${tilt}deg) rotateY(${angle}deg)`;
    };

    const tick = () => {
      if (Math.abs(velocity) > SETTLE_VELOCITY) {
        // Phase élan : la pièce tourne librement et décélère par friction.
        angle += velocity;
        velocity *= FRICTION;
        apply();
        raf = requestAnimationFrame(tick);
        return;
      }
      // Phase retour : l'élan est mort → on ramène la photo à la face la plus
      // proche (multiple de 360°) en douceur, jusqu'à sa position d'origine.
      velocity = 0;
      const target = Math.round(angle / 360) * 360;
      angle += (target - angle) * RETURN_EASE;
      if (Math.abs(target - angle) < 0.4) {
        angle = 0; // normalise : visuellement identique à la face d'origine.
        el.style.transform = `perspective(${PERSPECTIVE}px) rotateX(0deg) rotateY(0deg)`;
        running = false;
        return;
      }
      apply();
      raf = requestAnimationFrame(tick);
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
    el.style.transformOrigin = 'center center';
    el.addEventListener('pointermove', onMove);
    return () => {
      el.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return ref;
}
