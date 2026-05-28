import { useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import type { PlayedMatch } from '../lib/api';

interface EloChartProps {
  matches: PlayedMatch[];
  myLogin: string;
  currentElo: number;
  maxPoints?: number;
  height?: number;
}

interface EloPoint {
  elo: number;
  date: string;
  delta: number;
}

function computeEloHistory(
  matches: PlayedMatch[],
  myLogin: string,
  currentElo: number,
): EloPoint[] {
  const mine = matches
    .filter((m) => (m.playerALogin === myLogin || m.playerBLogin === myLogin) && m.countedForElo)
    .sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime());

  if (mine.length === 0) return [];

  const deltas = mine.map((m) => (m.playerALogin === myLogin ? m.deltaA : m.deltaB));
  const startElo = currentElo - deltas.reduce((s, d) => s + d, 0);

  const points: EloPoint[] = [];
  let elo = startElo;
  for (let i = 0; i < mine.length; i++) {
    const delta = deltas[i] ?? 0;
    const match = mine[i];
    elo += delta;
    points.push({ elo, date: match?.playedAt ?? '', delta });
  }
  return points;
}

function buildSvgPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  const first = pts[0];
  if (!first) return '';
  if (pts.length === 1) return `M ${first.x} ${first.y}`;
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    if (!prev || !curr) continue;
    const cp1x = prev.x + (curr.x - prev.x) * 0.5;
    const cp2x = curr.x - (curr.x - prev.x) * 0.5;
    d += ` C ${cp1x} ${prev.y}, ${cp2x} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

export function EloChart({
  matches,
  myLogin,
  currentElo,
  maxPoints = 30,
  height = 100,
}: EloChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const history = useMemo(
    () => computeEloHistory(matches, myLogin, currentElo),
    [matches, myLogin, currentElo],
  );

  const points = history.slice(-maxPoints);

  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-16 text-xs text-muted-2 italic">
        Pas encore assez de matches
      </div>
    );
  }

  const eloValues = points.map((p) => p.elo);
  const minElo = Math.min(...eloValues);
  const maxElo = Math.max(...eloValues);
  const range = maxElo - minElo || 80;
  const padV = range * 0.18;
  const yMin = minElo - padV;
  const yMax = maxElo + padV;

  const W = 400;
  const H = height;
  const padH = 4;

  const mapped = points.map((p, i) => ({
    x: padH + (i / Math.max(points.length - 1, 1)) * (W - padH * 2),
    y: H - ((p.elo - yMin) / (yMax - yMin)) * H,
    elo: p.elo,
  }));

  const lastPt = mapped[mapped.length - 1];
  const firstPt = mapped[0];

  if (!lastPt || !firstPt) return null;

  const linePath = buildSvgPath(mapped);
  const areaPath = `${linePath} L ${lastPt.x} ${H} L ${firstPt.x} ${H} Z`;

  const isUp = (points[points.length - 1]?.elo ?? 0) >= (points[0]?.elo ?? 0);
  const lineColor = isUp ? '#ffc94a' : '#ff5366';
  const gradId = `elo-grad-${myLogin.replace(/\W/g, '')}`;

  return (
    <div className="relative w-full select-none" style={{ height }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <motion.path
          d={areaPath}
          fill={`url(#${gradId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        />

        {/* Subtle grid lines */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={0} y1={H * t} x2={W} y2={H * t}
            stroke="rgba(255,201,74,0.06)"
            strokeWidth="1"
          />
        ))}

        {/* Main line — animated draw-on */}
        <motion.path
          d={linePath}
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        />

        {/* Last point glow dot */}
        <circle cx={lastPt.x} cy={lastPt.y} r="7" fill={lineColor} fillOpacity="0.12" />
        <motion.circle
          cx={lastPt.x}
          cy={lastPt.y}
          r="3"
          fill={lineColor}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1.1, type: 'spring', stiffness: 500, damping: 18 }}
        />
      </svg>

      {/* ELO labels */}
      <div className="absolute top-0 right-0 pointer-events-none">
        <span className="text-[9px] font-mono font-bold text-gold/55">{maxElo}</span>
      </div>
      <div className="absolute bottom-0 right-0 pointer-events-none">
        <span className="text-[9px] font-mono font-bold text-muted/45">{minElo}</span>
      </div>
    </div>
  );
}
