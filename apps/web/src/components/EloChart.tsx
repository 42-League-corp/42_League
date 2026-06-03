/**
 * EloChart — ligne lisse style motion.dev
 *
 * Inspiré de https://motion.dev/examples/react-line-graph :
 *  - Ligne SVG cubique (bezier, pas de polyline rigide)
 *  - Gradient fill animé en opacité au montage
 *  - Cursor spring : le dot + la ligne verticale suivent la souris
 *    avec useMotionValue + useSpring (stiffness 300, damping 30)
 *  - Tooltip premium glass au survol
 *  - Zéro label texte sur le graphe (épuré)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import type { Game, PlayedMatch } from '../lib/api';
import { useT } from '../lib/i18n';
import { useLeagueData } from '../hooks/useLeagueData';
import { Avatar } from './Avatar';

// ─── Types & helpers ──────────────────────────────────────────────────────────

interface EloChartProps {
  matches: PlayedMatch[];
  myLogin: string;
  currentElo: number;
  game?: Game;
  /** @deprecated kept for compatibility — label supprimé dans tous les cas */
  hideStartLabel?: boolean;
  maxPoints?: number;
  height?: number;
}

interface EloPoint {
  elo: number;
  date: string;
  delta: number;
  isStart: boolean;
  opponent?: string;
  scoreFor?: number;
  scoreAgainst?: number;
}

function computeEloHistory(matches: PlayedMatch[], myLogin: string, currentElo: number): EloPoint[] {
  const mine = matches
    .filter((m) => (m.playerALogin === myLogin || m.playerBLogin === myLogin) && m.countedForElo)
    .sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime());
  if (mine.length === 0) return [];
  const deltas = mine.map((m) => (m.playerALogin === myLogin ? m.deltaA : m.deltaB));
  const startElo = currentElo - deltas.reduce((s, d) => s + d, 0);
  const points: EloPoint[] = [{ elo: startElo, date: mine[0]?.playedAt ?? '', delta: 0, isStart: true }];
  let elo = startElo;
  for (let i = 0; i < mine.length; i++) {
    const delta = deltas[i] ?? 0;
    const match = mine[i]!;
    const isA = match.playerALogin === myLogin;
    elo += delta;
    points.push({
      elo, date: match.playedAt, delta, isStart: false,
      opponent: isA ? match.playerBLogin : match.playerALogin,
      scoreFor: isA ? match.scoreA : match.scoreB,
      scoreAgainst: isA ? match.scoreB : match.scoreA,
    });
  }
  return points;
}

/** Chemin SVG cubique (lissé) entre les points. */
function buildCubicPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length === 1 ? `M ${pts[0]!.x} ${pts[0]!.y}` : '';
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!;
    const curr = pts[i]!;
    const tension = 0.35;
    const cp1x = prev.x + (curr.x - prev.x) * tension;
    const cp1y = prev.y;
    const cp2x = curr.x - (curr.x - prev.x) * tension;
    const cp2y = curr.y;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function fmtDate(iso: string): string {
  try { return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(iso)); }
  catch { return ''; }
}

const GOLD = '#ffc94a';
const RED = '#ff5366';
const WIN = '#7fd66e';
const LOSS = '#ff5366';

// ─── Sous-composants tooltip ───────────────────────────────────────────────────

/** Un chiffre qui roule verticalement (sens selon la tendance). */
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

/** Compteur ELO à roulettes — seuls les chiffres qui changent s'animent. */
function RollingNumber({ value, up }: { value: number; up: boolean }) {
  const chars = Math.round(value).toString().split('');
  return (
    <span className="inline-flex tabular-nums">
      {chars.map((c, i) => <RollDigit key={chars.length - 1 - i} ch={c} up={up} />)}
    </span>
  );
}

/** Flèche diagonale ↗ (victoire) / ↘ (défaite), rotation + couleur fluides. */
function TrendArrow({ up }: { up: boolean }) {
  const c = up ? WIN : LOSS;
  return (
    <motion.span
      className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-md"
      animate={{ rotate: up ? 0 : 90, color: c, backgroundColor: `${c}22` }}
      transition={{ rotate: { type: 'spring', stiffness: 130, damping: 18 }, default: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }}
      style={{ color: c }}
    >
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17 L17 7 M10 7 H17 V14" />
      </svg>
    </motion.span>
  );
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function EloChart({
  matches, myLogin, currentElo,
  game = 'babyfoot',
  hideStartLabel: _hideStartLabel = false,
  maxPoints, height = 100,
}: EloChartProps) {
  const t = useT();
  const { leaderboard } = useLeagueData();
  const imageByLogin = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const e of leaderboard) map.set(e.login, e.imageUrl);
    return map;
  }, [leaderboard]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(360);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => { const w = e[0]?.contentRect.width; if (w && w > 0) setW(w); });
    ro.observe(el);
    setW(el.clientWidth || 360);
    return () => ro.disconnect();
  }, []);

  const history = useMemo(
    () => computeEloHistory(matches.filter((m) => (m.game ?? 'babyfoot') === game), myLogin, currentElo),
    [matches, myLogin, currentElo, game],
  );

  const points = maxPoints ? history.slice(-maxPoints) : history;

  // ─── Mouse cursor spring ──────────────────────────────────────────────────
  const mouseX = useMotionValue(-1);
  const springX = useSpring(mouseX, { stiffness: 300, damping: 30, mass: 0.5 });
  const [hovered, setHovered] = useState<number | null>(null);

  const H = height;
  const padL = 4; const padR = 4; const padTop = 12; const padBot = 8;
  const plotH = H - padTop - padBot;

  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center text-xs text-muted-2 italic" style={{ height: H }}>
        {t('profil.notEnoughMatches')}
      </div>
    );
  }

  const eloValues = points.map((p) => p.elo);
  const minElo = Math.min(...eloValues);
  const maxElo = Math.max(...eloValues);
  const range = maxElo - minElo || 80;
  const padV = range * 0.25;
  const yMin = minElo - padV; const yMax = maxElo + padV;

  const yOf = (elo: number) => padTop + (1 - (elo - yMin) / (yMax - yMin)) * plotH;

  const mapped = points.map((p, i) => ({
    x: padL + (i / Math.max(points.length - 1, 1)) * (W - padL - padR),
    y: yOf(p.elo),
    ...p,
  }));

  const isUp = (points.at(-1)?.elo ?? 0) >= (points[0]?.elo ?? 0);
  const lineColor = isUp ? GOLD : RED;
  const gradId = `eg-${myLogin.replace(/\W/g, '')}-${game}`;

  const linePath = buildCubicPath(mapped);
  const areaPath = linePath + ` L ${mapped.at(-1)!.x} ${H - padBot} L ${padL} ${H - padBot} Z`;

  // Curseur actif (index du point le plus proche de la souris)
  const hoveredPt = hovered !== null ? mapped[hovered] : null;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    mouseX.set(relX);
    // Trouve le point le plus proche
    let best = 0; let bestDist = Infinity;
    mapped.forEach((p, i) => { const d = Math.abs(p.x - relX); if (d < bestDist) { bestDist = d; best = i; } });
    setHovered(best);
  };

  const dotCx = useTransform(springX, () => hoveredPt?.x ?? -100);

  return (
    <div ref={containerRef} className="relative w-full select-none" style={{ height: H }}>
      <svg
        viewBox={`0 0 ${W} ${H}`} width="100%" height={H}
        className="overflow-visible"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setHovered(null); mouseX.set(-1); }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.22" />
            <stop offset="85%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gradient fill */}
        <motion.path
          d={areaPath}
          fill={`url(#${gradId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />

        {/* Main line — draw animation */}
        <motion.path
          d={linePath}
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        />

        {/* ELO actuel (dernier point) */}
        {(() => {
          const last = mapped.at(-1)!;
          return (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
              <circle cx={last.x} cy={last.y} r={5} fill={lineColor} stroke="rgba(8,10,14,0.9)" strokeWidth="2" />
              <circle cx={last.x} cy={last.y} r={9} fill={lineColor} fillOpacity="0.12" />
            </motion.g>
          );
        })()}

        {/* Cursor vertical line */}
        {hoveredPt && (
          <line
            x1={hoveredPt.x} y1={padTop}
            x2={hoveredPt.x} y2={H - padBot}
            stroke={lineColor}
            strokeWidth="1"
            strokeOpacity="0.35"
            strokeDasharray="3 3"
          />
        )}

        {/* Cursor dot (spring-animated) */}
        {hoveredPt && (
          <motion.circle
            cx={dotCx}
            cy={hoveredPt.y}
            r="5"
            fill={hoveredPt.delta >= 0 ? GOLD : RED}
            stroke="rgba(8,10,14,0.85)"
            strokeWidth="2"
          />
        )}

        {/* Zone de survol transparente (pleine largeur) */}
        <rect x={padL} y={padTop} width={W - padL - padR} height={plotH}
          fill="transparent" style={{ cursor: 'crosshair' }} />
      </svg>

      {/* Tooltip premium glass — adversaire, ELO à roulettes, résultat */}
      {hoveredPt && !hoveredPt.isStart && (() => {
        const won = (hoveredPt.scoreFor ?? 0) > (hoveredPt.scoreAgainst ?? 0);
        const opp = hoveredPt.opponent ?? '?';
        return (
          <div
            className="absolute z-20 pointer-events-none -translate-x-1/2 rounded-xl overflow-hidden"
            style={{
              left: Math.min(Math.max(hoveredPt.x, 104), W - 104),
              top: Math.max(hoveredPt.y - 104, 0),
              background: 'linear-gradient(145deg, rgba(24,20,12,0.97) 0%, rgba(14,12,7,0.99) 100%)',
              border: `1px solid ${won ? 'rgba(127,214,110,0.4)' : 'rgba(255,83,102,0.4)'}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,215,120,0.06)',
              backdropFilter: 'blur(20px)',
              minWidth: 196,
            }}
          >
            {/* Barre de couleur en haut */}
            <div className="h-[2px]" style={{ background: won ? WIN : LOSS }} />
            <div className="px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="rounded-full p-[1.5px]" style={{ background: won ? WIN : LOSS }}>
                  <Avatar login={opp} imageUrl={imageByLogin.get(opp) ?? null} size="sm" />
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="text-[8px] font-bold uppercase tracking-wider text-muted">vs</div>
                  <div className="max-w-[84px] truncate text-xs font-extrabold text-text-strong">{opp}</div>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <TrendArrow up={won} />
                  <div className="text-right leading-tight">
                    <div className="font-display text-base font-black tabular-nums" style={{ color: won ? WIN : LOSS }}>
                      <RollingNumber value={hoveredPt.elo} up={won} />
                    </div>
                    <div className="text-[8px] font-bold uppercase tracking-wider text-muted">elo</div>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-1.5">
                <span className="font-mono text-[11px] font-bold tabular-nums text-muted-2">
                  {hoveredPt.scoreFor}–{hoveredPt.scoreAgainst}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold" style={{ color: won ? WIN : LOSS }}>{won ? 'Victoire' : 'Défaite'}</span>
                  <span className={`font-mono text-[10px] font-extrabold tabular-nums ${hoveredPt.delta >= 0 ? 'text-[#7fd66e]' : 'text-red'}`}>
                    {hoveredPt.delta >= 0 ? '+' : ''}{hoveredPt.delta}
                  </span>
                </span>
              </div>
              <div className="mt-1 font-mono text-[8px] text-muted opacity-60">{fmtDate(hoveredPt.date)}</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
