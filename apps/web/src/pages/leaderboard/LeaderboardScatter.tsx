import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGesture } from '@use-gesture/react';
import { ZoomIn, ZoomOut, Maximize2, List, ScatterChart } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import type { LeaderboardEntry } from '../../lib/api';

/** Marges réservées à l'axe ELO (gauche) et au padding (px). */
const M = { l: 46, r: 16, t: 16, b: 16 };
/** Marge intérieure (haut/bas) pour ne pas coller les têtes aux bords (px). */
const PAD = 30;
/** Rayon « d'occupation » d'une tête (px, base) — espace mini entre deux têtes. */
const NODE_R = 26;
const SCALE_MIN = 0.5;
const SCALE_MAX = 8;

interface View {
  scale: number;
  tx: number;
  ty: number;
}

interface Node {
  entry: LeaderboardEntry;
  bx: number; // position horizontale de base (px)
  by: number; // position verticale de base (px) — dérivée de l'ELO
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 5 graduations linéaires régulières entre min et max. */
function ticks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

/**
 * Vue « nuage de points » du classement — réparti par ELO (beeswarm).
 *
 * La position VERTICALE encode l'ELO : deux joueurs de niveau proche sont à la
 * même hauteur, donc proches l'un de l'autre. L'axe horizontal n'a pas de sens
 * métier : on ne s'en sert que pour écarter les têtes de même ELO afin qu'elles
 * ne se chevauchent pas (essaim centré). Molette / pincement pour zoomer,
 * glisser pour se déplacer.
 */
export function LeaderboardScatter({
  entries,
  myLogin,
  className = '',
}: {
  entries: LeaderboardEntry[];
  myLogin?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 });
  const [hovered, setHovered] = useState<string | null>(null);

  // Mesure du conteneur (responsive).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const domain = useMemo(() => {
    let eMin = Infinity;
    let eMax = -Infinity;
    for (const e of entries) {
      if (e.elo < eMin) eMin = e.elo;
      if (e.elo > eMax) eMax = e.elo;
    }
    if (!Number.isFinite(eMin)) {
      eMin = 1000;
      eMax = 1000;
    }
    // Marge sur l'ELO pour respirer en haut / en bas.
    const span = eMax - eMin || 1;
    return { eMin: eMin - span * 0.06, eMax: eMax + span * 0.06 };
  }, [entries]);

  const plotW = Math.max(10, size.w - M.l - M.r);
  const plotH = Math.max(10, size.h - M.t - M.b);

  // ELO → ordonnée de base (px). Haut = ELO élevé.
  const yOfElo = (elo: number) => {
    const ny = domain.eMax > domain.eMin ? (elo - domain.eMin) / (domain.eMax - domain.eMin) : 0.5;
    return PAD + (1 - ny) * (plotH - 2 * PAD);
  };

  // Placement « beeswarm » : pour chaque joueur (ELO décroissant), on cherche le
  // décalage horizontal le plus proche du centre qui n'entre en collision avec
  // aucune tête déjà posée. Résultat : un essaim centré, hauteur = ELO.
  const nodes = useMemo<Node[]>(() => {
    const cx = plotW / 2;
    const D = NODE_R * 2; // distance mini entre deux centres
    const step = D * 0.95;
    const sorted = [...entries].sort((a, b) => b.elo - a.elo || a.login.localeCompare(b.login));
    const placed: Node[] = [];
    for (const e of sorted) {
      const by = yOfElo(e.elo);
      let bx = cx;
      for (let k = 0; k < 400; k++) {
        // 0, +1, -1, +2, -2 … × step
        const rank = Math.ceil(k / 2);
        const dir = k % 2 === 1 ? 1 : -1;
        const candX = cx + rank * step * dir;
        const collides = placed.some((n) => {
          const dy = n.by - by;
          if (Math.abs(dy) >= D) return false; // assez loin verticalement
          const dx = n.bx - candX;
          return dx * dx + dy * dy < D * D;
        });
        if (!collides) {
          bx = candX;
          break;
        }
      }
      placed.push({ entry: e, bx, by });
    }
    return placed;
    // yOfElo dépend de plotH/domain → déps explicites
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, plotW, plotH, domain.eMin, domain.eMax]);

  // base → coordonnées écran locales (dans la zone de tracé).
  const toLocal = (bx: number, by: number) => ({
    lx: view.tx + bx * view.scale,
    ly: view.ty + by * view.scale,
  });

  // Zoom centré sur un point écran (relatif au conteneur).
  const zoomAt = (factor: number, cx: number, cy: number) => {
    setView((v) => {
      const next = clamp(v.scale * factor, SCALE_MIN, SCALE_MAX);
      const k = next / v.scale;
      const px = cx - M.l;
      const py = cy - M.t;
      return { scale: next, tx: px - (px - v.tx) * k, ty: py - (py - v.ty) * k };
    });
  };

  useGesture(
    {
      onDrag: ({ offset: [ox, oy] }) => setView((v) => ({ ...v, tx: ox, ty: oy })),
      onWheel: ({ event, delta: [, dy] }) => {
        event.preventDefault();
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        zoomAt(Math.exp(-dy * 0.0015), event.clientX - rect.left, event.clientY - rect.top);
      },
      onPinch: ({ offset: [s], origin: [ox, oy], memo }) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return memo;
        const prev = (memo as number) ?? view.scale;
        zoomAt(s / prev, ox - rect.left, oy - rect.top);
        return s;
      },
    },
    {
      target: containerRef,
      eventOptions: { passive: false },
      drag: { from: () => [view.tx, view.ty], filterTaps: true },
      pinch: { from: () => [view.scale, 0], scaleBounds: { min: SCALE_MIN, max: SCALE_MAX } },
    },
  );

  const reset = () => setView({ scale: 1, tx: 0, ty: 0 });
  const eloTicks = ticks(domain.eMin, domain.eMax, 5);
  const hoveredNode = hovered ? nodes.find((n) => n.entry.login === hovered) : null;

  return (
    <div className={`relative ${className}`}>
      {/* Contrôles de zoom */}
      <div className="absolute top-2 right-2 z-30 flex flex-col gap-1.5">
        <ZoomBtn label="Zoomer" onClick={() => zoomAt(1.3, size.w / 2, size.h / 2)}>
          <ZoomIn className="w-4 h-4" strokeWidth={2.5} />
        </ZoomBtn>
        <ZoomBtn label="Dézoomer" onClick={() => zoomAt(1 / 1.3, size.w / 2, size.h / 2)}>
          <ZoomOut className="w-4 h-4" strokeWidth={2.5} />
        </ZoomBtn>
        <ZoomBtn label="Réinitialiser la vue" onClick={reset}>
          <Maximize2 className="w-4 h-4" strokeWidth={2.5} />
        </ZoomBtn>
      </div>

      {/* Légende */}
      <div className="absolute top-2 left-2 z-20 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-2 pointer-events-none">
        ELO ↑ · réparti par niveau
      </div>

      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden rounded-xl card-hud cursor-grab active:cursor-grabbing select-none touch-none"
      >
        {/* Graduations ELO (axe Y) */}
        <div
          className="absolute left-0 overflow-hidden pointer-events-none"
          style={{ width: M.l, top: M.t, height: plotH }}
        >
          {eloTicks.map((v, i) => (
            <span
              key={i}
              className="absolute right-1.5 -translate-y-1/2 font-mono text-[9px] text-muted-2 tabular-nums"
              style={{ top: view.ty + yOfElo(v) * view.scale }}
            >
              {Math.round(v)}
            </span>
          ))}
        </div>

        {/* Zone du nuage (clippée) */}
        <div
          className="absolute overflow-hidden"
          style={{ left: M.l, top: M.t, width: plotW, height: plotH }}
        >
          {/* Lignes ELO horizontales */}
          {eloTicks.map((v, i) => (
            <div
              key={`h${i}`}
              className="absolute left-0 right-0 h-px bg-gold/[0.06]"
              style={{ top: view.ty + yOfElo(v) * view.scale }}
            />
          ))}

          {/* Têtes des joueurs */}
          {nodes.map(({ entry: e, bx, by }) => {
            const { lx, ly } = toLocal(bx, by);
            const isMe = e.login === myLogin;
            const isHover = e.login === hovered;
            return (
              <button
                key={e.login}
                type="button"
                onMouseEnter={() => setHovered(e.login)}
                onMouseLeave={() => setHovered((h) => (h === e.login ? null : h))}
                onClick={() => navigate(`/player/${encodeURIComponent(e.login)}`)}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-shadow"
                style={{ left: lx, top: ly, zIndex: isHover ? 40 : isMe ? 20 : 10 }}
                aria-label={`${e.login} · ${e.elo} ELO`}
              >
                <Avatar
                  login={e.login}
                  imageUrl={e.imageUrl}
                  size={isMe || isHover ? 'md' : 'sm'}
                  className={
                    isMe
                      ? 'ring-2 ring-gold ring-offset-2 ring-offset-bg-1 shadow-gold-glow'
                      : isHover
                        ? 'ring-2 ring-gold/70 ring-offset-2 ring-offset-bg-1'
                        : 'ring-1 ring-border'
                  }
                />
              </button>
            );
          })}
        </div>

        {/* Infobulle (hors zone clippée pour ne pas être coupée) */}
        {hoveredNode && (
          <ScatterTooltip
            entry={hoveredNode.entry}
            left={M.l + toLocal(hoveredNode.bx, hoveredNode.by).lx}
            top={M.t + toLocal(hoveredNode.bx, hoveredNode.by).ly - 26}
          />
        )}
      </div>
    </div>
  );
}

function ScatterTooltip({ entry, left, top }: { entry: LeaderboardEntry; left: number; top: number }) {
  return (
    <div
      className="absolute z-50 pointer-events-none -translate-x-1/2 -translate-y-full"
      style={{ left, top }}
    >
      <div className="card-hud rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-xl">
        <div className="text-xs font-extrabold text-text-strong leading-tight">{entry.login}</div>
        <div className="text-[10px] font-mono tabular-nums text-muted-2 leading-tight">
          #{entry.rank} · <span className="text-gold font-bold">{entry.elo}</span> ELO ·{' '}
          {entry.matchesPlayed} matchs
        </div>
      </div>
    </div>
  );
}

function ZoomBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-lg card-hud text-muted-2 hover:text-gold hover:border-gold/40 transition-colors"
    >
      {children}
    </button>
  );
}

// ─── Bascule Liste / Nuage ──────────────────────────────────────────────────

export type RankingView = 'list' | 'graph';

export function RankingViewToggle({
  view,
  onChange,
}: {
  view: RankingView;
  onChange: (v: RankingView) => void;
}) {
  return (
    <div className="inline-flex gap-1 p-1 rounded-lg bg-bg-2/60 border border-border/40">
      <ToggleBtn active={view === 'list'} onClick={() => onChange('list')} Icon={List}>
        Liste
      </ToggleBtn>
      <ToggleBtn active={view === 'graph'} onClick={() => onChange('graph')} Icon={ScatterChart}>
        Nuage
      </ToggleBtn>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof List;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-extrabold uppercase tracking-[0.12em] transition-all duration-150 border ${
        active ? 'bg-gold/10 border-gold/30 text-gold' : 'border-transparent text-muted-2 hover:text-text'
      }`}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
      {children}
    </button>
  );
}
