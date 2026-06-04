/**
 * RollingNumber — compteur à roulettes : chaque chiffre roule verticalement,
 * seuls ceux qui changent s'animent. Effet partagé entre la courbe ELO
 * (EloChart) et le sélecteur de joueurs (PlayerCountPicker).
 *
 * `up` force le sens de roulement ; sinon il est déduit de la variation.
 */
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

function RollDigit({ ch, up }: { ch: string; up: boolean }) {
  return (
    <span className="relative inline-block overflow-hidden align-baseline" style={{ height: '1em', width: ch === '1' ? '0.55em' : '0.62em' }}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={ch}
          className="absolute inset-0 flex items-center justify-center"
          initial={{ y: up ? '100%' : '-100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: up ? '-100%' : '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
        >
          {ch}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function RollingNumber({ value, up, className }: { value: number; up?: boolean; className?: string }) {
  const prev = useRef(value);
  const dir = up !== undefined ? up : value >= prev.current;
  useEffect(() => { prev.current = value; }, [value]);
  const chars = Math.round(value).toString().split('');
  return (
    <span className={`inline-flex tabular-nums ${className ?? ''}`}>
      {chars.map((c, i) => <RollDigit key={chars.length - 1 - i} ch={c} up={dir} />)}
    </span>
  );
}
