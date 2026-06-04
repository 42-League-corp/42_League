import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Gem, Shield } from 'lucide-react';
import { RANK_TIERS, rankTier } from '@42-league/shared';
import { Avatar } from '../components/Avatar';
import { useLeagueData } from '../hooks/useLeagueData';
import { useGameMode } from '../hooks/useGameMode';
import type { LeaderboardEntry } from '../lib/api';

// ─── constantes de mise en page ────────────────────────────────────────────────

/** ELO minimal affiché à gauche de la frise (léger espace avant Étain). */
const TRACK_MIN = 850;

/** Rayon de cluster : deux joueurs à ≤ N ELO d'écart sont regroupés en colonne. */
const CLUSTER_RADIUS = 22;

/** Nombre max d'avatars affichés par colonne avant le badge "+N". */
const MAX_PER_COL = 8;

// ─── helpers ───────────────────────────────────────────────────────────────────

function toPercent(elo: number, trackMax: number) {
  return Math.max(0, Math.min(100, ((elo - TRACK_MIN) / (trackMax - TRACK_MIN)) * 100));
}

interface Cluster {
  center: number;
  pct: number;
  entries: LeaderboardEntry[];
}

function buildClusters(entries: LeaderboardEntry[], trackMax: number): Cluster[] {
  if (!entries.length) return [];
  const sorted = [...entries].sort((a, b) => a.elo - b.elo);
  const groups: LeaderboardEntry[][] = [];
  for (const entry of sorted) {
    const last = groups[groups.length - 1];
    const tail = last?.[last.length - 1];
    if (last && tail && entry.elo - tail.elo <= CLUSTER_RADIUS) {
      last.push(entry);
    } else {
      groups.push([entry]);
    }
  }
  return groups.map((g) => {
    const center = g.reduce((s, e) => s + e.elo, 0) / g.length;
    return { center, pct: toPercent(center, trackMax), entries: g };
  });
}

// ─── composant ─────────────────────────────────────────────────────────────────

export function GradesPage() {
  const navigate = useNavigate();
  const { leaderboard, me } = useLeagueData();
  const { game } = useGameMode();
  const myLogin = me?.login;

  const trackMax = useMemo(() => {
    const max = leaderboard.reduce((m, e) => Math.max(m, e.elo), 1500);
    return max + 160;
  }, [leaderboard]);

  const clusters = useMemo(
    () => buildClusters(leaderboard, trackMax),
    [leaderboard, trackMax],
  );

  const myEntry = leaderboard.find((e) => e.login === myLogin);
  const myTier = myEntry ? rankTier(myEntry.elo) : null;
  const nextTier = myEntry ? RANK_TIERS.find((t) => t.min > myEntry.elo) : null;
  const ptsToNext = nextTier && myEntry ? nextTier.min - myEntry.elo : null;
  const tierProgress =
    myEntry && nextTier
      ? Math.min(
          100,
          ((myEntry.elo - (myTier?.min ?? 0)) / (nextTier.min - (myTier?.min ?? 0))) * 100,
        )
      : null;

  // Segments de la frise (un par palier)
  const segments = RANK_TIERS.map((tier, i) => {
    const nextMin = RANK_TIERS[i + 1]?.min ?? trackMax;
    const segStart = Math.max(tier.min, TRACK_MIN);
    const segEnd = Math.min(nextMin, trackMax);
    const left = toPercent(segStart, trackMax);
    const width = toPercent(segEnd, trackMax) - left;
    const Icon = tier.key === 'diamant' ? Gem : Shield;
    return { tier, left, width, Icon };
  });

  // Hauteur de la zone d'avatars au-dessus de la barre
  const TRACK_H = 40;
  const AVATAR_ZONE_H = 220;
  const CONTAINER_H = AVATAR_ZONE_H + TRACK_H + 24; // + marge bas

  return (
    <div className="min-h-screen bg-bg-0 flex flex-col">
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-bg-0/95 backdrop-blur border-b border-border/40 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-2 hover:text-text hover:bg-bg-2 transition-colors flex-shrink-0"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
        </button>
        <div className="min-w-0">
          <div className="font-gaming text-xs font-extrabold uppercase tracking-[0.18em] text-gold">
            Frise des grades
          </div>
          <div className="text-[10px] text-muted-2 truncate">
            {leaderboard.length} joueur{leaderboard.length !== 1 ? 's' : ''} · {game}
          </div>
        </div>
      </div>

      {/* ── Frise scrollable ── */}
      <div className="flex-1 overflow-x-auto py-6 px-3">
        {leaderboard.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted-2 text-sm">
            Aucun joueur dans ce mode.
          </div>
        ) : (
          <div
            className="relative mx-auto"
            style={{ height: CONTAINER_H, minWidth: 720, maxWidth: 1400 }}
          >
            {/* ── Colonnes d'avatars ── */}
            {clusters.map((cluster, ci) => {
              const visible = cluster.entries.slice(0, MAX_PER_COL);
              const overflow = cluster.entries.length - visible.length;
              const tier = rankTier(cluster.center);
              const isMyCluster = cluster.entries.some((e) => e.login === myLogin);

              return (
                <div
                  key={ci}
                  className="absolute flex flex-col-reverse items-center"
                  style={{
                    left: `${cluster.pct}%`,
                    bottom: TRACK_H + 12,
                    transform: 'translateX(-50%)',
                    gap: 3,
                  }}
                >
                  {/* Trait connecteur colonne → piste */}
                  <div
                    className="w-px flex-shrink-0"
                    style={{
                      height: 10,
                      background: `${tier.color}${isMyCluster ? 'cc' : '50'}`,
                    }}
                  />

                  {/* Avatars (flex-col-reverse → 1er rendu = bas, dernier = haut) */}
                  {visible.map((entry) => {
                    const isMe = entry.login === myLogin;
                    const name =
                      entry.firstName && entry.lastName
                        ? `${entry.firstName} ${entry.lastName}`
                        : entry.login;
                    return (
                      <Link
                        key={entry.login}
                        to={`/player/${entry.login}`}
                        title={`${name} · ${entry.elo} ELO`}
                        className={`block rounded-full flex-shrink-0 transition-transform hover:scale-110 hover:z-10 relative ${
                          isMe
                            ? 'ring-2 ring-white ring-offset-1 ring-offset-bg-0 z-10'
                            : ''
                        }`}
                      >
                        <Avatar
                          login={entry.login}
                          imageUrl={entry.imageUrl}
                          size="xs"
                        />
                      </Link>
                    );
                  })}

                  {/* Badge de débordement */}
                  {overflow > 0 && (
                    <div
                      className="flex items-center justify-center rounded-full font-extrabold flex-shrink-0"
                      style={{
                        width: 22,
                        height: 22,
                        fontSize: 8,
                        color: tier.color,
                        border: `1px solid ${tier.color}50`,
                        background: `${tier.color}18`,
                      }}
                    >
                      +{overflow}
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Barre de la frise ── */}
            <div
              className="absolute left-0 right-0 rounded-full overflow-hidden"
              style={{ bottom: 12, height: TRACK_H }}
            >
              {/* Fond global sombre */}
              <div className="absolute inset-0 bg-bg-2" />

              {/* Segments colorés par palier */}
              {segments.map(({ tier, left, width, Icon }) => (
                <div
                  key={tier.key}
                  className="absolute inset-y-0 flex flex-col items-center justify-center overflow-hidden"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    background: `linear-gradient(135deg, ${tier.color}18 0%, ${tier.color}2e 100%)`,
                    borderRight: `1px solid ${tier.color}35`,
                  }}
                >
                  <Icon
                    className="w-3.5 h-3.5 mb-0.5 flex-shrink-0"
                    strokeWidth={2}
                    style={{ color: `${tier.color}cc` }}
                  />
                  <span
                    className="font-gaming text-[8px] font-extrabold uppercase tracking-[0.12em] leading-none truncate px-0.5"
                    style={{ color: tier.color }}
                  >
                    {tier.label}
                  </span>
                </div>
              ))}

              {/* Contour global */}
              <div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
              />
            </div>

            {/* ── Marqueurs de seuil (tirets fins) ── */}
            {RANK_TIERS.slice(1).map((tier) => {
              const left = toPercent(tier.min, trackMax);
              return (
                <div
                  key={tier.key}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${left}%`,
                    bottom: 12,
                    height: TRACK_H,
                    width: 1,
                    background: `${tier.color}60`,
                  }}
                />
              );
            })}

            {/* ── Aiguille « ma position » ── */}
            {myEntry && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${toPercent(myEntry.elo, trackMax)}%`,
                  bottom: 12 + TRACK_H,
                  height: AVATAR_ZONE_H - 12,
                  width: 1,
                  transform: 'translateX(-50%)',
                  background: `linear-gradient(to bottom, transparent 0%, ${myTier?.color ?? '#ffc94a'}55 60%, ${myTier?.color ?? '#ffc94a'}99 100%)`,
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Barre info perso (sticky bas) ── */}
      {myEntry && myTier && (
        <div className="sticky bottom-0 z-10 bg-bg-1/97 backdrop-blur border-t border-border/40 px-4 py-3 flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <Avatar login={myEntry.login} imageUrl={myEntry.imageUrl} size="xs" />
            <div
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg-1 flex-shrink-0"
              style={{ background: myTier.color }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-extrabold text-text-strong tabular-nums">
                {myEntry.elo} ELO
              </span>
              <span
                className="font-gaming text-[9px] font-extrabold uppercase tracking-wider"
                style={{ color: myTier.color }}
              >
                {myTier.label}
              </span>
            </div>
            {ptsToNext && nextTier ? (
              <div className="text-[10px] text-muted-2 leading-tight">
                {ptsToNext} pt{ptsToNext > 1 ? 's' : ''} avant{' '}
                <span style={{ color: nextTier.color }} className="font-bold">
                  {nextTier.label}
                </span>
              </div>
            ) : (
              <div className="text-[10px] text-muted-2">Grade maximal atteint</div>
            )}
          </div>

          {/* Mini barre de progression dans le grade courant */}
          {tierProgress !== null && nextTier && (
            <div className="flex-shrink-0 w-24">
              <div className="h-1.5 rounded-full overflow-hidden bg-bg-3">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${tierProgress}%`, background: myTier.color }}
                />
              </div>
              <div className="flex justify-between mt-0.5">
                <span style={{ color: myTier.color }} className="text-[7px] font-extrabold uppercase tracking-wider">
                  {myTier.label}
                </span>
                <span style={{ color: nextTier.color }} className="text-[7px] font-extrabold uppercase tracking-wider">
                  {nextTier.label}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
