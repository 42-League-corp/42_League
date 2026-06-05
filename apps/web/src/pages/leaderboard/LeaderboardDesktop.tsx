import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronUp, ChevronDown, Flame, Snowflake, Skull, LocateFixed } from 'lucide-react';
import { api, type Season, type SeasonStanding } from '../../lib/api';
import { Panel } from '../../components/Panel';
import { PlayerLink } from '../../components/PlayerLink';
import { Avatar } from '../../components/Avatar';
import { OnlineBadge } from '../../components/OnlineBadge';
import { Tooltip } from '../../components/Tooltip';
import { WinRateBar } from '../../components/WinRateBar';
import { RankBadge } from '../../components/RankBadge';
import { DesktopPodium } from './DesktopPodium';
import { LeaderboardBanner } from '../../components/LeaderboardBanner';
import { LeaderboardScatter, RankingViewToggle, GradesNavButton, type RankingView } from './LeaderboardScatter';
import { GoatView } from '../GoatPage';
import { TeamLeaderboard } from './TeamLeaderboard';
import { RankingScopeToggle } from './RankingScopeToggle';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useGameMode } from '../../hooks/useGameMode';
import { useT } from '../../lib/i18n';

type LeaderboardTab = 'personal' | 'teams';

// ─── Stats dérivées par joueur ───────────────────────────────────────────────
/** Adversaire ayant mis fin à une plus longue série (photo Intra pour le tooltip). */
interface StreakBreaker {
  login: string;
  imageUrl: string | null;
}

interface PlayerStats {
  wins: number;
  losses: number;
  games: number;
  winRate: number; // 0–100
  /** Série en cours : positif = victoires consécutives, négatif = défaites. */
  streak: number;
  /** Plus longue série de victoires consécutives. */
  maxWinStreak: number;
  /** Plus longue série de défaites consécutives. */
  maxLossStreak: number;
  /** Qui a brisé la plus longue série de V (l'a battu). null si série encore en cours. */
  maxWinBreaker: StreakBreaker | null;
  /** Qui a mis fin à la plus longue série de D (battu par le joueur). null si en cours. */
  maxLossBreaker: StreakBreaker | null;
}

const EMPTY_STATS: PlayerStats = {
  wins: 0,
  losses: 0,
  games: 0,
  winRate: 0,
  streak: 0,
  maxWinStreak: 0,
  maxLossStreak: 0,
  maxWinBreaker: null,
  maxLossBreaker: null,
};

type SortKey =
  | 'rank'
  | 'player'
  | 'elo'
  | 'games'
  | 'winRate'
  | 'wins'
  | 'losses'
  | 'streak'
  | 'maxWin'
  | 'maxLoss'
  | 'titles';
type SortDir = 'asc' | 'desc';

/**
 * Vue desktop du leaderboard — tracker esport.
 * Podium 3D pour le Top 3 + tableau dense avec colonnes triables
 * (games, win rate, W/L, série, titres).
 */
export function LeaderboardDesktop() {
  const t = useT();
  const { leaderboard, matches: allMatches, me, allOps, locations } = useLeagueData();
  const { game } = useGameMode();
  const myLogin = me?.login;

  const showTeamsTab = game === 'babyfoot';
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('personal');
  useEffect(() => {
    if (game !== 'babyfoot') setActiveTab('personal');
  }, [game]);
  // Le classement courant est celui du mode (babyfoot|smash) → on ne calcule les
  // stats dérivées que sur les matchs de ce jeu.
  const matches = useMemo(
    () => allMatches.filter((m) => (m.game ?? 'babyfoot') === game),
    [allMatches, game],
  );

  // Statistiques complètes par login : W/L, games, winrate, série en cours.
  const statsByLogin = useMemo(() => {
    const map = new Map<string, PlayerStats>();
    for (const u of leaderboard) {
      map.set(u.login, { ...EMPTY_STATS });
    }

    // W/L cumulés
    for (const m of matches) {
      if (m.winner === 'draw') continue; // nulle : ni V ni D
      for (const login of [m.playerALogin, m.playerBLogin]) {
        const cur = map.get(login);
        if (!cur) continue;
        const isA = m.playerALogin === login;
        const won = (isA && m.winner === 'A') || (!isA && m.winner === 'B');
        if (won) cur.wins++;
        else cur.losses++;
      }
    }

    // Photo Intra par login (pour le tooltip « brisée par … »).
    const infoByLogin = new Map<string, string | null>();
    for (const u of leaderboard) infoByLogin.set(u.login, u.imageUrl);

    // Série en cours : on parcourt les matches récents → anciens par joueur.
    const byPlayer = new Map<string, { won: boolean; at: number; opp: string }[]>();
    for (const m of matches) {
      if (m.winner === 'draw') continue; // nulle : hors série V/D
      for (const login of [m.playerALogin, m.playerBLogin]) {
        if (!map.has(login)) continue;
        const isA = m.playerALogin === login;
        const won = (isA && m.winner === 'A') || (!isA && m.winner === 'B');
        const opp = isA ? m.playerBLogin : m.playerALogin;
        const arr = byPlayer.get(login) ?? [];
        arr.push({ won, at: new Date(m.playedAt).getTime(), opp });
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
      // Plus longues séries (V / D) + qui y a mis fin. On parcourt en ordre
      // chronologique (ancien → récent). Un run n'est comptabilisé qu'à sa
      // CLÔTURE (match de signe opposé) : c'est cet adversaire qui « brise » la
      // série. Le run final, jamais clos, est le record « en cours » → pas de
      // briseur (on ne montrera pas « brisée par … »).
      const chrono = results.slice().reverse();
      let maxWin = 0;
      let maxLoss = 0;
      let winBreaker: string | null = null; // adversaire qui a battu le joueur
      let lossBreaker: string | null = null; // adversaire battu par le joueur
      let winOngoing = false;
      let lossOngoing = false;
      let run = 0;
      let runSign: 'W' | 'L' | null = null;
      for (const r of chrono) {
        const sign: 'W' | 'L' = r.won ? 'W' : 'L';
        if (runSign === null || sign === runSign) {
          run++;
          runSign = sign;
          continue;
        }
        // Le run précédent (runSign) est clos par r (signe opposé) → r.opp l'a brisé.
        if (runSign === 'W') {
          if (run > maxWin) { maxWin = run; winBreaker = r.opp; winOngoing = false; }
        } else if (run > maxLoss) {
          maxLoss = run; lossBreaker = r.opp; lossOngoing = false;
        }
        run = 1;
        runSign = sign;
      }
      // Run final encore ouvert : record « en cours » s'il bat les précédents.
      if (runSign === 'W') {
        if (run > maxWin) { maxWin = run; winOngoing = true; winBreaker = null; }
      } else if (runSign === 'L' && run > maxLoss) {
        maxLoss = run; lossOngoing = true; lossBreaker = null;
      }

      const s = map.get(login)!;
      s.streak = streak;
      s.maxWinStreak = maxWin;
      s.maxLossStreak = maxLoss;
      s.maxWinBreaker = winBreaker && !winOngoing
        ? { login: winBreaker, imageUrl: infoByLogin.get(winBreaker) ?? null }
        : null;
      s.maxLossBreaker = lossBreaker && !lossOngoing
        ? { login: lossBreaker, imageUrl: infoByLogin.get(lossBreaker) ?? null }
        : null;
    }

    for (const s of map.values()) {
      s.games = s.wins + s.losses;
      s.winRate = s.games === 0 ? 0 : Math.round((s.wins / s.games) * 100);
    }
    return map;
  }, [leaderboard, matches]);

  // Win rate par login — abscisse du nuage de points.
  const winRates = useMemo(() => {
    const m = new Map<string, number>();
    for (const [login, s] of statsByLogin) m.set(login, s.winRate);
    return m;
  }, [statsByLogin]);

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

  // ─── Vue (liste / nuage) ─────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<RankingView>('list');

  // ─── Saison affichée : '' = en cours (live), sinon snapshot d'une saison passée ───
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState<string>('');
  const [standings, setStandings] = useState<SeasonStanding[] | null>(null);

  useEffect(() => {
    api.seasons().then(setSeasons).catch(() => {});
  }, []);

  useEffect(() => {
    if (!seasonId) {
      setStandings(null);
      return;
    }
    let alive = true;
    api.seasonStandings(seasonId, game).then((s) => alive && setStandings(s)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [seasonId, game]);

  const viewingPast = standings !== null;

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
      stats: statsByLogin.get(u.login) ?? EMPTY_STATS,
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
        case 'maxWin':
          cmp = a.stats.maxWinStreak - b.stats.maxWinStreak;
          break;
        case 'maxLoss':
          cmp = a.stats.maxLossStreak - b.stats.maxLossStreak;
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

  // Bouton « Où suis-je ? » : défile jusqu'à la ligne du joueur courant.
  // (Plus d'auto-scroll au montage — on reste en haut du classement et le
  // recentrage se déclenche à la demande via le bouton.)
  const scrollToMe = useCallback(() => {
    const el = document.getElementById('lb-me-row');
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  return (
    <div>
      {!viewingPast && <LeaderboardBanner />}

      {!viewingPast && top3.length === 3 && <DesktopPodium top3={top3} statsByLogin={podiumStats} />}

      <Panel title={t('panel.lb.title')} sub={`${leaderboard.length} ${t('panel.lb.sub')}`} accent="crown">
        {/* Onglets Personnel / Équipes — Babyfoot uniquement */}
        {showTeamsTab && (
          <div className="mb-4 max-w-xs">
            <RankingScopeToggle
              value={activeTab}
              onChange={setActiveTab}
              choices={[
                { value: 'personal' as LeaderboardTab, label: t('lb.tab.solo') },
                { value: 'teams' as LeaderboardTab, label: t('lb.tab.teams') },
              ]}
            />
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'teams' ? (
            <motion.div
              key="teams"
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              <TeamLeaderboard />
            </motion.div>
          ) : (
            <motion.div
              key="personal"
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 14 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >

        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <SeasonSelect seasons={seasons} value={seasonId} onChange={setSeasonId} currentLabel={t('lb.season.current')} />
          {!viewingPast && (
            <div className="flex items-center gap-2">
              {viewMode === 'list' && myLogin && sortedRows.some((r) => r.entry.login === myLogin) && (
                <button
                  type="button"
                  onClick={scrollToMe}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gold/30 bg-gold/10 text-gold text-xs font-semibold hover:bg-gold/15 hover:border-gold/50 transition-colors"
                >
                  <LocateFixed className="w-3.5 h-3.5" strokeWidth={2.4} />
                  {t('lb.whereAmI')}
                </button>
              )}
              <RankingViewToggle view={viewMode} onChange={setViewMode} />
              <GradesNavButton />
            </div>
          )}
        </div>
        {viewingPast ? (
          <SnapshotTable standings={standings ?? []} />
        ) : leaderboard.length === 0 ? (
          <div className="text-center text-muted-2 py-10">{t('lb.empty')}</div>
        ) : viewMode === 'goat' ? (
          <GoatView />
        ) : viewMode === 'graph' ? (
          <LeaderboardScatter
            entries={leaderboard}
            myLogin={myLogin}
            winRates={winRates}
            className="h-[640px]"
          />
        ) : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr className="font-gaming text-[10px] uppercase tracking-[0.14em] text-gold/80 font-extrabold">
                  <SortTh label="#" k="rank" sort={sort} onSort={toggleSort} align="left" />
                  <SortTh label={t('lb.col.player')} k="player" sort={sort} onSort={toggleSort} align="left" />
                  <SortTh label={t('lb.col.elo')} k="elo" sort={sort} onSort={toggleSort} align="right" />
                  <SortTh label={t('lb.col.games')} k="games" sort={sort} onSort={toggleSort} align="right" />
                  <SortTh label={t('lb.col.winrate')} k="winRate" sort={sort} onSort={toggleSort} align="center" />
                  <SortTh label={t('lb.col.streak')} k="streak" sort={sort} onSort={toggleSort} align="right" />
                  <SortTh label={t('lb.col.streak.win')} k="maxWin" sort={sort} onSort={toggleSort} align="right" tone="gold" />
                  <SortTh label={t('lb.col.streak.loss')} k="maxLoss" sort={sort} onSort={toggleSort} align="right" tone="red" />
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
                      id={isMe ? 'lb-me-row' : undefined}
                      className={
                        'group border-t border-gold/10 transition-colors scroll-mt-24 ' +
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
                          <span className="truncate max-w-[120px] sm:max-w-[150px] font-semibold">
                            {u.login}
                          </span>
                          {isMe && (
                            <span className="text-[8px] font-extrabold text-[#1a1100] metal-plate-gold px-1.5 py-0.5 rounded-full uppercase tracking-wider ml-1">
                              {t('lb.me')}
                            </span>
                          )}
                          {targetedBy && (
                            <span
                              className="text-red ml-1"
                              title={`${t('lb.opsOf')} ${targetedBy.ownerLogin}`}
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
                        <span className="inline-flex items-center gap-1.5">
                          <RankBadge elo={u.elo} rank={u.rank} size="xs" showLabel={false} />
                          {u.elo}
                        </span>
                      </td>
                      <td className="px-1 sm:px-3 py-2.5 text-right tabular-nums text-muted-2">
                        {stats.games}
                      </td>
                      <td className="px-2 sm:px-3 py-2.5 min-w-[230px]">
                        <WinRateCell
                          winRate={stats.winRate}
                          games={stats.games}
                          wins={stats.wins}
                          losses={stats.losses}
                        />
                      </td>
                      <td className="px-1 sm:px-3 py-2.5 text-right">
                        <StreakCell streak={stats.streak} />
                      </td>
                      <td className="px-1 sm:px-3 py-2.5 text-right">
                        <MaxStreakCell value={stats.maxWinStreak} kind="win" breaker={stats.maxWinBreaker} />
                      </td>
                      <td className="px-1 sm:px-3 py-2.5 text-right">
                        <MaxStreakCell value={stats.maxLossStreak} kind="loss" breaker={stats.maxLossBreaker} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
            </motion.div>
          )}
        </AnimatePresence>

      </Panel>
    </div>
  );
}

// ─── Sélecteur de saison (en cours / saisons passées) ────────────────────────
function SeasonSelect({
  seasons,
  value,
  onChange,
  currentLabel,
}: {
  seasons: Season[];
  value: string;
  onChange: (v: string) => void;
  currentLabel: string;
}) {
  const past = seasons.filter((s) => !s.isActive);
  if (past.length === 0) return <div />;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-1.5 bg-bg-1 border border-border rounded-lg text-xs font-bold uppercase tracking-wider text-text focus:border-gold outline-none transition-colors"
    >
      <option value="">{currentLabel}</option>
      {past.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

// ─── Classement figé d'une saison passée ──────────────────────────────────────
function SnapshotTable({ standings }: { standings: SeasonStanding[] }) {
  const t = useT();
  if (standings.length === 0) {
    return <div className="text-center text-muted-2 py-10">{t('lb.snapshot.empty')}</div>;
  }
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr className="font-gaming text-[10px] uppercase tracking-[0.14em] text-gold/80 font-extrabold">
            <th className="px-3 py-2 border-b border-gold/20 text-left">#</th>
            <th className="px-3 py-2 border-b border-gold/20 text-left">{t('lb.col.player')}</th>
            <th className="px-3 py-2 border-b border-gold/20 text-right">{t('lb.col.eloFinal')}</th>
            <th className="px-3 py-2 border-b border-gold/20 text-right">{t('lb.col.wd')}</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => {
            const rankCls =
              s.rank === 1 ? 'text-gold' : s.rank === 2 ? 'text-muted-2' : s.rank === 3 ? 'text-[#cd7f32]' : 'text-muted';
            return (
              <tr key={s.login} className="border-t border-gold/10 hover:bg-gold/[0.04] transition-colors">
                <td className={`px-3 py-2.5 font-display font-black tabular-nums ${rankCls}`}>
                  {s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : `#${s.rank}`}
                </td>
                <td className="px-3 py-2.5">
                  <PlayerLink login={s.login}>
                    <span className="font-semibold truncate">{s.login}</span>
                  </PlayerLink>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-display font-extrabold text-gold">{s.elo}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-2">
                  {s.wins}-{s.losses}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
  align: 'left' | 'right' | 'center';
  tone?: 'gold' | 'red';
}) {
  const active = sort.key === k;
  const toneCls = tone === 'gold' ? 'text-gold' : tone === 'red' ? 'text-red' : '';
  return (
    <th
      className={`px-1 sm:px-3 py-2 border-b border-gold/20 select-none ${align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right'}`}
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

// ─── Cellule win rate — barre type OP.GG (W / L dans la jauge) ────────────────
// Le pourcentage se place À GAUCHE en jaune si win rate > 50, sinon À DROITE en
// rouge — repère visuel immédiat des joueurs au-dessus / en-dessous de 50 %.
function WinRateCell({
  winRate,
  games,
  wins,
  losses,
}: {
  winRate: number;
  games: number;
  wins: number;
  losses: number;
}) {
  const t = useT();
  if (games === 0) return <span className="text-muted/40 text-xs">—</span>;
  return (
    <Tooltip
      label={`${wins} ${t('lb.abbr.win')} · ${losses} ${t('lb.abbr.loss')} · ${winRate}%`}
      className="w-full"
    >
      <WinRateBar wins={wins} losses={losses} />
    </Tooltip>
  );
}

// ─── Cellule série en cours ──────────────────────────────────────────────────
// On n'affiche une série qu'à partir de 2 (une seule V ou D n'est pas une série) :
// en dessous, c'est « none ».
function StreakCell({ streak }: { streak: number }) {
  const t = useT();
  if (Math.abs(streak) < 2) {
    return <span className="text-muted/40 text-xs uppercase tracking-wide">{t('lb.streak.none')}</span>;
  }
  if (streak > 0) {
    return (
      <Tooltip label={`${streak} ${t('lb.streak.wins')} 🔥`}>
        <span className="inline-flex items-center gap-1 font-mono font-bold tabular-nums text-[#ff8c3a]">
          <Flame className="w-3.5 h-3.5" strokeWidth={2.5} fill="currentColor" />
          {streak}
        </span>
      </Tooltip>
    );
  }
  return (
    <Tooltip label={`${Math.abs(streak)} ${t('lb.streak.losses')} ❄️`}>
      <span className="inline-flex items-center gap-1 font-mono font-bold tabular-nums text-[#5fb4ff]">
        <Snowflake className="w-3.5 h-3.5" strokeWidth={2.5} />
        {Math.abs(streak)}
      </span>
    </Tooltip>
  );
}

// ─── Cellule plus longue série (V ou D) ──────────────────────────────────────
// Même règle : une série commence à 2, sinon « - ». Au survol, si la série a été
// brisée par quelqu'un (record clos, pas « en cours »), le tooltip montre la
// photo Intra de l'adversaire qui y a mis fin.
function MaxStreakCell({
  value,
  kind,
  breaker,
}: {
  value: number;
  kind: 'win' | 'loss';
  breaker?: StreakBreaker | null;
}) {
  const t = useT();
  if (value < 2) {
    return <span className="text-muted/40 text-xs uppercase tracking-wide">{t('lb.streak.none')}</span>;
  }
  const isWin = kind === 'win';
  const color = isWin ? '#ff8c3a' : '#5fb4ff';
  const Icon = isWin ? Flame : Snowflake;
  const countLabel = `${value} ${isWin ? t('lb.streak.wins') : t('lb.streak.losses')} ${isWin ? '🔥' : '❄️'}`;
  // Tooltip enrichi (photo + « brisée par … ») uniquement si un briseur existe.
  const label = breaker ? (
    <span className="inline-flex items-center gap-2 py-0.5">
      <Avatar login={breaker.login} imageUrl={breaker.imageUrl} size="xs" />
      <span className="flex flex-col items-start leading-tight">
        <span className="text-[9px] uppercase tracking-wider text-muted-2">
          {isWin ? t('lb.streak.brokenBy') : t('lb.streak.endedVs')}
        </span>
        <span className="font-semibold">@{breaker.login}</span>
      </span>
    </span>
  ) : (
    countLabel
  );
  return (
    <Tooltip label={label}>
      <span
        className="inline-flex items-center gap-1 font-mono font-bold tabular-nums"
        style={{ color }}
      >
        <Icon className="w-3.5 h-3.5" strokeWidth={2.5} fill={isWin ? 'currentColor' : 'none'} />
        {value}
      </span>
    </Tooltip>
  );
}
