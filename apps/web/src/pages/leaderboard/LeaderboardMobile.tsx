import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { PullToRefresh } from '../../mobile/primitives/PullToRefresh';
import { SegmentedControl, type SegmentChoice } from '../../mobile/primitives/SegmentedControl';
import { Podium } from './mobile/Podium';
import { PlayerRankCard } from './mobile/PlayerRankCard';
import { useLeagueData } from '../../hooks/useLeagueData';

type Filter = 'all' | 'top10' | 'around';

export function LeaderboardMobile() {
  const { leaderboard, matches, me, allOps, refresh } = useLeagueData();
  const myLogin = me?.login;
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

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

  const top3 = leaderboard.slice(0, 3);

  // Le reste après le podium (filtré selon les critères)
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let list = leaderboard.slice(3);

    if (filter === 'top10') {
      list = leaderboard.slice(0, 10);
    } else if (filter === 'around' && myLogin) {
      const myIdx = leaderboard.findIndex((u) => u.login === myLogin);
      if (myIdx >= 0) {
        const start = Math.max(0, myIdx - 5);
        const end = Math.min(leaderboard.length, myIdx + 6);
        list = leaderboard.slice(start, end);
      }
    }

    if (normalizedQuery) {
      list = list.filter((u) => u.login.toLowerCase().includes(normalizedQuery));
    }

    return list;
  }, [leaderboard, filter, query, myLogin]);

  const myRank = leaderboard.find((u) => u.login === myLogin)?.rank;

  const filterChoices: SegmentChoice<Filter>[] = [
    { value: 'all', label: 'Tous' },
    { value: 'top10', label: 'Top 10' },
    ...(myRank ? ([{ value: 'around' as const, label: 'Moi' }] satisfies SegmentChoice<Filter>[]) : []),
  ];

  return (
    <PullToRefresh onRefresh={refresh}>
      <div className="space-y-5">
        {/* Podium top 3 — seulement si on est en mode 'all' ou 'top10' sans recherche */}
        {top3.length > 0 && filter !== 'around' && !query && (
          <Podium top3={top3} />
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

        {/* Filter + search */}
        <div className="space-y-2.5">
          <SegmentedControl<Filter>
            value={filter}
            onChange={setFilter}
            choices={filterChoices}
          />
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
        </div>

        {/* Liste des joueurs */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-2">
              {query ? `Aucun joueur trouvé pour "${query}"` : 'Aucun joueur'}
            </div>
          ) : (
            filtered.map((entry) => {
              const wl = winsLossesByLogin.get(entry.login) ?? { wins: 0, losses: 0 };
              const isMe = entry.login === myLogin;
              const targetedBy = allOps.find((o) => o.targetLogin === entry.login);
              return (
                <PlayerRankCard
                  key={entry.login}
                  entry={entry}
                  wins={wl.wins}
                  losses={wl.losses}
                  isMe={isMe}
                  targetedBy={targetedBy}
                />
              );
            })
          )}
        </div>
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
