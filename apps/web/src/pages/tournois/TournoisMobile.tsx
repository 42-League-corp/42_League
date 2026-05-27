import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trophy } from 'lucide-react';
import { FAB } from '../../mobile/primitives/FAB';
import { PullToRefresh } from '../../mobile/primitives/PullToRefresh';
import { SegmentedControl, type SegmentChoice } from '../../mobile/primitives/SegmentedControl';
import { TournamentCard } from './mobile/TournamentCard';
import { CreateTournamentSheet } from './mobile/CreateTournamentSheet';
import { useLeagueData } from '../../hooks/useLeagueData';
import type { Tournament } from '../../lib/api';

type Filter = 'all' | 'live' | 'open' | 'done';

export function TournoisMobile() {
  const { tournaments, refresh } = useLeagueData();
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const c = { live: 0, open: 0, done: 0 };
    for (const t of tournaments) {
      if (t.status === 'in_progress') c.live++;
      else if (t.status === 'registration') c.open++;
      else if (t.status === 'finished') c.done++;
    }
    return c;
  }, [tournaments]);

  const filtered = useMemo(() => {
    if (filter === 'all') return tournaments;
    if (filter === 'live') return tournaments.filter((t) => t.status === 'in_progress');
    if (filter === 'open') return tournaments.filter((t) => t.status === 'registration');
    if (filter === 'done') return tournaments.filter((t) => t.status === 'finished');
    return tournaments;
  }, [tournaments, filter]);

  const liveTournament: Tournament | undefined = tournaments.find((t) => t.status === 'in_progress');

  const filterChoices: SegmentChoice<Filter>[] = [
    { value: 'all', label: 'Tous', badge: tournaments.length },
    { value: 'live', label: 'Live', badge: counts.live },
    { value: 'open', label: 'Inscr.', badge: counts.open },
    { value: 'done', label: 'Finis', badge: counts.done },
  ];

  return (
    <PullToRefresh onRefresh={refresh}>
      <div className="space-y-5">
        {/* Hero "Tournoi en cours" si il y en a un */}
        {liveTournament && filter === 'all' && (
          <LiveTournamentHero tournament={liveTournament} />
        )}

        {/* Filtres */}
        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          choices={filterChoices}
        />

        {/* Liste */}
        {filtered.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div className="space-y-3">
            {filtered.map((t, i) => (
              <TournamentCard key={t.id} tournament={t} delay={i * 0.04} />
            ))}
          </div>
        )}

        <div className="h-2" />
      </div>

      <FAB
        Icon={Plus}
        label="Nouveau"
        onClick={() => setCreateOpen(true)}
        pulse={tournaments.length === 0}
      />

      <CreateTournamentSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onDone={refresh}
      />
    </PullToRefresh>
  );
}

function LiveTournamentHero({ tournament }: { tournament: Tournament }) {
  const count = tournament.entries?.length ?? 0;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/[0.08] to-bg-1/95 p-5 shadow-gold-glow gpu"
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent animate-pulse" />
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gold/10 blur-3xl pointer-events-none" />

      <div className="relative">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/15 text-gold text-[9px] font-extrabold uppercase tracking-[0.18em]">
            <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
            En cours
          </span>
          <span className="text-[10px] text-muted-2 uppercase tracking-wider font-bold">
            · {count}/{tournament.capacity} joueurs
          </span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="w-5 h-5 text-gold flex-shrink-0" strokeWidth={2.5} fill="rgba(255,201,74,0.35)" />
          <h3 className="text-xl font-extrabold text-text-strong tracking-tight truncate">
            {tournament.name}
          </h3>
        </div>
        <div className="text-xs text-muted-2 mb-3">
          Organisé par <span className="font-bold text-text-strong">{tournament.createdByLogin}</span>
        </div>
        <a
          href={`/tournois/${encodeURIComponent(tournament.id)}`}
          className="shine inline-flex items-center gap-1.5 px-4 py-2 rounded-xl metal-plate-gold text-[#1a1100] text-xs font-extrabold uppercase tracking-wider active:scale-95 transition-transform tap-transparent"
        >
          Voir le bracket
          <span>→</span>
        </a>
      </div>
    </motion.div>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  const messages: Record<Filter, { emoji: string; main: string; sub: string }> = {
    all: { emoji: '🏆', main: 'Aucun tournoi', sub: 'Sois le premier — lance-en un !' },
    live: { emoji: '⏳', main: 'Aucun tournoi en cours', sub: 'Rends-toi dans Inscriptions.' },
    open: { emoji: '📝', main: 'Aucune inscription ouverte', sub: 'Crée un tournoi pour démarrer.' },
    done: { emoji: '🥇', main: 'Pas encore de tournoi terminé', sub: '' },
  };
  const m = messages[filter];
  return (
    <div className="text-center py-12 px-4">
      <div className="text-5xl mb-3 opacity-60">{m.emoji}</div>
      <div className="text-sm text-text-strong font-bold mb-1">{m.main}</div>
      {m.sub && <div className="text-xs text-muted-2">{m.sub}</div>}
    </div>
  );
}
