import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Crown, ChevronDown } from 'lucide-react';
import { PlayerLink } from './PlayerLink';
import { Avatar, UserBadge } from './Avatar';
import { useLeagueData } from '../hooks/useLeagueData';
import { computeTrophies, type TrophyColor, type TrophyResult } from '../lib/trophies';
import type { LeaderboardEntry } from '../lib/api';

interface TrophyHolder {
  login: string;
  imageUrl: string | null;
  trophies: TrophyResult[];
}

type SortMode = 'category' | 'player';

const COLOR_BORDER: Record<TrophyColor, string> = {
  gold: 'border-gold/40',
  red: 'border-red/40',
  cyan: 'border-teal/40',
  violet: 'border-[#a259ff]/40',
  magenta: 'border-[#ff3bd9]/40',
  bronze: 'border-[#cd7f32]/40',
  crimson: 'border-[#dc143c]/40',
  green: 'border-[#10b981]/40',
  sapphire: 'border-[#3b82f6]/40',
};

const COLOR_TEXT: Record<TrophyColor, string> = {
  gold: 'text-gold',
  red: 'text-red',
  cyan: 'text-[#f5b942]',
  violet: 'text-[#c97bff]',
  magenta: 'text-[#ff5bb0]',
  bronze: 'text-[#cd7f32]',
  crimson: 'text-[#dc143c]',
  green: 'text-[#7fd66e]',
  sapphire: 'text-[#7aa8ff]',
};

const COLOR_GLOW: Record<TrophyColor, string> = {
  gold: 'rgba(255,201,74,0.12)',
  red: 'rgba(255,83,102,0.1)',
  cyan: 'rgba(245,185,66,0.1)',
  violet: 'rgba(162,89,255,0.1)',
  magenta: 'rgba(255,59,217,0.1)',
  bronze: 'rgba(205,127,50,0.1)',
  crimson: 'rgba(220,20,60,0.1)',
  green: 'rgba(16,185,129,0.1)',
  sapphire: 'rgba(59,130,246,0.1)',
};

// ─── Tilt card wrapper ────────────────────────────────────────────────────────

function TiltCard({
  children,
  className,
  color,
}: {
  children: ReactNode;
  className: string;
  color: TrophyColor;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)');
  const [shine, setShine] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const tX = (y - 0.5) * -10;
    const tY = (x - 0.5) * 10;
    setTransform(`perspective(600px) rotateX(${tX}deg) rotateY(${tY}deg) scale(1.025)`);
    setShine({ x: x * 100, y: y * 100, opacity: 1 });
  };

  const handleMouseLeave = () => {
    setTransform('perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)');
    setShine((s) => ({ ...s, opacity: 0 }));
  };

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{ transform, transition: 'transform 0.12s ease-out', transformStyle: 'preserve-3d' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {/* Shine overlay */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${shine.x}% ${shine.y}%, ${COLOR_GLOW[color].replace('0.12', '0.22')} 0%, transparent 65%)`,
          opacity: shine.opacity,
          transition: 'opacity 0.25s ease',
        }}
      />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Tente de parser une valeur de type "JoueurA vs JoueurB (X matchs)"
 * pour afficher les deux PPs face à face dans l'encart Rivalité.
 */
function renderRivalryOrValue(value: string, leaderboard: LeaderboardEntry[]) {
  const match = value.match(/^([\w-]+)\s+vs\s+([\w-]+)(.*)$/);
  if (match) {
    const [, login1, login2, rest] = match;
    const u1 = leaderboard.find((u) => u.login === login1);
    const u2 = leaderboard.find((u) => u.login === login2);
    
    if (u1 && u2) {
      const name1 = u1.firstName && u1.lastName ? `${u1.firstName} ${u1.lastName}` : u1.login;
      const name2 = u2.firstName && u2.lastName ? `${u2.firstName} ${u2.lastName}` : u2.login;
      
      return (
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <PlayerLink login={u1.login} className="!gap-1.5">
            <Avatar login={u1.login} imageUrl={u1.imageUrl} size="sm" />
            <span className="font-semibold text-sm text-text-strong">{name1}</span>
          </PlayerLink>
          <span className="text-muted-2 text-[10px] font-black uppercase tracking-wider">VS</span>
          <PlayerLink login={u2.login} className="!gap-1.5">
            <Avatar login={u2.login} imageUrl={u2.imageUrl} size="sm" />
            <span className="font-semibold text-sm text-text-strong">{name2}</span>
          </PlayerLink>
          <span className="text-muted-2 text-xs ml-1">{rest}</span>
        </div>
      );
    }
  }
  return <div className="text-text-strong font-semibold text-sm">{value}</div>;
}

// ─── Main section ─────────────────────────────────────────────────────────────

interface TrophiesSectionProps {
  title?: string;
}

export function TrophiesSection({ title = 'Trophées' }: TrophiesSectionProps) {
  const { leaderboard, matches } = useLeagueData();
  const [sortMode, setSortMode] = useState<SortMode>('category');
  const trophies = useMemo(
    () => computeTrophies(leaderboard, matches),
    [leaderboard, matches],
  );

  // Trophées regroupés par détenteur, joueurs classés par nombre de trophées décroissant.
  const holders = useMemo<TrophyHolder[]>(() => {
    const byLogin = new Map<string, TrophyHolder>();
    for (const t of trophies) {
      if (!t.winner) continue;
      let h = byLogin.get(t.winner.login);
      if (!h) {
        h = { login: t.winner.login, imageUrl: t.winner.imageUrl, trophies: [] };
        byLogin.set(t.winner.login, h);
      }
      h.trophies.push(t);
    }
    return [...byLogin.values()].sort(
      (a, b) => b.trophies.length - a.trophies.length || a.login.localeCompare(b.login),
    );
  }, [trophies]);

  // Trophées sans détenteur unique (non gagnés ou rivalités) : affichés à part en mode « par joueur ».
  const unattributed = useMemo(() => trophies.filter((t) => !t.winner), [trophies]);

  if (trophies.length === 0) {
    return (
      <section className="mt-8 pt-6 border-t border-gold/15">
        <div className="font-gaming text-xs font-extrabold uppercase tracking-[0.18em] text-gold mb-2 flex items-center gap-2">
          <span>🏆</span>
          <span>{title}</span>
        </div>
        <div className="text-center text-muted-2 py-6 text-sm">
          Pas encore assez de matchs pour décerner des trophées.
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 pt-6 border-t border-gold/15">
      <div className="font-gaming text-xs font-extrabold uppercase tracking-[0.18em] text-gold mb-3 flex items-center gap-2">
        <span className="text-base">🏆</span>
        <span>{title}</span>
        <span className="text-[10px] text-muted font-semibold normal-case tracking-[0.12em]">
          · récompenses légendaires
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-gold/30 via-gold/10 to-transparent ml-2" />
      </div>

      {/* Classement des joueurs les plus titrés */}
      {holders.length > 0 && <MostTitled holders={holders} leaderboard={leaderboard} />}

      {/* Sélecteur de tri */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-2 font-bold">Trier</span>
        <SortToggle mode={sortMode} onChange={setSortMode} />
      </div>

      {sortMode === 'category' ? (
        <TrophyGrid trophies={trophies} leaderboard={leaderboard} />
      ) : (
        <div className="space-y-6">
          {holders.map((h, i) => (
            <div key={h.login}>
              <PlayerGroupHeader holder={h} rank={i + 1} leaderboard={leaderboard} />
              <TrophyGrid trophies={h.trophies} leaderboard={leaderboard} />
            </div>
          ))}
          {unattributed.length > 0 && (
            <div>
              <div className="font-gaming text-[10px] uppercase tracking-[0.16em] text-muted-2 font-extrabold mb-3 flex items-center gap-2">
                <span className="inline-block w-1 h-2.5 bg-gradient-to-b from-muted to-muted/40 rounded-sm" />
                Non attribués
                <span className="font-mono normal-case text-muted-2">· {unattributed.length}</span>
              </div>
              <TrophyGrid trophies={unattributed} leaderboard={leaderboard} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Grille de trophées ─────────────────────────────────────────────────────

function TrophyGrid({
  trophies,
  leaderboard,
}: {
  trophies: TrophyResult[];
  leaderboard: LeaderboardEntry[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {trophies.map((t) => {
        const winnerEntry = t.winner ? leaderboard.find((u) => u.login === t.winner?.login) : null;

        return (
          <TiltCard
            key={t.title}
            color={t.color}
            className={`card-hud overflow-hidden hover-glow ${COLOR_BORDER[t.color]} rounded-xl p-4 flex flex-col gap-2 ${
              t.earned ? '' : 'opacity-45 grayscale'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="text-3xl leading-none">{t.emoji}</div>
              <div className="min-w-0">
                <div className={`text-xs font-extrabold uppercase tracking-wider ${COLOR_TEXT[t.color]}`}>
                  {t.title}
                </div>
                <div className="text-[10px] text-muted-2">{t.subtitle}</div>
              </div>
            </div>

            {!t.earned ? (
              <div className="mt-1 text-xs text-muted-2 italic">
                Personne ne l'a encore 🔒
              </div>
            ) : t.winner ? (
              <PlayerLink login={t.winner.login} className="mt-1">
                <UserBadge
                  login={t.winner.login}
                  imageUrl={t.winner.imageUrl}
                  firstName={winnerEntry?.firstName}
                  lastName={winnerEntry?.lastName}
                  size="sm"
                />
              </PlayerLink>
            ) : (
              renderRivalryOrValue(t.value, leaderboard)
            )}

            <div className="flex items-center gap-2 mt-auto pt-1">
              {t.winner && (
                <span className={`text-sm font-extrabold ${COLOR_TEXT[t.color]}`}>
                  {t.value}
                </span>
              )}
              {t.hint && <span className="text-[10px] text-muted">{t.hint}</span>}
            </div>
          </TiltCard>
        );
      })}
    </div>
  );
}

// ─── Tri : par catégorie / par joueur ───────────────────────────────────────

function SortToggle({ mode, onChange }: { mode: SortMode; onChange: (m: SortMode) => void }) {
  return (
    <div className="inline-flex gap-1 p-1 rounded-lg bg-bg-2/60 border border-border/40">
      {(['category', 'player'] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-3 py-1.5 rounded-md text-[10px] font-extrabold uppercase tracking-[0.12em] transition-all duration-150 border ${
            mode === m
              ? 'bg-gold/10 border-gold/30 text-gold'
              : 'border-transparent text-muted-2 hover:text-text'
          }`}
        >
          {m === 'category' ? 'Par catégorie' : 'Par joueur'}
        </button>
      ))}
    </div>
  );
}

function PlayerGroupHeader({
  holder,
  rank,
  leaderboard,
}: {
  holder: TrophyHolder;
  rank: number;
  leaderboard: LeaderboardEntry[];
}) {
  const entry = leaderboard.find((u) => u.login === holder.login);
  const name =
    entry?.firstName && entry?.lastName ? `${entry.firstName} ${entry.lastName}` : holder.login;
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="font-mono text-xs text-muted-2 font-bold w-6 text-right">#{rank}</span>
      <PlayerLink login={holder.login} className="!gap-2">
        <Avatar login={holder.login} imageUrl={holder.imageUrl} size="sm" />
        <span className="font-extrabold text-text-strong text-sm">{name}</span>
      </PlayerLink>
      <span className="text-[11px] font-extrabold text-gold bg-gold/10 border border-gold/20 rounded-full px-2 py-0.5">
        {holder.trophies.length} 🏆
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-gold/20 to-transparent" />
    </div>
  );
}

// ─── Classement « les plus titrés » : podium + liste dépliable ──────────────

function MostTitled({
  holders,
  leaderboard,
}: {
  holders: TrophyHolder[];
  leaderboard: LeaderboardEntry[];
}) {
  const [showAll, setShowAll] = useState(false);
  const top3 = holders.slice(0, 3);
  const rest = holders.slice(3);
  // Ordre visuel classique : 2e à gauche, 1er au centre, 3e à droite.
  const podium = [
    top3[1] ? { holder: top3[1], rank: 2 } : null,
    top3[0] ? { holder: top3[0], rank: 1 } : null,
    top3[2] ? { holder: top3[2], rank: 3 } : null,
  ].filter(Boolean) as { holder: TrophyHolder; rank: number }[];

  return (
    <div className="card-hud rounded-xl p-4 sm:p-5 mb-5">
      <div className="text-[10px] uppercase tracking-[0.16em] text-gold font-extrabold mb-4 flex items-center gap-2">
        <span className="inline-block w-1 h-2.5 bg-gradient-to-b from-gold to-gold-dim rounded-sm" />
        Les plus titrés
      </div>

      <div className="flex items-end justify-center gap-3 sm:gap-5">
        {podium.map(({ holder, rank }) => (
          <MostTitledSpot key={holder.login} holder={holder} rank={rank} leaderboard={leaderboard} />
        ))}
      </div>

      {rest.length > 0 && (
        <>
          <button
            onClick={() => setShowAll((s) => !s)}
            className="mt-4 mx-auto flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2 hover:text-gold transition-colors"
          >
            {showAll ? 'Masquer' : `Voir + (${rest.length})`}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${showAll ? 'rotate-180' : ''}`}
              strokeWidth={2.5}
            />
          </button>

          {showAll && (
            <ul className="mt-3 space-y-1 border-t border-border/30 pt-3">
              {rest.map((h, i) => {
                const entry = leaderboard.find((u) => u.login === h.login);
                const name =
                  entry?.firstName && entry?.lastName
                    ? `${entry.firstName} ${entry.lastName}`
                    : h.login;
                return (
                  <li key={h.login} className="flex items-center gap-2.5 py-1">
                    <span className="font-mono text-xs text-muted-2 w-7 text-right">#{i + 4}</span>
                    <PlayerLink login={h.login} className="!gap-2 min-w-0 flex-1">
                      <Avatar login={h.login} imageUrl={h.imageUrl} size="xs" />
                      <span className="text-sm font-semibold text-text truncate">{name}</span>
                    </PlayerLink>
                    <span className="text-sm font-extrabold text-gold tabular-nums">
                      {h.trophies.length} 🏆
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

const SPOT_STEP_H: Record<number, string> = { 1: 'h-14', 2: 'h-10', 3: 'h-7' };
const SPOT_BAR: Record<number, string> = {
  1: 'from-[#3a2e10] to-[#0f0c04] border-gold/45',
  2: 'from-[#2c2e33] to-[#0e0e10] border-[#c9cdd6]/30',
  3: 'from-[#33220f] to-[#0e0905] border-[#cd7f32]/35',
};
const SPOT_RING: Record<number, string> = {
  1: 'ring-gold',
  2: 'ring-[#c9cdd6]',
  3: 'ring-[#cd7f32]',
};
const SPOT_TXT: Record<number, string> = {
  1: 'text-gold',
  2: 'text-[#d6dae3]',
  3: 'text-[#e0954c]',
};

function MostTitledSpot({
  holder,
  rank,
  leaderboard,
}: {
  holder: TrophyHolder;
  rank: number;
  leaderboard: LeaderboardEntry[];
}) {
  const entry = leaderboard.find((u) => u.login === holder.login);
  const isFirst = rank === 1;
  const name =
    entry?.firstName && entry?.lastName ? `${entry.firstName} ${entry.lastName}` : holder.login;

  return (
    <div className="group flex flex-col items-center w-20 sm:w-24">
      {/* Figure : seule la partie haute se soulève au hover, la marche reste au sol. */}
      <div className="flex flex-col items-center gap-1.5 mb-2 transition-transform duration-300 ease-out group-hover:-translate-y-1">
        {isFirst && (
          <Crown className="w-5 h-5 text-gold drop-shadow-[0_2px_6px_rgba(255,201,74,0.5)]" fill="currentColor" />
        )}
        <PlayerLink login={holder.login} className="flex-col !gap-1">
          <Avatar
            login={holder.login}
            imageUrl={holder.imageUrl}
            size={isFirst ? 'lg' : 'md'}
            className={`ring-2 ring-offset-2 ring-offset-bg-1 ${SPOT_RING[rank]}`}
          />
          <span className={`text-[11px] font-extrabold truncate max-w-[76px] ${SPOT_TXT[rank]}`}>
            {name}
          </span>
        </PlayerLink>
        <div className="text-[11px] font-extrabold text-gold leading-none">
          {holder.trophies.length} 🏆
        </div>
      </div>

      {/* Marche du podium */}
      <div
        className={`w-full ${SPOT_STEP_H[rank]} rounded-t-lg border-t border-l border-r bg-gradient-to-b ${SPOT_BAR[rank]} flex items-start justify-center pt-1 transition-all duration-300 group-hover:brightness-110`}
      >
        <span className={`font-display font-black text-lg leading-none opacity-30 ${SPOT_TXT[rank]}`}>
          {rank}
        </span>
      </div>
    </div>
  );
}
