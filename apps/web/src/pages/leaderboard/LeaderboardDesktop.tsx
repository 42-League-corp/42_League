import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, Flame, Snowflake, Trophy, Skull } from 'lucide-react';
import { Panel } from '../../components/Panel';
import { PlayerLink } from '../../components/PlayerLink';
import { Avatar } from '../../components/Avatar';
import { OnlineBadge } from '../../components/OnlineBadge';
import { DesktopPodium } from './DesktopPodium';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useT } from '../../lib/i18n';

// ─── Stats dérivées par joueur ───────────────────────────────────────────────
interface PlayerStats {
  wins: number;
  losses: number;
  games: number;
  winRate: number; // 0–100
  /** Série en cours : positif = victoires consécutives, négatif = défaites. */
  streak: number;
}

type SortKey = 'rank' | 'player' | 'elo' | 'games' | 'winRate' | 'wins' | 'losses' | 'streak' | 'titles';
type SortDir = 'asc' | 'desc';

/**
 * Vue desktop du leaderboard — tracker esport.
 * Podium 3D pour le Top 3 + tableau dense avec colonnes triables
 * (games, win rate, W/L, série, titres).
 */
export function LeaderboardDesktop() {
  const t = useT();
  const { leaderboard, matches, me, allOps, locations } = useLeagueData();
  const myLogin = me?.login;

  // Statistiques complètes par login : W/L, games, winrate, série en cours.
  const statsByLogin = useMemo(() => {
    const map = new Map<string, PlayerStats>();
    for (const u of leaderboard) {
      map.set(u.login, { wins: 0, losses: 0, games: 0, winRate: 0, streak: 0 });
    }

    // W/L cumulés
    for (const m of matches) {
      for (const login of [m.playerALogin, m.playerBLogin]) {
        const cur = map.get(login);
        if (!cur) continue;
        const isA = m.playerALogin === login;
        const won = (isA && m.winner === 'A') || (!isA && m.winner === 'B');
        if (won) cur.wins++;
        else cur.losses++;
      }
    }

    // Série en cours : on parcourt les matches récents → anciens par joueur.
    const byPlayer = new Map<string, { won: boolean; at: number }[]>();
    for (const m of matches) {
      for (const login of [m.playerALogin, m.playerBLogin]) {
        if (!map.has(login)) continue;
        const isA = m.playerALogin === login;
        const won = (isA && m.winner === 'A') || (!isA && m.winner === 'B');
        const arr = byPlayer.get(login) ?? [];
        arr.push({ won, at: new Date(m.playedAt).getTime() });
        byPlayer.set(login, arr);
      }
    }
    for (const [login, results] of byPlayer) {
      results.sort((a, b) => b.at - a.at);
      let streak = 0;
      const first = results[0];
      if (first) {
        for (const r of results) {
          if (r.won === first.won) streak++;
          else break;
        }
        if (!first.won) streak = -streak;
      }
      const s = map.get(login)!;
      s.streak = streak;
    }

    for (const s of map.values()) {
      s.games = s.wins + s.losses;
      s.winRate = s.games === 0 ? 0 : Math.round((s.wins / s.games) * 100);
    }
    return map;
  }, [leaderboard, matches]);

  // Top 3 par rang officiel (ELO) — pour le podium.
  const top3 = useMemo(
    () => [...leaderboard].sort((a, b) => a.rank - b.rank).slice(0, 3),
    [leaderboard],
  );

  const podiumStats = useMemo(() => {
    const m = new Map<string, { winRate: number; games: number }>();
    for (const u of top3) {
      const s = statsByLogin.get(u.login);
      m.set(u.login, { winRate: s?.winRate ?? 0, games: s?.games ?? 0 });
    }
    return m;
  }, [top3, statsByLogin]);

  // ─── Tri ───────────────────────────────────────────────────────────────────
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'rank', dir: 'asc' });

  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      // Par défaut : 'player' monte (A→Z), les colonnes numériques descendent.
      return { key, dir: key === 'player' || key === 'rank' ? 'asc' : 'desc' };
    });
  };

  const sortedRows = useMemo(() => {
    const rows = leaderboard.map((u) => ({
      entry: u,
      stats: statsByLogin.get(u.login) ?? { wins: 0, losses: 0, games: 0, winRate: 0, streak: 0 },
    }));
    const dir = sort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sort.key) {
        case 'rank':
          cmp = a.entry.rank - b.entry.rank;
          break;
        case 'player':
          cmp = a.entry.login.localeCompare(b.entry.login);
          break;
        case 'elo':
          cmp = a.entry.elo - b.entry.elo;
          break;
        case 'games':
          cmp = a.stats.games - b.stats.games;
          break;
        case 'winRate':
          cmp = a.stats.winRate - b.stats.winRate;
          break;
        case 'wins':
          cmp = a.stats.wins - b.stats.wins;
          break;
        case 'losses':
          cmp = a.stats.losses - b.stats.losses;
          break;
        case 'streak':
          cmp = a.stats.streak - b.stats.streak;
          break;
        case 'titles':
          cmp = (a.entry.tournamentsWon ?? 0) - (b.entry.tournamentsWon ?? 0);
          break;
      }
      // Départage stable par rang officiel.
      if (cmp === 0) cmp = a.entry.rank - b.entry.rank;
      return cmp * dir;
    });
    return rows;
  }, [leaderboard, statsByLogin, sort]);

  return (
    <div>
      {top3.length === 3 && <DesktopPodium top3={top3} statsByLogin={podiumStats} />}

      <Panel title={t('panel.lb.title')} sub={`${leaderboard.length} ${t('panel.lb.sub')}`}>
        {leaderboard.length === 0 ? (
          <div className="text-center text-muted-2 py-10">{t('lb.empty')}</div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr className="font-gaming text-[10px] uppercase tracking-[0.14em] text-gold/80 font-extrabold">
                  <SortTh label="#" k="rank" sort={sort} onSort={toggleSort} align="left" />
                  <SortTh label={t('lb.col.player')} k="player" sort={sort} onSort={toggleSort} align="left" />
                  <SortTh label={t('lb.col.elo')} k="elo" sort={sort} onSort={toggleSort} align="right" />
                  <SortTh label={t('lb.col.games')} k="games" sort={sort} onSort={toggleSort} align="right" />
                  <SortTh label={t('lb.col.winrate')} k="winRate" sort={sort} onSort={toggleSort} align="right" />
                  <SortTh label={t('lb.col.w')} k="wins" sort={sort} onSort={toggleSort} align="right" tone="gold" />
                  <SortTh label={t('lb.col.l')} k="losses" sort={sort} onSort={toggleSort} align="right" tone="red" />
                  <SortTh label={t('lb.col.streak')} k="streak" sort={sort} onSort={toggleSort} align="right" />
                  <SortTh label={t('lb.col.titles')} k="titles" sort={sort} onSort={toggleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(({ entry: u, stats }) => {
                  const isMe = u.login === myLogin;
                  const targetedBy = allOps.find((o) => o.targetLogin === u.login);
                  const host = locations.get(u.login);
                  const rankCls =
                    u.rank === 1
                      ? 'text-gold'
                      : u.rank === 2
                        ? 'text-muted-2'
                        : u.rank === 3
                          ? 'text-[#cd7f32]'
                          : 'text-muted';
                  return (
                    <tr
                      key={u.login}
                      className={
                        'group border-t border-gold/10 transition-colors ' +
                        (isMe
                          ? 'bg-gold/[0.06] shadow-[inset_3px_0_0_0_rgba(255,201,74,0.7)]'
                          : 'hover:bg-gold/[0.04]')
                      }
                    >
                      <td className={`px-2 sm:px-3 py-2.5 font-display font-black tabular-nums ${rankCls}`}>
                        #{u.rank}
                      </td>
                      <td className="px-2 sm:px-3 py-2.5">
                        <PlayerLink login={u.login}>
                          <div className="relative flex-shrink-0">
                            <Avatar login={u.login} imageUrl={u.imageUrl} size="sm" />
                            {host && (
                              <OnlineBadge host={host} compact className="absolute -bottom-0.5 -right-0.5" />
                            )}
                          </div>
                          <span className="truncate max-w-[120px] sm:max-w-none font-semibold">
                            {u.login}
                          </span>
                          {isMe && (
                            <span className="text-[8px] font-extrabold text-[#1a1100] metal-plate-gold px-1.5 py-0.5 rounded-full uppercase tracking-wider ml-1">
                              Toi
                            </span>
                          )}
                          {targetedBy && (
                            <span
                              className="text-red ml-1"
                              title={`Ops de ${targetedBy.ownerLogin}`}
                            >
                              <Skull className="w-3 h-3 inline" strokeWidth={2.5} />
                            </span>
                          )}
                        </PlayerLink>
                        {u.title && (
                          <div className="text-[10px] text-gold italic mt-0.5 ml-10 truncate">
                            « {u.title} »
                          </div>
                        )}
                      </td>
                      <td
                        className="px-2 sm:px-3 py-2.5 text-right tabular-nums font-display font-extrabold text-gold"
                        style={{ textShadow: '0 0 10px rgba(255,201,74,0.25)' }}
                      >
                        {u.elo}
                      </td>
                      <td className="px-1 sm:px-3 py-2.5 text-right tabular-nums text-muted-2">
                        {stats.games}
                      </td>
                      <td className="px-1 sm:px-3 py-2.5 text-right">
                        <WinRateCell winRate={stats.winRate} games={stats.games} />
                      </td>
                      <td className="px-1 sm:px-3 py-2.5 text-right tabular-nums text-gold">{stats.wins}</td>
                      <td className="px-1 sm:px-3 py-2.5 text-right tabular-nums text-red">{stats.losses}</td>
                      <td className="px-1 sm:px-3 py-2.5 text-right">
                        <StreakCell streak={stats.streak} />
                      </td>
                      <td className="px-1 sm:px-3 py-2.5 text-right">
                        {(u.tournamentsWon ?? 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 text-gold font-mono tabular-nums">
                            <Trophy className="w-3 h-3" strokeWidth={2.5} />
                            {u.tournamentsWon}
                          </span>
                        ) : (
                          <span className="text-muted/40">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

// ─── En-tête de colonne triable ──────────────────────────────────────────────
function SortTh({
  label,
  k,
  sort,
  onSort,
  align,
  tone,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (k: SortKey) => void;
  align: 'left' | 'right';
  tone?: 'gold' | 'red';
}) {
  const active = sort.key === k;
  const toneCls = tone === 'gold' ? 'text-gold' : tone === 'red' ? 'text-red' : '';
  return (
    <th
      className={`px-1 sm:px-3 py-2 border-b border-gold/20 select-none ${align === 'left' ? 'text-left' : 'text-right'}`}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 cursor-pointer transition-colors hover:text-gold ${
          align === 'right' ? 'flex-row-reverse' : ''
        } ${active ? 'text-gold' : toneCls || 'text-gold/70'}`}
      >
        <span>{label}</span>
        <span className="w-3 inline-flex justify-center">
          {active ? (
            sort.dir === 'asc' ? (
              <ChevronUp className="w-3 h-3" strokeWidth={3} />
            ) : (
              <ChevronDown className="w-3 h-3" strokeWidth={3} />
            )
          ) : (
            <ChevronDown className="w-3 h-3 opacity-20" strokeWidth={3} />
          )}
        </span>
      </button>
    </th>
  );
}

// ─── Cellule win rate avec mini-jauge ────────────────────────────────────────
function WinRateCell({ winRate, games }: { winRate: number; games: number }) {
  if (games === 0) return <span className="text-muted/40 text-xs">—</span>;
  const color =
    winRate >= 60 ? '#4ade80' : winRate >= 45 ? '#ffc94a' : '#ff5366';
  return (
    <div className="inline-flex items-center gap-2 justify-end">
      <span className="tabular-nums font-bold text-xs" style={{ color }}>
        {winRate}%
      </span>
      <span className="hidden sm:block w-12 h-1.5 rounded-full bg-bg-2 overflow-hidden">
        <span
          className="block h-full rounded-full transition-all"
          style={{ width: `${winRate}%`, background: color }}
        />
      </span>
    </div>
  );
}

// ─── Cellule série (streak) ──────────────────────────────────────────────────
function StreakCell({ streak }: { streak: number }) {
  if (streak === 0) return <span className="text-muted/40">—</span>;
  if (streak > 0) {
    return (
      <span className="inline-flex items-center gap-1 font-mono font-bold tabular-nums text-[#ff8c3a]">
        <Flame className="w-3.5 h-3.5" strokeWidth={2.5} fill="currentColor" />
        {streak}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-mono font-bold tabular-nums text-[#5fb4ff]">
      <Snowflake className="w-3.5 h-3.5" strokeWidth={2.5} />
      {Math.abs(streak)}
    </span>
  );
}
