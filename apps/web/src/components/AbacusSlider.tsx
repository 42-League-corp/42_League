import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

interface AbacusSliderProps {
  value: number;
  onChange: (value: number) => void;
  /** Score minimum atteignable par le perdant (gamelles autorisées → négatif possible). */
  min?: number;
  /** Score maximum atteignable par le perdant : strictement inférieur au seuil de victoire (10). */
  max?: number;
}

const TRACK_PADDING_PX = 28;

type BeadTone = 'neg' | 'zero' | 'pos';

function toneFor(value: number): BeadTone {
  if (value < 0) return 'neg';
  if (value === 0) return 'zero';
  return 'pos';
}

const BEAD_GRADIENT: Record<BeadTone, string> = {
  neg: 'radial-gradient(circle at 32% 28%, #ffd5dd 0%, #ff7a91 28%, #ff3b5c 55%, #8a0a23 100%)',
  zero: 'radial-gradient(circle at 32% 28%, #ffffff 0%, #d8e0eb 30%, #8d9aae 60%, #3a4459 100%)',
  pos: 'radial-gradient(circle at 32% 28%, #d6ffff 0%, #7af0f2 25%, #00d9dc 55%, #014a4c 100%)',
};

const BEAD_HALO: Record<BeadTone, string> = {
  neg: 'radial-gradient(circle, rgba(255,59,92,0.25) 0%, transparent 70%)',
  zero: 'radial-gradient(circle, rgba(150,164,180,0.2) 0%, transparent 70%)',
  pos: 'radial-gradient(circle, rgba(0,217,220,0.25) 0%, transparent 70%)',
};

const READOUT_COLOR: Record<BeadTone, string> = {
  neg: 'text-red',
  zero: 'text-muted-2',
  pos: 'text-teal',
};

const READOUT_GLOW: Record<BeadTone, string> = {
  neg: '0 0 24px rgba(255,59,92,0.35)',
  zero: 'none',
  pos: '0 0 24px rgba(0,217,220,0.35)',
};

function beadShadow(tone: BeadTone, dragging: boolean): string {
  const glow =
    tone === 'neg'
      ? `0 0 ${dragging ? 30 : 18}px rgba(255,59,92,${dragging ? 0.65 : 0.45})`
      : tone === 'zero'
        ? `0 0 ${dragging ? 20 : 12}px rgba(150,164,180,${dragging ? 0.4 : 0.25})`
        : `0 0 ${dragging ? 30 : 18}px rgba(0,217,220,${dragging ? 0.65 : 0.45})`;
  const inner =
    tone === 'zero'
      ? 'inset -3px -4px 7px rgba(0,0,0,0.35), inset 2px 2px 4px rgba(255,255,255,0.45)'
      : 'inset -3px -4px 7px rgba(0,0,0,0.35), inset 2px 2px 4px rgba(255,255,255,0.35)';
  return `${glow}, 0 8px 14px rgba(0,0,0,0.55), ${inner}`;
}

export function AbacusSlider({ value, onChange, min = -10, max = 9 }: AbacusSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const clamp = useCallback(
    (n: number) => Math.max(min, Math.min(max, n)),
    [min, max],
  );

  const valueFromPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return min;
      const rect = track.getBoundingClientRect();
      const usable = rect.width - TRACK_PADDING_PX * 2;
      if (usable <= 0) return min;
      const x = Math.max(0, Math.min(usable, clientX - rect.left - TRACK_PADDING_PX));
      return clamp(Math.round(min + (x / usable) * (max - min)));
    },
    [min, max, clamp],
  );

  const commitFromPointer = (clientX: number) => {
    const next = valueFromPointer(clientX);
    if (next !== value) onChange(next);
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    commitFromPointer(e.clientX);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    commitFromPointer(e.clientX);
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer déjà libéré */
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 :
      e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 :
      0;
    if (step !== 0) {
      e.preventDefault();
      const next = clamp(value + step);
      if (next !== value) onChange(next);
      return;
    }
    if (e.key === 'Home') { e.preventDefault(); onChange(min); }
    else if (e.key === 'End') { e.preventDefault(); onChange(max); }
  };

  const ratio = max === min ? 0 : (value - min) / (max - min);
  const tone = toneFor(value);

  return (
    <div className="select-none">
      {/* Affichage numérique */}
      <div className="flex items-end justify-center mb-4 h-14">
        <span
          key={value}
          className={`text-6xl font-black tracking-tighter leading-none animate-bead-pulse ${READOUT_COLOR[tone]}`}
          style={{ textShadow: READOUT_GLOW[tone] }}
        >
          {value}
        </span>
      </div>

      {/* Tige + perle */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label="Score du perdant (gamelles autorisées)"
        className={`relative h-16 px-7 touch-none outline-none rounded focus-visible:ring-2 focus-visible:ring-teal/60 ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div
          className="absolute top-1/2 left-7 right-7 h-[6px] -translate-y-1/2 rounded-full"
          style={{
            background:
              'linear-gradient(to bottom, #0c1118 0%, #2a3548 18%, #6b7689 45%, #b0bccd 52%, #6b7689 60%, #1f2737 82%, #0a0e15 100%)',
            boxShadow:
              '0 1px 0 rgba(255,255,255,0.18) inset, 0 -1px 0 rgba(0,0,0,0.6) inset, 0 8px 14px rgba(0,0,0,0.55), 0 0 22px rgba(0,217,220,0.08)',
          }}
        />
        {(['left-6', 'right-6'] as const).map((side) => (
          <div
            key={side}
            className={`absolute top-1/2 ${side} w-2 h-3 -translate-y-1/2 rounded-sm`}
            style={{
              background: 'linear-gradient(to bottom, #243044, #0c1118 60%, #1a2233)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 4px rgba(0,0,0,0.5)',
            }}
          />
        ))}

        {ticks.map((tick) => {
          const tickRatio = (tick - min) / (max - min);
          const isMajor = tick === min || tick === max || tick === 0;
          const isNear = Math.abs(tick - value) <= 1;
          return (
            <button
              key={tick}
              type="button"
              tabIndex={-1}
              aria-label={`Score ${tick}`}
              onClick={(e) => { e.stopPropagation(); onChange(tick); }}
              className="absolute top-1/2 -translate-x-1/2 cursor-pointer bg-transparent border-0 p-0"
              style={{
                left: `calc(${TRACK_PADDING_PX}px + ${tickRatio} * (100% - ${TRACK_PADDING_PX * 2}px))`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                className={`mx-auto rounded-full transition-all duration-200 ${
                  isMajor
                    ? 'w-[3px] h-5 bg-muted-2/70'
                    : isNear
                      ? 'w-[2px] h-3.5 bg-muted/80'
                      : 'w-[2px] h-2.5 bg-muted/40'
                }`}
              />
            </button>
          );
        })}

        <div
          className="absolute top-1/2 pointer-events-none z-10"
          style={{
            left: `calc(${TRACK_PADDING_PX}px + ${ratio} * (100% - ${TRACK_PADDING_PX * 2}px))`,
            transform: 'translate(-50%, -50%)',
            transition: dragging
              ? 'left 90ms cubic-bezier(0.22, 1, 0.36, 1)'
              : 'left 280ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <div
            className={`absolute inset-0 rounded-full transition-all duration-300 ${
              dragging ? 'scale-150 opacity-100' : 'scale-100 opacity-0'
            }`}
            style={{ background: BEAD_HALO[tone] }}
          />
          <div
            className={`relative w-11 h-11 rounded-full transition-transform duration-150 ${
              dragging ? 'scale-[1.08]' : 'scale-100'
            }`}
            style={{ background: BEAD_GRADIENT[tone], boxShadow: beadShadow(tone, dragging) }}
          >
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                top: 5,
                left: 7,
                width: 12,
                height: 8,
                background:
                  'radial-gradient(ellipse, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 70%)',
                filter: 'blur(0.5px)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Repères -10 / 0 / 9 */}
      <div className="flex justify-between text-[10px] text-muted mt-2 px-5 font-mono font-bold opacity-70 tracking-wider">
        <span>{min}</span>
        {min < 0 && max > 0 && (
          <span className={tone === 'zero' ? 'text-muted-2' : ''}>0</span>
        )}
        <span>{max}</span>
      </div>
    </div>
  );
}
