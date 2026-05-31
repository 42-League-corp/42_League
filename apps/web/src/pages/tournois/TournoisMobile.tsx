import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trophy } from 'lucide-react';
import { useFAB } from '../../mobile/primitives/FAB';
import { MetalFrame } from '../../mobile/primitives/MetalFrame';
import { TrophySilhouette } from '../../mobile/primitives/Silhouettes';
import { StaggerList, StaggerItem } from '../../mobile/motion/StaggerList';
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

  const liveTournament: Tournament | undefined = tournaments.find((t) => t.status === 'in_progress');

  const filtered = useMemo(() => {
    // En 'all', le tournoi live est déjà mis en avant dans le Hero → on l'exclut
    // de la liste pour ne pas le dupliquer.
    if (filter === 'all') {
      return liveTournament
        ? tournaments.filter((t) => t.id !== liveTournament.id)
        : tournaments;
    }
    if (filter === 'live') return tournaments.filter((t) => t.status === 'in_progress');
    if (filter === 'open') return tournaments.filter((t) => t.status === 'registration');
    if (filter === 'done') return tournaments.filter((t) => t.status === 'finished');
    return tournaments;
  }, [tournaments, filter, liveTournament]);

  const filterChoices: SegmentChoice<Filter>[] = [
    { value: 'all', label: 'Tous', badge: tournaments.length },
    { value: 'live', label: 'Live', badge: counts.live },
    { value: 'open', label: 'Inscr.', badge: counts.open },
    { value: 'done', label: 'Finis', badge: counts.done },
  ];

  useFAB({
    Icon: Plus,
    label: 'Nouveau',
    onClick: () => setCreateOpen(true),
    pulse: tournaments.length === 0,
  });

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
          <StaggerList className="space-y-3">
            {filtered.map((t) => (
              <StaggerItem key={t.id}>
                <TournamentCard tournament={t} />
              </StaggerItem>
            ))}
          </StaggerList>
        )}

        {/* Comment ça marche ? (parité avec la version desktop) */}
        <HowItWorks />

      </div>

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
      className="gpu"
    >
      <MetalFrame variant="hero" gear shimmer conic glow>
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent animate-pulse z-[1]" />

        {/* Silhouette trophée décorative en arrière-plan (clippée par MetalFrame) */}
        <div className="absolute right-2 bottom-2 w-28 h-28 opacity-[0.07] pointer-events-none text-gold">
          <TrophySilhouette className="w-full h-full" />
        </div>

        <div className="relative p-5">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/15 text-gold text-[9px] font-extrabold uppercase tracking-[0.18em] border border-gold/30">
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
              En cours
            </span>
            <span className="text-[10px] text-muted-2 uppercase tracking-wider font-bold">
              · {count}/{tournament.capacity} joueurs
            </span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy
              className="w-5 h-5 text-gold flex-shrink-0"
              strokeWidth={2.5}
              fill="rgba(255,201,74,0.35)"
            />
            <h3 className="text-xl font-extrabold text-text-strong tracking-tight truncate">
              {tournament.name}
            </h3>
          </div>
          <div className="text-xs text-muted-2 mb-3">
            Organisé par{' '}
            <span className="font-bold text-text-strong">{tournament.createdByLogin}</span>
          </div>
          <a
            href={`/tournaments/${encodeURIComponent(tournament.id)}`}
            className="shine inline-flex items-center gap-1.5 px-4 py-2 rounded-xl metal-plate-gold text-[#1a1100] text-xs font-extrabold uppercase tracking-wider active:scale-95 transition-transform tap-transparent"
          >
            Voir le bracket
            <span>→</span>
          </a>
        </div>
      </MetalFrame>
    </motion.div>
  );
}

function HowItWorks() {
  return (
    <section className="pt-2">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="inline-block w-1 h-3 bg-gradient-to-b from-gold to-gold-dim rounded-sm" />
        <span className="font-gaming text-[10px] uppercase tracking-[0.18em] font-extrabold text-gold/90">
          Comment ça marche ?
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-gold/30 to-transparent ml-2" />
      </div>
      <div className="space-y-3">
        <div className="card-hud rounded-2xl p-4">
          <h3 className="font-gaming text-xs font-extrabold uppercase tracking-[0.16em] text-teal mb-2">
            🎲 Tournoi amical
          </h3>
          <p className="text-xs text-muted-2 leading-relaxed">
            Tout le monde peut en lancer un : choisis un nom, 8 ou 16 joueurs, puis démarre le
            bracket avec le bouton <span className="text-text-strong font-semibold">Nouveau</span>.
            Idéal pour s'amuser entre collègues — sans impact sur le classement.
          </p>
        </div>
        <div className="card-hud rounded-2xl p-4 border border-gold/40">
          <h3 className="font-gaming text-xs font-extrabold uppercase tracking-[0.16em] text-gold mb-2">
            👑 Tournoi officiel
          </h3>
          <p className="text-xs text-muted-2 leading-relaxed">
            Réservé aux admins : seuls les administrateurs peuvent les lancer. En échange, ils
            donnent lieu à des récompenses très spéciales —{' '}
            <span className="text-gold font-semibold">titres exclusifs</span>,{' '}
            <span className="text-gold font-semibold">League Coins</span> et{' '}
            <span className="text-gold font-semibold">cosmétiques</span>.
          </p>
        </div>
      </div>
    </section>
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
