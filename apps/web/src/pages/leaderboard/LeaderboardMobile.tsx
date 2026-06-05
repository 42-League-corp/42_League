import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, LocateFixed } from 'lucide-react';
import { PullToRefresh } from '../../mobile/primitives/PullToRefresh';
import { StaggerList, StaggerItem } from '../../mobile/motion/StaggerList';
import { RankingScopeToggle } from './RankingScopeToggle';
import { Podium } from './mobile/Podium';
import { PlayerRankCard } from './mobile/PlayerRankCard';
import { LeaderboardScatter, RankingViewToggle, GradesNavButton, type RankingView } from './LeaderboardScatter';
import { GoatView } from '../GoatPage';
import { LeaderboardBanner } from '../../components/LeaderboardBanner';
import { TeamLeaderboard } from './TeamLeaderboard';
import { api, type Season, type SeasonStanding, type LeaderboardEntry } from '../../lib/api';
import { useLeagueData } from '../../hooks/useLeagueData';
import { useGameMode } from '../../hooks/useGameMode';
import { useT } from '../../lib/i18n';

type LeaderboardTab = 'personal' | 'teams';

export function LeaderboardMobile() {
  const t = useT();
  const { leaderboard, matches: allMatches, me, allOps, locations, refresh } = useLeagueData();
  const { game } = useGameMode();
  const matches = useMemo(
    () => allMatches.filter((m) => (m.game ?? 'babyfoot') === game),
    [allMatches, game],
  );
  const myLogin = me?.login;
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<RankingView>('list');

  // Onglets — le classement Équipes n'est disponible qu'en Babyfoot.
  const showTeamsTab = game === 'babyfoot';
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('personal');
  // Réinitialise sur l'onglet personnel si on change de jeu.
  useEffect(() => {
    if (game !== 'babyfoot') setActiveTab('personal');
  }, [game]);

  const tabChoices = [
    { value: 'personal' as LeaderboardTab, label: t('lb.tab.solo') },
    ...(showTeamsTab ? [{ value: 'teams' as LeaderboardTab, label: t('lb.tab.teams') }] : []),
  ];

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
    api.seasonStandings(seasonId, game).then((s) => alive && setStandings(s)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [seasonId, game]);
  const pastSeasons = seasons.filter((s) => !s.isActive);
  const viewingPast = standings !== null;

  // Photos par login (le snapshot d'une saison ne stocke pas l'imageUrl → on
  // réutilise la photo actuelle du joueur, prise dans le classement courant).
  const imgByLogin = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const u of leaderboard) m.set(u.login, u.imageUrl);
    return m;
  }, [leaderboard]);

  // Classement figé d'une saison passée transformé en entrées « façon live ».
  const pastEntries = useMemo<LeaderboardEntry[]>(() => {
    if (!standings) return [];
    return standings.map((s) => ({
      rank: s.rank,
      login: s.login,
      elo: s.elo,
      imageUrl: imgByLogin.get(s.login) ?? null,
      matchesPlayed: s.wins + s.losses,
      campus: null,
    }));
  }, [standings, imgByLogin]);

  const winsLossesByLogin = useMemo(() => {
    const map = new Map<string, { wins: number; losses: number }>();
    // Saison passée : V/D figés dans le snapshot.
    if (standings) {
      for (const s of standings) map.set(s.login, { wins: s.wins, losses: s.losses });
      return map;
    }
    for (const u of leaderboard) map.set(u.login, { wins: 0, losses: 0 });
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
    return map;
  }, [standings, leaderboard, matches]);

  // Win rate par login — abscisse du nuage de points.
  const winRates = useMemo(() => {
    const map = new Map<string, number>();
    for (const [login, wl] of winsLossesByLogin) {
      const g = wl.wins + wl.losses;
      map.set(login, g === 0 ? 0 : Math.round((wl.wins / g) * 100));
    }
    return map;
  }, [winsLossesByLogin]);

  // Tri par rang officiel (ELO) — comme la vue desktop. En saison passée, on
  // affiche le classement figé (mêmes composants, photos grisées).
  const sortedLeaderboard = useMemo(
    () => [...(viewingPast ? pastEntries : leaderboard)].sort((a, b) => a.rank - b.rank),
    [viewingPast, pastEntries, leaderboard],
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

  // Bouton « Où suis-je ? » : centre la liste sur la carte du joueur courant.
  // (Plus d'auto-scroll au montage — déclenché à la demande via le bouton.)
  const scrollToMe = useCallback(() => {
    const el = document.getElementById('lb-me-row');
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  return (
    <PullToRefresh onRefresh={refresh}>
      <div className="space-y-5">
        {/* Onglets Personnel / Équipes */}
        {showTeamsTab && (
          <RankingScopeToggle
            value={activeTab}
            onChange={setActiveTab}
            choices={tabChoices}
          />
        )}

        {/* ── Transition entre onglets ────────────────────────────────────── */}
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'teams' ? (
            <motion.div
              key="teams"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <TeamLeaderboard />
            </motion.div>
          ) : (
            <motion.div
              key="personal"
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 18 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-5"
            >

        {/* Sélecteur de saison (si des saisons passées existent) */}
        {pastSeasons.length > 0 && (
          <div className="flex justify-center pt-1">
            <select
              value={seasonId}
              onChange={(e) => setSeasonId(e.target.value)}
              className="px-3 py-1.5 bg-bg-1 border border-border rounded-lg text-xs font-bold uppercase tracking-wider text-text focus:border-gold outline-none"
            >
              <option value="">{t('lb.season.currentLong')}</option>
              {pastSeasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {viewingPast ? (
          sortedLeaderboard.length === 0 ? (
            <div className="text-center text-muted-2 py-10 text-sm">{t('lb.snapshot.emptyShort')}</div>
          ) : (
            <div className="space-y-5">
              {/* Podium top 3 — mêmes marches, photos grisées (classement figé) */}
              {top3.length > 0 && <Podium top3={top3} statsByLogin={podiumStats} past />}
              {/* Reste du classement : mêmes cartes que le live, photos grisées */}
              <StaggerList className="space-y-2" stagger={0.03}>
                {sortedLeaderboard.slice(3).map((entry) => {
                  const wl = winsLossesByLogin.get(entry.login) ?? { wins: 0, losses: 0 };
                  return (
                    <StaggerItem key={entry.login}>
                      <PlayerRankCard
                        entry={entry}
                        wins={wl.wins}
                        losses={wl.losses}
                        isMe={entry.login === myLogin}
                        past
                      />
                    </StaggerItem>
                  );
                })}
              </StaggerList>
            </div>
          )
        ) : (
        <>
        {/* ── Banner GAME en tout premier, avant même le podium ────────── */}
        <LeaderboardBanner />

        {/* Podium top 3 — uniquement en vue liste (ni nuage, ni G.O.A.T) */}
        {viewMode === 'list' && top3.length > 0 && !normalizedQuery && (
          <Podium top3={top3} statsByLogin={podiumStats} />
        )}

        {/* Barre d'outils : bascule liste / nuage / G.O.A.T + accès Paliers */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <RankingViewToggle view={viewMode} onChange={setViewMode} />
          <GradesNavButton />
        </div>

        {viewMode === 'graph' ? (
          <LeaderboardScatter
            entries={sortedLeaderboard}
            myLogin={myLogin}
            winRates={winRates}
            className="h-[clamp(320px,70vh,560px)]"
          />
        ) : viewMode === 'goat' ? (
          <GoatView />
        ) : (
        <>
        {/* (podium déjà rendu au-dessus) */}
        {false && null /* placeholder to keep nesting */}

        {/* Stats globales */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-around py-2 px-3 rounded-2xl card-hud"
        >
          <Stat label={t('lb.stat.players')} value={leaderboard.length} />
          <div className="w-px h-8 bg-border" />
          <Stat label={t('lb.stat.matches')} value={matches.length} />
          {myRank && (
            <>
              <div className="w-px h-8 bg-border" />
              <Stat label={t('lb.me')} value={`#${myRank}`} tone="teal" />
            </>
          )}
        </motion.div>

        {/* Bouton « Où suis-je ? » — recentre la liste sur ma carte (hors recherche). */}
        {myRank && !normalizedQuery && (
          <button
            type="button"
            onClick={scrollToMe}
            className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl border border-gold/30 bg-gold/10 text-gold text-sm font-semibold active:scale-[0.98] transition-transform tap-transparent"
          >
            <LocateFixed className="w-4 h-4" strokeWidth={2.4} />
            {t('lb.whereAmI')}
          </button>
        )}

        {/* Recherche */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" strokeWidth={2.5} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('lb.search.placeholder')}
            className="w-full pl-11 pr-10 py-3 bg-bg-1 border border-border rounded-xl text-sm font-medium focus:border-gold focus:shadow-[0_0_16px_rgba(255,201,74,0.18)] outline-none text-text-strong placeholder:text-muted tap-transparent allow-select transition-all"
          />
          {query && (
            <button
              type="button"
              aria-label={t('lb.search.clear')}
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
            {query ? `${t('lb.search.noResult')} "${query}"` : t('lb.search.empty')}
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
            </motion.div>
          )}
        </AnimatePresence>

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
