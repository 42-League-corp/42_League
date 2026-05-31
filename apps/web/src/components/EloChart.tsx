import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Game, PlayedMatch } from '../lib/api';
import { useT } from '../lib/i18n';

interface EloChartProps {
  matches: PlayedMatch[];
  myLogin: string;
  currentElo: number;
  /** Jeu à tracer (babyfoot par défaut) — filtre les matchs par discipline. */
  game?: Game;
  /** Cap the number of matches shown. Omit (default) to show the full history from the start. */
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

const STARTING_ELO = 1000;

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

  // Origin point: ELO before the very first counted match → lets us "see from the start".
  const points: EloPoint[] = [
    { elo: startElo, date: mine[0]?.playedAt ?? '', delta: 0, isStart: true },
  ];
  let elo = startElo;
  for (let i = 0; i < mine.length; i++) {
    const delta = deltas[i] ?? 0;
    const match = mine[i]!;
    const isA = match.playerALogin === myLogin;
    elo += delta;
    points.push({
      elo,
      date: match.playedAt,
      delta,
      isStart: false,
      opponent: isA ? match.playerBLogin : match.playerALogin,
      scoreFor: isA ? match.scoreA : match.scoreB,
      scoreAgainst: isA ? match.scoreB : match.scoreA,
    });
  }
  return points;
}

function buildSvgPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  const first = pts[0];
  if (!first) return '';
  if (pts.length === 1) return `M ${first.x} ${first.y}`;
  // Polyligne rigide : segments droits entre chaque match → on voit nettement
  // chaque variation d'ELO (le lissage gommait les écarts entre points proches).
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < pts.length; i++) {
    const curr = pts[i];
    if (!curr) continue;
    d += ` L ${curr.x} ${curr.y}`;
  }
  return d;
}

const GOLD = '#ffc94a';
const RED = '#ff5366';
const MUTED = '#8a8f9a';

/** Date courte en français : "02 janv.". */
function fmtDateFr(iso: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(iso));
  } catch {
    return '';
  }
}

export function EloChart({
  matches,
  myLogin,
  currentElo,
  game = 'babyfoot',
  maxPoints,
  height = 100,
}: EloChartProps) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const [hovered, setHovered] = useState<number | null>(null);

  // Measure the real pixel width so dots stay round and labels stay legible
  // (no preserveAspectRatio="none" stretching).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    ro.observe(el);
    setWidth(el.clientWidth || 360);
    return () => ro.disconnect();
  }, []);

  const history = useMemo(
    () =>
      computeEloHistory(
        matches.filter((m) => (m.game ?? 'babyfoot') === game),
        myLogin,
        currentElo,
      ),
    [matches, myLogin, currentElo, game],
  );

  const points = maxPoints ? history.slice(-maxPoints) : history;

  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-16 text-xs text-muted-2 italic">
        {t('profil.notEnoughMatches')}
      </div>
    );
  }

  const eloValues = points.map((p) => p.elo);
  // On inclut la ligne de départ (1000) dans l'échelle si elle est proche, pour
  // qu'elle reste visible quand l'ELO a peu bougé.
  const minElo = Math.min(...eloValues);
  const maxElo = Math.max(...eloValues);
  const range = maxElo - minElo || 80;
  const padV = range * 0.22;
  const yMin = minElo - padV;
  const yMax = maxElo + padV;

  const W = width;
  const H = height;
  const padL = 16;
  const padR = 16;
  const padTop = 16;
  // Place pour une rangée de dates en bas.
  const padBot = 24;
  const plotH = H - padTop - padBot;

  const yOf = (elo: number) => padTop + (1 - (elo - yMin) / (yMax - yMin)) * plotH;

  const mapped = points.map((p, i) => ({
    x: padL + (i / Math.max(points.length - 1, 1)) * (W - padL - padR),
    y: yOf(p.elo),
    elo: p.elo,
    delta: p.delta,
    isStart: p.isStart,
    date: p.date,
    opponent: p.opponent,
    scoreFor: p.scoreFor,
    scoreAgainst: p.scoreAgainst,
  }));

  const lastPt = mapped[mapped.length - 1];
  const firstPt = mapped[0];
  if (!lastPt || !firstPt) return null;

  const linePath = buildSvgPath(mapped);
  const areaPath = `${linePath} L ${lastPt.x} ${H - padBot} L ${firstPt.x} ${H - padBot} Z`;

  const isUp = (points[points.length - 1]?.elo ?? 0) >= (points[0]?.elo ?? 0);
  const lineColor = isUp ? GOLD : RED;
  const gradId = `elo-grad-${myLogin.replace(/\W/g, '')}`;

  // Ligne de référence à 1000 (ELO de départ), seulement si dans l'échelle visible.
  const showStartLine = STARTING_ELO >= yMin && STARTING_ELO <= yMax;
  const startLineY = yOf(STARTING_ELO);

  // Labels numériques d'ELO : espacement mini pour éviter le chevauchement.
  const minGap = 34;
  const labelSet = new Set<number>();
  let lastLabelX = -Infinity;
  mapped.forEach((p, i) => {
    if (p.x - lastLabelX >= minGap) {
      labelSet.add(i);
      lastLabelX = p.x;
    }
  });
  const lastIdx = mapped.length - 1;
  if (!labelSet.has(lastIdx)) {
    if (lastPt.x - lastLabelX < minGap) {
      let prevLabeled = -1;
      labelSet.forEach((i) => {
        if (i > prevLabeled) prevLabeled = i;
      });
      if (prevLabeled >= 0) labelSet.delete(prevLabeled);
    }
    labelSet.add(lastIdx);
  }

  // Dates en abscisse : premier, milieu, dernier (évite la surcharge).
  const dateIdx = new Set<number>([0, Math.floor(lastIdx / 2), lastIdx]);

  const dotR = points.length > 40 ? 1.8 : points.length > 22 ? 2.2 : 2.8;
  const hoveredPt = hovered != null ? mapped[hovered] : null;

  return (
    <div ref={containerRef} className="relative w-full select-none" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="overflow-visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={0}
            y1={padTop + plotH * g}
            x2={W}
            y2={padTop + plotH * g}
            stroke="rgba(255,201,74,0.06)"
            strokeWidth="1"
          />
        ))}

        {/* Ligne de référence ELO de départ (1000), pointillés */}
        {showStartLine && (
          <>
            <line
              x1={padL}
              y1={startLineY}
              x2={W - padR}
              y2={startLineY}
              stroke="rgba(228,231,237,0.28)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            {/* Étiquette « départ » sur un fond opaque, basculée sous la ligne si
                celle-ci est trop haute — évite tout chevauchement avec les
                valeurs ELO ou le bord supérieur. */}
            {(() => {
              const below = startLineY < 14;
              const ty = below ? startLineY + 10 : startLineY - 4;
              return (
                <>
                  <rect
                    x={padL}
                    y={ty - 8}
                    width={30}
                    height={11}
                    rx={2}
                    fill="#14151c"
                    opacity={0.9}
                  />
                  <text
                    x={padL + 3}
                    y={ty}
                    fontSize={8}
                    fontWeight={700}
                    className="font-mono uppercase"
                    fill="rgba(228,231,237,0.6)"
                  >
                    départ
                  </text>
                </>
              );
            })()}
          </>
        )}

        {/* Area fill */}
        <motion.path
          d={areaPath}
          fill={`url(#${gradId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        />

        {/* Main line */}
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

        {/* Repère vertical sur le point survolé */}
        {hoveredPt && (
          <line
            x1={hoveredPt.x}
            y1={padTop}
            x2={hoveredPt.x}
            y2={H - padBot}
            stroke="rgba(255,201,74,0.25)"
            strokeWidth="1"
          />
        )}

        {/* Per-match dots — coloured by gain (gold) / loss (red) */}
        {mapped.map((p, i) => {
          const color = p.isStart ? MUTED : p.delta >= 0 ? GOLD : RED;
          const isLast = i === lastIdx;
          return (
            <motion.circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={isLast ? dotR + 1.2 : dotR}
              fill={color}
              stroke="rgba(8,10,14,0.85)"
              strokeWidth="1"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                delay: 0.3 + (i / Math.max(mapped.length - 1, 1)) * 0.8,
                type: 'spring',
                stiffness: 500,
                damping: 20,
              }}
            />
          );
        })}

        {/* Glow on the current point */}
        <circle cx={lastPt.x} cy={lastPt.y} r={dotR + 5} fill={lineColor} fillOpacity="0.12" />

        {/* Zones de survol transparentes (plus larges que les points) */}
        {mapped.map((p, i) => (
          <circle
            key={`hit-${i}`}
            cx={p.x}
            cy={p.y}
            r={10}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
          />
        ))}

        {/* Numeric labels */}
        {mapped.map((p, i) => {
          if (!labelSet.has(i)) return null;
          const isLast = i === lastIdx;
          const above = p.y > padTop + 12;
          const ly = above ? p.y - (isLast ? 9 : 7) : p.y + (isLast ? 16 : 13);
          const lx = Math.min(Math.max(p.x, padL + 2), W - padR - 2);
          return (
            <motion.text
              key={`l-${i}`}
              x={lx}
              y={ly}
              textAnchor="middle"
              className="font-mono"
              fontSize={isLast ? 11 : 9}
              fontWeight={isLast ? 700 : 600}
              fill={isLast ? lineColor : 'rgba(228,231,237,0.62)'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                delay: 0.4 + (i / Math.max(mapped.length - 1, 1)) * 0.8,
                duration: 0.3,
              }}
            >
              {Math.round(p.elo)}
            </motion.text>
          );
        })}

        {/* Dates en abscisse (FR) */}
        {mapped.map((p, i) => {
          if (!dateIdx.has(i)) return null;
          const lx = Math.min(Math.max(p.x, padL + 10), W - padR - 10);
          const anchor = i === 0 ? 'start' : i === lastIdx ? 'end' : 'middle';
          return (
            <text
              key={`d-${i}`}
              x={anchor === 'start' ? padL : anchor === 'end' ? W - padR : lx}
              y={H - 6}
              textAnchor={anchor}
              fontSize={8}
              className="font-mono"
              fill="rgba(228,231,237,0.4)"
            >
              {fmtDateFr(p.date)}
            </text>
          );
        })}
      </svg>

      {/* Tooltip HTML au survol */}
      {hoveredPt && (
        <div
          className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full card-hud rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap"
          style={{
            left: Math.min(Math.max(hoveredPt.x, 60), W - 60),
            top: Math.max(hoveredPt.y - 8, 4),
          }}
        >
          <div className="text-[10px] font-mono text-muted-2 leading-tight">{fmtDateFr(hoveredPt.date)}</div>
          <div className="text-xs font-extrabold text-text-strong leading-tight">
            {Math.round(hoveredPt.elo)} ELO
            {!hoveredPt.isStart && (
              <span className={`ml-1.5 font-mono ${hoveredPt.delta >= 0 ? 'text-[#7fd66e]' : 'text-red'}`}>
                {hoveredPt.delta >= 0 ? '+' : ''}
                {hoveredPt.delta}
              </span>
            )}
          </div>
          {hoveredPt.isStart ? (
            <div className="text-[10px] text-muted-2 leading-tight">Départ</div>
          ) : (
            <div className="text-[10px] text-muted-2 leading-tight">
              vs {hoveredPt.opponent} · {hoveredPt.scoreFor}-{hoveredPt.scoreAgainst}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
