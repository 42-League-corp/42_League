import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGesture } from '@use-gesture/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize2, List, ScatterChart } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import type { LeaderboardEntry } from '../../lib/api';

/** Marges réservées aux axes (ELO à gauche, Win % en bas) et titres d'axes (px). */
const M = { l: 58, r: 16, t: 16, b: 50 };
/** Marge intérieure pour ne pas coller les têtes aux bords (px). */
const PAD = 30;
/** Rayon « d'occupation » d'une tête (px, base). */
const NODE_R = 24;
/** Côté d'une cellule de regroupement (px, base) — points dans la même cellule = 1 amas. */
const CELL = NODE_R * 1.6;
/** Rayon du déploiement circulaire des membres d'un amas (px, base). */
const FAN_R = NODE_R * 1.9;
const SCALE_MIN = 0.5;
const SCALE_MAX = 8;

interface View {
  scale: number;
  tx: number;
  ty: number;
}

/** Un amas = un ou plusieurs joueurs regroupés sur un même point du nuage. */
interface Cluster {
  id: string;
  bx: number; // position horizontale de base (px) — dérivée du win rate
  by: number; // position verticale de base (px) — dérivée de l'ELO
  members: LeaderboardEntry[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 5 graduations linéaires régulières entre min et max. */
function ticks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

/**
 * Décalage (base px) du i-ème membre déployé en cercle autour du centre d'un amas.
 * Le rayon grandit légèrement quand l'amas est dense pour éviter les recouvrements.
 */
function fanOffset(i: number, total: number): { x: number; y: number } {
  if (total <= 1) return { x: 0, y: 0 };
  const r = FAN_R * (total > 6 ? 1 + (total - 6) * 0.12 : 1);
  // On démarre en haut (-90°) et on tourne dans le sens horaire.
  const a = -Math.PI / 2 + (i / total) * Math.PI * 2;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

/**
 * Vue « nuage de points » du classement — vrai nuage 2D.
 *
 *  • Axe VERTICAL = ELO (haut = fort).
 *  • Axe HORIZONTAL = win rate (droite = meilleur ratio).
 *
 * Les joueurs les plus forts (ELO élevé + bon ratio) se retrouvent donc en haut à
 * droite. Si deux têtes se superposent, on les écarte légèrement à l'horizontale.
 * Molette / pincement pour zoomer, glisser pour se déplacer.
 */
export function LeaderboardScatter({
  entries,
  myLogin,
  winRates,
  className = '',
}: {
  entries: LeaderboardEntry[];
  myLogin?: string;
  /** Win rate (0–100) par login — abscisse du nuage. Défaut 50 si absent. */
  winRates?: Map<string, number>;
  className?: string;
}) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 });
  /** Login de la tête survolée (pour l'infobulle). */
  const [hovered, setHovered] = useState<string | null>(null);
  /** Amas actuellement « déployé » en cercle (par hover ou clic). */
  const [openCluster, setOpenCluster] = useState<string | null>(null);

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

  // Win rate (0–100) → abscisse de base (px). Droite = meilleur ratio.
  const rateOf = (login: string) => clamp(winRates?.get(login) ?? 50, 0, 100);
  const xOfRate = (rate: number) => PAD + (rate / 100) * (plotW - 2 * PAD);

  // Regroupement (bucketing) : chaque joueur tombe dans une cellule de la grille
  // selon sa position réelle (win rate, ELO). Tous ceux d'une même cellule forment
  // UN amas affiché comme un seul point — au lieu de les étaler le long d'une ligne.
  const clusters = useMemo<Cluster[]>(() => {
    const sorted = [...entries].sort((a, b) => b.elo - a.elo || a.login.localeCompare(b.login));
    const buckets = new Map<string, { sx: number; sy: number; members: LeaderboardEntry[] }>();
    for (const e of sorted) {
      const bx = clamp(xOfRate(rateOf(e.login)), PAD, plotW - PAD);
      const by = clamp(yOfElo(e.elo), PAD, plotH - PAD);
      const key = `${Math.round(bx / CELL)},${Math.round(by / CELL)}`;
      const b = buckets.get(key);
      if (b) {
        b.sx += bx;
        b.sy += by;
        b.members.push(e);
      } else {
        buckets.set(key, { sx: bx, sy: by, members: [e] });
      }
    }
    return Array.from(buckets.entries()).map(([id, b]) => ({
      id,
      bx: b.sx / b.members.length,
      by: b.sy / b.members.length,
      members: b.members,
    }));
    // yOfElo / xOfRate dépendent de plotW/plotH/domain/winRates → déps explicites
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, plotW, plotH, domain.eMin, domain.eMax, winRates]);

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
      onDrag: ({ offset: [ox, oy], tap }) => {
        // Un vrai glissement (pas un tap sur une tête) referme l'amas déployé.
        if (!tap) setOpenCluster(null);
        setView((v) => ({ ...v, tx: ox, ty: oy }));
      },
      onWheel: ({ event, delta: [, dy] }) => {
        event.preventDefault();
        setOpenCluster(null);
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
  const rateTicks = [0, 25, 50, 75, 100];

  // Position écran (base) de la tête survolée, pour l'infobulle — qu'elle soit
  // dans un amas replié ou déployée en cercle.
  const hoveredPos = useMemo(() => {
    if (!hovered) return null;
    for (const c of clusters) {
      const idx = c.members.findIndex((m) => m.login === hovered);
      if (idx < 0) continue;
      const entry = c.members[idx];
      if (c.members.length === 1 || openCluster !== c.id) return { entry, bx: c.bx, by: c.by };
      const off = fanOffset(idx, c.members.length);
      return { entry, bx: c.bx + off.x, by: c.by + off.y };
    }
    return null;
  }, [hovered, openCluster, clusters]);

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

      {/* Légende + explication */}
      <div className="absolute top-2 left-2 z-20 pointer-events-none flex flex-col gap-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-2">
          ELO ↑  ·  Win % →
        </div>
        <div className="flex items-center gap-2 text-[9px] text-muted-2/80 font-medium">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-gold/70" />
          Haut-droite = meilleur
          <span className="opacity-40">·</span>
          <span>×N = amas, tap pour déployer</span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden rounded-xl card-hud cursor-grab active:cursor-grabbing select-none touch-none"
      >
        {/* Axe Y — ELO (ordonnée). Ligne, graduations chiffrées + traits. */}
        <div
          className="absolute left-0 overflow-hidden pointer-events-none"
          style={{ width: M.l, top: M.t, height: plotH }}
        >
          {/* Ligne d'axe verticale */}
          <div className="absolute top-0 bottom-0 right-0 w-px bg-border" />
          {eloTicks.map((v, i) => (
            <div
              key={i}
              className="absolute right-0 -translate-y-1/2 flex items-center gap-1"
              style={{ top: view.ty + yOfElo(v) * view.scale }}
            >
              <span className="font-mono text-[9px] text-muted-2 tabular-nums">{Math.round(v)}</span>
              {/* Trait de graduation */}
              <span className="w-1.5 h-px bg-border" />
            </div>
          ))}
        </div>

        {/* Titre de l'axe Y — « ELO », vertical le long du bord gauche */}
        <div
          className="absolute left-0 top-0 pointer-events-none flex items-center justify-center"
          style={{ width: 14, height: M.t + plotH }}
        >
          <span
            className="font-bold uppercase tracking-[0.16em] text-[9px] text-muted-2"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            ELO (ordonnée) ↑
          </span>
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

          {/* Lignes Win % verticales */}
          {rateTicks.map((r, i) => (
            <div
              key={`v${i}`}
              className="absolute top-0 bottom-0 w-px bg-gold/[0.05]"
              style={{ left: view.tx + xOfRate(r) * view.scale }}
            />
          ))}

          {/* Amas de joueurs — un point par cellule, déployé en cercle si plusieurs */}
          {clusters.map((c) => {
            const { lx, ly } = toLocal(c.bx, c.by);
            const open = openCluster === c.id;
            const multi = c.members.length > 1;
            const meIdx = myLogin != null ? c.members.findIndex((m) => m.login === myLogin) : -1;
            const containsMe = meIdx >= 0;
            // Tête visible quand l'amas est replié : « moi » si présent, sinon le plus fort.
            const repIdx = meIdx >= 0 ? meIdx : 0;

            const openFan = () => multi && setOpenCluster(c.id);
            const closeFan = () => setOpenCluster((o) => (o === c.id ? null : o));

            return (
              <div
                key={c.id}
                className="absolute"
                style={{ left: lx, top: ly, zIndex: open ? 45 : containsMe ? 20 : 10 }}
                onMouseEnter={openFan}
                onMouseLeave={() => {
                  closeFan();
                  setHovered((h) => (c.members.some((m) => m.login === h) ? null : h));
                }}
              >
                {/* Déploiement circulaire des membres (ou tête unique au centre) */}
                <AnimatePresence>
                  {c.members.map((e, i) => {
                    // Replié : tout le monde au centre. Déployé : en cercle.
                    const spread = open && multi;
                    const off = spread ? fanOffset(i, c.members.length) : { x: 0, y: 0 };
                    // Au repli, seule la tête « représentante » reste visible.
                    if (!spread && i !== repIdx) return null;
                    const isMe = e.login === myLogin;
                    const isHover = e.login === hovered;
                    return (
                      // motion.div : porte le déploiement (x/y) + apparition (opacity/scale).
                      // L'enfant (button) gère le centrage via translate CSS — non animé,
                      // donc sans conflit avec les transforms de framer-motion.
                      <motion.div
                        key={e.login}
                        className="absolute"
                        style={{ left: 0, top: 0 }}
                        initial={spread ? { x: 0, y: 0, opacity: 0, scale: 0.6 } : false}
                        animate={{
                          x: off.x * view.scale,
                          y: off.y * view.scale,
                          opacity: 1,
                          scale: 1,
                        }}
                        exit={{ x: 0, y: 0, opacity: 0, scale: 0.6 }}
                        transition={{ type: 'spring', stiffness: 520, damping: 32, mass: 0.6 }}
                      >
                        <button
                          type="button"
                          onMouseEnter={() => setHovered(e.login)}
                          onMouseLeave={() => setHovered((h) => (h === e.login ? null : h))}
                          onClick={(ev) => {
                            // Amas replié à plusieurs : 1er clic = déploie, ne navigue pas.
                            if (multi && !open) {
                              ev.stopPropagation();
                              openFan();
                              return;
                            }
                            navigate(`/player/${encodeURIComponent(e.login)}`);
                          }}
                          className="block -translate-x-1/2 -translate-y-1/2 rounded-full transition-shadow"
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
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Badge de comptage sur un amas replié (×N) — collé en haut-droite de la tête */}
                {multi && !open && (
                  <span
                    className="absolute z-20 pointer-events-none flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-gold text-bg-1 text-[9px] font-extrabold tabular-nums shadow-md ring-1 ring-bg-1"
                    style={{ left: 10, top: -10, transform: 'translate(-50%, -50%)' }}
                  >
                    ×{c.members.length}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Axe X — Win rate (abscisse). Ligne, graduations + traits, en bas. */}
        <div
          className="absolute overflow-hidden pointer-events-none"
          style={{ left: M.l, width: plotW, top: M.t + plotH, height: M.b }}
        >
          {/* Ligne d'axe horizontale */}
          <div className="absolute left-0 right-0 top-0 h-px bg-border" />
          {rateTicks.map((r, i) => (
            <div
              key={i}
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
              style={{ left: view.tx + xOfRate(r) * view.scale }}
            >
              {/* Trait de graduation */}
              <span className="w-px h-1.5 bg-border" />
              <span className="mt-0.5 font-mono text-[9px] text-muted-2 tabular-nums">{r}%</span>
            </div>
          ))}
          {/* Titre de l'axe X — « Win rate % » centré sous les graduations */}
          <span className="absolute left-1/2 -translate-x-1/2 bottom-0.5 font-bold uppercase tracking-[0.16em] text-[9px] text-muted-2">
            Taux de victoire % (abscisse) →
          </span>
        </div>

        {/* Infobulle (hors zone clippée pour ne pas être coupée) */}
        {hoveredPos && hoveredPos.entry && (
          <ScatterTooltip
            entry={hoveredPos.entry}
            left={M.l + toLocal(hoveredPos.bx, hoveredPos.by).lx}
            top={M.t + toLocal(hoveredPos.bx, hoveredPos.by).ly - 26}
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
