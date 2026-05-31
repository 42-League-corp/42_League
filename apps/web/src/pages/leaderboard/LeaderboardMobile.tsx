import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { PullToRefresh } from '../../mobile/primitives/PullToRefresh';
import { StaggerList, StaggerItem } from '../../mobile/motion/StaggerList';
import { Podium } from './mobile/Podium';
import { PlayerRankCard } from './mobile/PlayerRankCard';
import { LeaderboardScatter, RankingViewToggle, type RankingView } from './LeaderboardScatter';
import { PlayerLink } from '../../components/PlayerLink';
import { api, type Season, type SeasonStanding } from '../../lib/api';
import { useLeagueData } from '../../hooks/useLeagueData';

export function LeaderboardMobile() {
  const { leaderboard, matches, me, allOps, locations, refresh } = useLeagueData();
  const myLogin = me?.login;
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<RankingView>('list');

  // Saison affichée : '' = en cours (live), sinon snapshot d'une saison passée.
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
    api.seasonStandings(seasonId).then((s) => alive && setStandings(s)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [seasonId]);
  const pastSeasons = seasons.filter((s) => !s.isActive);
  const viewingPast = standings !== null;

  const winsLossesByLogin = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number }>();
    for (const u of leaderboard) map.set(u.login, { wins: 0, losses: 0 });
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
    return map;
  }, [leaderboard, matches]);

  // Tri par rang officiel (ELO) — comme la vue desktop.
  const sortedLeaderboard = useMemo(
    () => [...leaderboard].sort((a, b) => a.rank - b.rank),
    [leaderboard],
  );

  // Top 3 par rang → podium (or / argent / bronze cohérents avec l'ELO).
  const top3 = sortedLeaderboard.slice(0, 3);

  // Win rate des 3 du podium (affiché sous l'ELO, façon tracker esport).
  const podiumStats = useMemo(() => {
    const m = new Map<string, { winRate: number; games: number }>();
    for (const u of top3) {
      const wl = winsLossesByLogin.get(u.login) ?? { wins: 0, losses: 0 };
      const games = wl.wins + wl.losses;
      m.set(u.login, {
        games,
        winRate: games === 0 ? 0 : Math.round((wl.wins / games) * 100),
      });
    }
    return m;
  }, [top3, winsLossesByLogin]);

  // Une seule liste : tout le classement après le podium, filtré par la recherche.
  const normalizedQuery = query.trim().toLowerCase();
  const rest = useMemo(() => {
    const list = sortedLeaderboard.slice(3);
    if (!normalizedQuery) return list;
    return list.filter((u) => u.login.toLowerCase().includes(normalizedQuery));
  }, [sortedLeaderboard, normalizedQuery]);

  const myRank = sortedLeaderboard.find((u) => u.login === myLogin)?.rank;

  // À l'arrivée sur la page (et hors recherche), on centre la liste sur la carte
  // de l'utilisateur. Différé pour passer APRÈS le reset de scroll du shell.
  useEffect(() => {
    if (!myLogin || normalizedQuery) return;
    const el = document.getElementById('lb-me-row');
    if (!el) return;
    const id = window.setTimeout(() => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 160);
    return () => window.clearTimeout(id);
  }, [myLogin, normalizedQuery, sortedLeaderboard.length]);

  return (
    <PullToRefresh onRefresh={refresh}>
      <div className="space-y-5">
        {/* Sélecteur de saison (si des saisons passées existent) */}
        {pastSeasons.length > 0 && (
          <div className="flex justify-center pt-1">
            <select
              value={seasonId}
              onChange={(e) => setSeasonId(e.target.value)}
              className="px-3 py-1.5 bg-bg-1 border border-border rounded-lg text-xs font-bold uppercase tracking-wider text-text focus:border-gold outline-none"
            >
              <option value="">Saison en cours</option>
              {pastSeasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {viewingPast ? (
          <div className="space-y-1.5">
            {(standings ?? []).length === 0 ? (
              <div className="text-center text-muted-2 py-10 text-sm">Aucun classement archivé.</div>
            ) : (
              (standings ?? []).map((s) => (
                <div
                  key={s.login}
                  className="flex items-center gap-3 card-hud rounded-xl px-3 py-2.5"
                >
                  <span className="w-8 text-center font-display font-black tabular-nums text-sm">
                    {s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : s.rank === 3 ? '🥉' : `#${s.rank}`}
                  </span>
                  <PlayerLink login={s.login} className="flex-1 min-w-0">
                    <span className="font-semibold text-text-strong truncate">{s.login}</span>
                  </PlayerLink>
                  <span className="font-display font-extrabold text-gold tabular-nums text-sm">{s.elo}</span>
                  <span className="text-[11px] text-muted-2 font-mono tabular-nums w-12 text-right">
                    {s.wins}-{s.losses}
                  </span>
                </div>
              ))
            )}
          </div>
        ) : (
        <>
        {/* Bascule liste / nuage de points */}
        <div className="flex justify-center pt-1">
          <RankingViewToggle view={viewMode} onChange={setViewMode} />
        </div>

        {viewMode === 'graph' ? (
          <LeaderboardScatter entries={sortedLeaderboard} myLogin={myLogin} className="h-[70vh]" />
        ) : (
        <>
        {/* Podium top 3 — toujours en haut (masqué seulement pendant une recherche). */}
        {top3.length > 0 && !normalizedQuery && (
          <Podium top3={top3} statsByLogin={podiumStats} />
        )}

        {/* Stats globales */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-around py-2 px-3 rounded-2xl card-hud"
        >
          <Stat label="Joueurs" value={leaderboard.length} />
          <div className="w-px h-8 bg-border" />
          <Stat label="Matches" value={matches.length} />
          {myRank && (
            <>
              <div className="w-px h-8 bg-border" />
              <Stat label="Toi" value={`#${myRank}`} tone="teal" />
            </>
          )}
        </motion.div>

        {/* Recherche */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" strokeWidth={2.5} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chercher un joueur…"
            className="w-full pl-11 pr-10 py-3 bg-bg-1 border border-border rounded-xl text-sm font-medium focus:border-gold focus:shadow-[0_0_16px_rgba(255,201,74,0.18)] outline-none text-text-strong placeholder:text-muted tap-transparent allow-select transition-all"
          />
          {query && (
            <button
              type="button"
              aria-label="Effacer"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full text-muted hover:text-red hover:bg-red/10 tap-transparent"
            >
              <X className="w-4 h-4" strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Liste des joueurs */}
        {rest.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-2">
            {query ? `Aucun joueur trouvé pour "${query}"` : 'Aucun joueur'}
          </div>
        ) : (
          <StaggerList className="space-y-2" stagger={0.03}>
            {rest.map((entry) => {
              const wl = winsLossesByLogin.get(entry.login) ?? { wins: 0, losses: 0 };
              const isMe = entry.login === myLogin;
              const targetedBy = allOps.find((o) => o.targetLogin === entry.login);
              return (
                <StaggerItem key={entry.login}>
                  <div id={isMe ? 'lb-me-row' : undefined} className="scroll-mt-24">
                    <PlayerRankCard
                      entry={entry}
                      wins={wl.wins}
                      losses={wl.losses}
                      isMe={isMe}
                      targetedBy={targetedBy}
                      host={locations.get(entry.login)}
                    />
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerList>
        )}
        </>
        )}
        </>
        )}
      </div>
    </PullToRefresh>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  tone?: 'default' | 'teal';
}) {
  const toneCls = tone === 'teal' ? 'text-gold' : 'text-text-strong';
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1">
      <div className={`font-display text-base font-black tabular-nums leading-none ${toneCls}`}>
        {value}
      </div>
      <div className="text-[9px] text-muted uppercase tracking-[0.16em] font-extrabold leading-none">
        {label}
      </div>
    </div>
  );
}
