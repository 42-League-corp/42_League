/**
 * PlayerCountPicker — sélecteur de nombre de joueurs « règle » horizontale.
 *
 * Un seul contrôle unifié (plus de pastilles + champ à côté) :
 *  - grand compteur à roulettes (même effet que la courbe ELO — RollingNumber)
 *  - règle graduée que l'on fait défiler à la molette, au drag ou au toucher
 *  - bandeau de sélection central doré + crans qui s'aimantent
 *  - quelques tailles « rondes » cliquables (8 / 16 / 32…) sous la règle
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { haptic } from '../mobile/feedback/useHaptic';
import { RollingNumber } from './RollingNumber';

const ITEM_W = 16; // espacement d'un cran (px)

interface PlayerCountPickerProps {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  /** Tailles « rondes » proposées en accès rapide sous la règle. */
  presets?: number[];
  /** Libellé court sous le grand nombre (ex. « joueurs »). */
  label?: string;
}

export function PlayerCountPicker({
  value,
  onChange,
  min = 6,
  max = 64,
  presets = [8, 16, 32, 64],
  label = 'joueurs',
}: PlayerCountPickerProps) {
  const values = useMemo(
    () => Array.from({ length: max - min + 1 }, (_, i) => min + i),
    [min, max],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const programmaticRef = useRef(false);   // ignore nos propres scrolls
  const userOriginRef = useRef(false);     // saute le repositionnement après scroll user
  const clearTimer = useRef<ReturnType<typeof setTimeout>>();
  const wheelThrottle = useRef(false);

  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const index = clamp(value) - min;

  const scrollToIndex = useCallback((i: number, smooth: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    programmaticRef.current = true;
    el.scrollTo({ left: i * ITEM_W, behavior: smooth ? 'smooth' : 'auto' });
    clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => { programmaticRef.current = false; }, smooth ? 380 : 80);
  }, []);

  // Position initiale instantanée (avant peinture).
  useLayoutEffect(() => {
    scrollToIndex(index, false);
    // mount-only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repositionnement sur changement externe (preset, +/-…).
  useEffect(() => {
    if (userOriginRef.current) { userOriginRef.current = false; return; }
    scrollToIndex(index, false);
  }, [index, scrollToIndex]);

  const handleScroll = () => {
    if (programmaticRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const i = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollLeft / ITEM_W)));
    const v = values[i];
    if (v !== undefined && v !== value) {
      userOriginRef.current = true;
      onChange(v);
      haptic('selection');
    }
  };

  // Molette native ({ passive: false }) → un cran net par notch, sans scroll page.
  const wheelLogicRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelLogicRef.current = (e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (wheelThrottle.current) return;
    const el = scrollRef.current;
    if (!el) return;
    programmaticRef.current = false;
    const cur = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollLeft / ITEM_W)));
    const dir = (e.deltaY || e.deltaX) > 0 ? 1 : -1;
    const next = Math.max(0, Math.min(values.length - 1, cur + dir));
    if (next !== cur) {
      const v = values[next];
      if (v !== undefined) {
        wheelThrottle.current = true;
        setTimeout(() => { wheelThrottle.current = false; }, 90);
        userOriginRef.current = true;
        onChange(v);
        haptic('selection');
        scrollToIndex(next, true);
      }
    }
  };
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => wheelLogicRef.current(e);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Drag souris : on scrube la règle comme un curseur (façon graphique).
  const drag = useRef<{ active: boolean; startX: number; startScroll: number }>({ active: false, startX: 0, startScroll: 0 });
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return; // tactile : scroll natif horizontal
    const el = scrollRef.current; if (!el) return;
    programmaticRef.current = false;
    drag.current = { active: true, startX: e.clientX, startScroll: el.scrollLeft };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    const el = scrollRef.current; if (!el) return;
    el.scrollLeft = drag.current.startScroll - (e.clientX - drag.current.startX);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    const el = scrollRef.current; if (!el) return;
    const i = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollLeft / ITEM_W)));
    scrollToIndex(i, true);
  };

  const step = (d: number) => {
    const v = clamp(value + d);
    if (v !== value) { onChange(v); haptic('selection'); }
  };

  return (
    <div className="select-none rounded-xl border border-border bg-bg-1/60 px-3 pt-3 pb-2.5">
      {/* Grand compteur à roulettes + steppers */}
      <div className="flex items-center justify-center gap-4 mb-2.5">
        <button type="button" onClick={() => step(-1)} aria-label="−1"
          className="grid place-items-center w-7 h-7 rounded-lg border border-border text-muted-2 hover:text-gold hover:border-gold/40 active:scale-90 transition-all">
          <span className="text-base font-black leading-none">−</span>
        </button>
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-4xl font-black tabular-nums text-gold-emboss leading-none">
            <RollingNumber value={clamp(value)} />
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted font-extrabold">{label}</span>
        </div>
        <button type="button" onClick={() => step(1)} aria-label="+1"
          className="grid place-items-center w-7 h-7 rounded-lg border border-border text-muted-2 hover:text-gold hover:border-gold/40 active:scale-90 transition-all">
          <span className="text-base font-black leading-none">+</span>
        </button>
      </div>

      {/* Règle graduée scrollable */}
      <div className="relative">
        {/* Bandeau central doré (cran sélectionné) */}
        <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 pointer-events-none z-20"
          style={{ width: ITEM_W }}>
          <div className="mx-auto h-full w-[2px] rounded-full bg-gold shadow-[0_0_10px_rgba(255,201,74,0.7)]" />
        </div>
        {/* Masques fondu gauche/droite */}
        <div className="absolute inset-0 pointer-events-none z-10"
          style={{ background: 'linear-gradient(90deg, #15120e 0%, transparent 16%, transparent 84%, #15120e 100%)' }} />

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          role="slider"
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={clamp(value)}
          className="flex items-end overflow-x-auto scrollbar-none cursor-grab active:cursor-grabbing"
          style={{ height: 48, overflowY: 'hidden', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
        >
          <div style={{ width: `calc(50% - ${ITEM_W / 2}px)` }} aria-hidden />
          {values.map((v) => {
            const major = v % 8 === 0;
            const mid = v % 4 === 0;
            const active = v === clamp(value);
            return (
              <div key={v}
                className="flex-shrink-0 flex flex-col items-center justify-end gap-1 pb-1"
                style={{ width: ITEM_W, height: 48, scrollSnapAlign: 'center' }}>
                <div
                  className="rounded-full transition-colors"
                  style={{
                    width: 2,
                    height: major ? 22 : mid ? 15 : 9,
                    background: active ? '#ffc94a' : major ? 'rgba(255,201,74,0.45)' : 'rgba(255,255,255,0.18)',
                  }}
                />
                <span className={`h-[10px] leading-none text-[8px] font-bold tabular-nums ${active ? 'text-gold' : 'text-muted-2/55'}`}>
                  {major ? v : ''}
                </span>
              </div>
            );
          })}
          <div style={{ width: `calc(50% - ${ITEM_W / 2}px)` }} aria-hidden />
        </div>
      </div>

      {/* Tailles rondes en accès rapide */}
      <div className="mt-3 flex justify-center gap-1.5">
        {presets.filter((p) => p >= min && p <= max).map((p) => {
          const active = clamp(value) === p;
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
