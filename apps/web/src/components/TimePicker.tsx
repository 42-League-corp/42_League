import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { haptic } from '../mobile/feedback/useHaptic';
import { fmtDayLabel } from '../lib/format';
import type { Lang } from '../lib/i18n';

interface TimePickerProps {
  /** Date/heure sélectionnée. */
  value: Date;
  onChange: (next: Date) => void;
  /** Nombre de jours sélectionnables à partir d'aujourd'hui (chips). */
  days?: number;
  /** Pas des minutes (5 = 00,05,10…). */
  minuteStep?: number;
  lang?: Lang;
  /** Fermer/annuler le picker (ex: clic extérieur, Échap). Si fourni, Échap
   *  ferme le picker. */
  onClose?: () => void;
}

const ITEM_H = 40; // hauteur d'une ligne de molette (px)
const VISIBLE = 5; // nombre de lignes visibles (impair → une centrée)

/**
 * Sélecteur d'heure premium — molettes scroll-snap façon iOS, habillées
 * laiton/or pour coller au thème « HUD RPG » de la 42 League.
 *
 * - Chips de jour (Aujourd'hui / Demain / dates en lettres)
 * - Deux molettes (heures / minutes) avec bandeau de sélection doré
 * - Presets rapides (dans 30 min, ce soir, demain midi…)
 * - Haptique à chaque cran, readout géant en haut
 *
 * Aucun input natif : tout est contrôlé via `value` (Date) / `onChange`.
 */
export function TimePicker({
  value,
  onChange,
  days = 7,
  minuteStep = 5,
  lang = 'fr',
  onClose,
}: TimePickerProps) {
  // Échap ferme/annule le picker quand un handler de fermeture est fourni.
  useEscapeKey(!!onClose, () => onClose?.());

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(
    () => Array.from({ length: Math.floor(60 / minuteStep) }, (_, i) => i * minuteStep),
    [minuteStep],
  );

  // Liste des jours sélectionnables (à partir d'aujourd'hui à minuit).
  const dayList = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }, [days]);

  const selectedDayIdx = useMemo(() => {
    const v = new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
    const idx = dayList.findIndex((d) => d.getTime() === v);
    return idx === -1 ? 0 : idx;
  }, [value, dayList]);

  // Minute la plus proche d'un cran valide (pour aligner la molette).
  const snappedMinute = useMemo(() => {
    const m = Math.round(value.getMinutes() / minuteStep) * minuteStep;
    return m >= 60 ? 60 - minuteStep : m;
  }, [value, minuteStep]);

  const setDay = (d: Date) => {
    const next = new Date(value);
    next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    onChange(next);
  };
  const setHour = (h: number) => {
    const next = new Date(value);
    next.setHours(h);
    onChange(next);
  };
  const setMinute = (m: number) => {
    const next = new Date(value);
    next.setMinutes(m);
    onChange(next);
  };

  // Presets contextuels (toujours dans le futur).
  const presets = useMemo(() => buildPresets(lang), [lang]);

  return (
    <div className="select-none">
      {/* Readout géant */}
      <div className="flex flex-col items-center mb-5">
        <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted font-extrabold mb-1">
          <Clock className="w-3 h-3 text-gold" strokeWidth={2.5} />
          {fmtDayLabel(value.toISOString(), lang)}
        </div>
        <motion.div
          key={`${value.getHours()}:${value.getMinutes()}`}
          initial={{ scale: 0.94, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 480, damping: 24 }}
          className="font-display text-5xl font-black tabular-nums tracking-tight text-gold-emboss leading-none"
        >
          {pad(value.getHours())}
          <span className="text-muted mx-0.5">:</span>
          {pad(snappedMinute)}
        </motion.div>
      </div>

      {/* Chips de jour */}
      <div className="-mx-1 px-1 overflow-x-auto scrollbar-none scroll-smooth-touch mb-4">
        <div className="flex gap-2 min-w-min pb-1">
          {dayList.map((d, i) => {
            const active = i === selectedDayIdx;
            return (
              <button
                key={d.getTime()}
                type="button"
                onClick={() => {
                  haptic('selection');
                  setDay(d);
                }}
                className={`relative flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-extrabold tracking-wide tap-transparent transition-all active:scale-95 ${
                  active
                    ? 'metal-plate-gold text-[#1a0d00] shadow-gold-glow'
                    : 'card-hud text-muted-2 hover:text-gold border border-border'
                }`}
              >
                {dayChipLabel(d, i, lang)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Molettes heures / minutes */}
      <div
        className="relative mx-auto max-w-[280px] rounded-2xl overflow-hidden card-hud"
        style={{ height: ITEM_H * VISIBLE }}
      >
        {/* Bandeau de sélection central doré */}
        <div
          className="absolute left-0 right-0 pointer-events-none z-20 border-y border-gold/45"
          style={{
            top: ITEM_H * Math.floor(VISIBLE / 2),
            height: ITEM_H,
            background:
              'linear-gradient(90deg, rgba(255,201,74,0.04), rgba(255,201,74,0.12), rgba(255,201,74,0.04))',
            boxShadow: 'inset 0 0 16px rgba(255,201,74,0.10)',
          }}
        />
        {/* Masques fondu haut/bas */}
        <div
          className="absolute inset-0 pointer-events-none z-30"
          style={{
            background:
              'linear-gradient(180deg, rgba(21,18,14,0.92) 0%, transparent 38%, transparent 62%, rgba(21,18,14,0.92) 100%)',
          }}
        />

        <div className="relative z-10 flex h-full items-stretch">
          <WheelColumn
            values={hours}
            value={value.getHours()}
            onChange={setHour}
            ariaLabel="Heures"
          />
          <div className="flex items-center justify-center text-2xl font-black text-gold/60 px-0.5">
            :
          </div>
          <WheelColumn
            values={minutes}
            value={snappedMinute}
            onChange={setMinute}
            ariaLabel="Minutes"
          />
        </div>
      </div>

      {/* Presets rapides */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              haptic('light');
              onChange(p.date());
            }}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold text-gold/90 border border-gold/30 bg-gold/[0.06] hover:bg-gold/15 hover:border-gold/60 active:scale-95 transition-all tap-transparent"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Molette individuelle ────────────────────────────────────────────────────

interface WheelColumnProps {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  ariaLabel: string;
}

function WheelColumn({ values, value, onChange, ariaLabel }: WheelColumnProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // true tant que c'est NOUS qui pilotons le scroll (mount, preset…) → on ignore
  // alors les events `scroll` pour ne pas re-déclencher onChange (boucle).
  const programmaticRef = useRef(false);
  // true quand le dernier changement de valeur vient du scroll utilisateur →
  // l'effet de repositionnement le saute (le DOM est déjà à la bonne place).
  const userOriginRef = useRef(false);
  const clearTimer = useRef<ReturnType<typeof setTimeout>>();
  const wheelThrottleRef = useRef(false);

  const index = Math.max(0, values.indexOf(value));
  const padCount = VISIBLE >> 1; // lignes de remplissage haut/bas

  // Avec le padding (padCount*ITEM_H) + alignement center, le point de snap de
  // l'option i tombe exactement sur scrollTop = i*ITEM_H → pas de conflit snap.
  const scrollToIndex = useCallback((i: number, smooth: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    programmaticRef.current = true;
    el.scrollTo({ top: i * ITEM_H, behavior: smooth ? 'smooth' : 'auto' });
    clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(
      () => {
        programmaticRef.current = false;
      },
      smooth ? 380 : 80,
    );
  }, []);

  // Position initiale instantanée (avant peinture) — valeur centrée dès le départ.
  useLayoutEffect(() => {
    scrollToIndex(index, false);
    // mount-only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repositionnement sur changement externe (preset, chip de jour…).
  // Instantané : fiable partout et la valeur sélectionnée est déjà mise à jour
  // visuellement (readout + option active), un snap net se lit très bien.
  useEffect(() => {
    if (userOriginRef.current) {
      userOriginRef.current = false;
      return;
    }
    scrollToIndex(index, false);
  }, [index, scrollToIndex]);

  const handleScroll = () => {
    if (programmaticRef.current) return; // ignore nos propres scrolls
    const el = scrollRef.current;
    if (!el) return;
    const i = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollTop / ITEM_H)));
    const v = values[i];
    if (v !== undefined && v !== value) {
      userOriginRef.current = true;
      onChange(v);
      haptic('selection');
    }
  };

  // La molette doit avancer d'EXACTEMENT un cran par notch. On attache un
  // listener wheel NATIF en `{ passive: false }` : le `onWheel` de React est
  // passif, donc `preventDefault()` y est ignoré → le navigateur scrollait
  // nativement (et le scroll-snap sautait plusieurs crans d'un coup).
  const wheelLogicRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelLogicRef.current = (e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (wheelThrottleRef.current) return;
    programmaticRef.current = false;
    const el = scrollRef.current;
    if (!el) return;
    const currentIndex = Math.max(
      0,
      Math.min(values.length - 1, Math.round(el.scrollTop / ITEM_H)),
    );
    const delta = e.deltaY > 0 ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(values.length - 1, currentIndex + delta));
    if (nextIndex !== currentIndex) {
      const v = values[nextIndex];
      if (v !== undefined) {
        wheelThrottleRef.current = true;
        setTimeout(() => {
          wheelThrottleRef.current = false;
        }, 120);
        userOriginRef.current = true;
        onChange(v);
        haptic('selection');
        scrollToIndex(nextIndex, true);
      }
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => wheelLogicRef.current(e);
    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, []);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      onPointerDown={() => { programmaticRef.current = false; }}
      role="listbox"
      aria-label={ariaLabel}
      className="flex-1 overflow-y-auto scrollbar-none"
      // Hauteur explicite (px) plutôt que h-full : une hauteur en % sur un item
      // flex n'établit pas un viewport scrollable fiable (min-height:auto).
      // Pas de scroll-behavior CSS : on pilote l'animation via scrollTo().
      style={{
        height: ITEM_H * VISIBLE,
        scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div style={{ height: padCount * ITEM_H }} aria-hidden />
      {values.map((v) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            role="option"
            aria-selected={active}
            tabIndex={-1}
            onClick={() => {
              haptic('selection');
              onChange(v);
            }}
            className={`w-full flex items-center justify-center font-display tabular-nums tap-transparent transition-all duration-150 ${
              active
                ? 'text-gold text-2xl font-black'
                : 'text-muted-2/70 text-lg font-bold'
            }`}
            style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
          >
            {pad2(v)}
          </button>
        );
      })}
      <div style={{ height: padCount * ITEM_H }} aria-hidden />
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
const pad2 = pad;

function dayChipLabel(d: Date, idx: number, lang: Lang): string {
  if (idx === 0) return lang === 'fr' ? 'Auj.' : lang === 'es' ? 'Hoy' : 'Today';
  if (idx === 1) return lang === 'fr' ? 'Demain' : lang === 'es' ? 'Mañana' : 'Tmrw';
  const locale = lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-GB';
  // Ex. « lun. 2 » — court mais lisible.
  return d
    .toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })
    .replace('.', '');
}

interface Preset {
  label: string;
  date: () => Date;
}

function buildPresets(lang: Lang): Preset[] {
  const atToday = (h: number, m = 0) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };
  const tomorrowAt = (h: number, m = 0) => {
    const d = atToday(h, m);
    d.setDate(d.getDate() + 1);
    return d;
  };
  const tonight = lang === 'fr' ? 'Ce soir 19h' : lang === 'es' ? 'Esta noche 19h' : 'Tonight 7pm';
  const tmrwNoon = lang === 'fr' ? 'Demain 12h' : lang === 'es' ? 'Mañana 12h' : 'Tmrw noon';
  return [
    {
      label: '+30 min',
      date: () => new Date(Date.now() + 30 * 60_000),
    },
    {
      label: '+1 h',
      date: () => new Date(Date.now() + 60 * 60_000),
    },
    {
      label: tonight,
      date: () => {
        const t = atToday(19);
        return t.getTime() > Date.now() ? t : tomorrowAt(19);
      },
    },
    {
      label: tmrwNoon,
      date: () => tomorrowAt(12),
    },
  ];
}
