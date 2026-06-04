/**
 * PlayerCountPicker — sélecteur de nombre de joueurs « règle » horizontale.
 *
 * Un seul contrôle unifié :
 *  - grand compteur à roulettes (même effet que la courbe ELO — RollingNumber)
 *  - piste graduée continue : on attrape le curseur doré et il suit le doigt /
 *    la souris en temps réel (plus de scroll-snap qui « accroche »)
 *  - la valeur s'aimante à l'entier le plus proche (haptique à chaque cran)
 *  - quelques tailles « rondes » cliquables (8 / 16 / 32…) sous la piste
 */
import { useCallback, useRef } from 'react';
import { haptic } from '../mobile/feedback/useHaptic';
import { RollingNumber } from './RollingNumber';

interface PlayerCountPickerProps {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  /** Tailles « rondes » proposées en accès rapide sous la piste. */
  presets?: number[];
  /** Libellé court sous le grand nombre (ex. « joueurs »). */
  label?: string;
}

export function PlayerCountPicker({
  value,
  onChange,
  min = 6,
  max = 32,
  presets = [8, 16, 24, 32],
  label = 'joueurs',
}: PlayerCountPickerProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const current = clamp(value);
  const span = Math.max(1, max - min);
  const pct = ((current - min) / span) * 100;

  // position pointeur → valeur (continue, arrondie au cran le plus proche)
  const valueFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return current;
      const r = el.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      return clamp(Math.round(min + f * span));
    },
    [current, min, span, max], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const setFromClientX = useCallback(
    (clientX: number) => {
      const v = valueFromClientX(clientX);
      if (v !== value) {
        onChange(v);
        haptic('selection');
      }
    },
    [valueFromClientX, value, onChange],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    setFromClientX(e.clientX);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const dir = (e.deltaY || e.deltaX) > 0 ? 1 : -1;
    step(dir);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); step(1); }
    else if (e.key === 'Home') { e.preventDefault(); if (current !== min) { onChange(min); haptic('selection'); } }
    else if (e.key === 'End') { e.preventDefault(); if (current !== max) { onChange(max); haptic('selection'); } }
  };

  const step = (d: number) => {
    const v = clamp(current + d);
    if (v !== current) { onChange(v); haptic('selection'); }
  };

  // crans visibles : on n'affiche que les majeurs/mid pour ne pas charger la piste
  const ticks: number[] = [];
  for (let v = min; v <= max; v++) ticks.push(v);

  return (
    <div className="select-none rounded-xl border border-border bg-bg-1/60 px-3 pt-3 pb-2.5">
      {/* Grand compteur à roulettes + steppers */}
      <div className="flex items-center justify-center gap-4 mb-3">
        <button type="button" onClick={() => step(-1)} aria-label="−1"
          className="grid place-items-center w-7 h-7 rounded-lg border border-border text-muted-2 hover:text-gold hover:border-gold/40 active:scale-90 transition-all">
          <span className="text-base font-black leading-none">−</span>
        </button>
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-4xl font-black tabular-nums text-gold-emboss leading-none">
            <RollingNumber value={current} />
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted font-extrabold">{label}</span>
        </div>
        <button type="button" onClick={() => step(1)} aria-label="+1"
          className="grid place-items-center w-7 h-7 rounded-lg border border-border text-muted-2 hover:text-gold hover:border-gold/40 active:scale-90 transition-all">
          <span className="text-base font-black leading-none">+</span>
        </button>
      </div>

      {/* Piste continue */}
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={current}
        className="relative h-10 cursor-grab active:cursor-grabbing touch-none outline-none focus-visible:ring-2 focus-visible:ring-gold/40 rounded-lg"
        style={{ touchAction: 'none' }}
      >
        {/* graduations */}
        <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 h-5">
          {ticks.map((v) => {
            const major = v % 8 === 0;
            const mid = v % 4 === 0;
            const reached = v <= current;
            return (
              <div key={v}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors"
                style={{
                  left: `${((v - min) / span) * 100}%`,
                  width: 2,
                  height: major ? 20 : mid ? 13 : 8,
                  background: reached
                    ? (major ? '#ffc94a' : 'rgba(255,201,74,0.55)')
                    : (major ? 'rgba(255,201,74,0.35)' : 'rgba(255,255,255,0.16)'),
                }} />
            );
          })}
        </div>

        {/* rail */}
        <div className="absolute left-1 right-1 top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-white/10" />
        {/* portion atteinte */}
        <div className="absolute left-1 top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-gold/70"
          style={{ width: `calc((100% - 8px) * ${pct / 100})` }} />

        {/* curseur */}
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
          style={{ left: `calc(4px + (100% - 8px) * ${pct / 100})` }}>
          <div className="w-4 h-4 rounded-full bg-gold border-2 border-bg-1 shadow-[0_0_10px_rgba(255,201,74,0.7)]" />
        </div>
      </div>

      {/* étiquettes majeures */}
      <div className="relative h-3.5 mx-1 mt-0.5">
        {ticks.filter((v) => v % 8 === 0).map((v) => (
          <span key={v}
            className={`absolute -translate-x-1/2 text-[8px] font-bold tabular-nums ${v === current ? 'text-gold' : 'text-muted-2/55'}`}
            style={{ left: `${((v - min) / span) * 100}%` }}>
            {v}
          </span>
        ))}
      </div>

      {/* Tailles rondes en accès rapide */}
      <div className="mt-2 flex justify-center gap-1.5">
        {presets.filter((p) => p >= min && p <= max).map((p) => {
          const active = current === p;
          return (
            <button key={p} type="button"
              onClick={() => { onChange(p); haptic('selection'); }}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-extrabold tabular-nums transition-all ${
                active ? 'border-gold/50 bg-gold/10 text-gold' : 'border-border text-muted-2 hover:border-gold/30 hover:text-gold/90'
              }`}>
              {p}
            </button>
          );
        })}
      </div>
    </div>
  );
}
