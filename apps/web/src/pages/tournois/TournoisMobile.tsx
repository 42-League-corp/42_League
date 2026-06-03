import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trophy, ChevronRight, Info } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useFAB } from '../../mobile/primitives/FAB';
import { PullToRefresh } from '../../mobile/primitives/PullToRefresh';
import { TournamentCard } from './mobile/TournamentCard';
import { useLeagueData } from '../../hooks/useLeagueData';
import type { Tournament } from '../../lib/api';

type Filter = 'all' | 'live' | 'open' | 'done';

export function TournoisMobile() {
  const { tournaments, refresh } = useLeagueData();
  const navigate = useNavigate();
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

  const liveTournament = tournaments.find((t) => t.status === 'in_progress');

  const filtered = useMemo(() => {
    if (filter === 'all') return liveTournament ? tournaments.filter((t) => t.id !== liveTournament.id) : tournaments;
    if (filter === 'live') return tournaments.filter((t) => t.status === 'in_progress');
    if (filter === 'open') return tournaments.filter((t) => t.status === 'registration');
    if (filter === 'done') return tournaments.filter((t) => t.status === 'finished');
    return tournaments;
  }, [tournaments, filter, liveTournament]);

  useFAB({
    Icon: Plus,
    label: 'Nouveau tournoi',
    onClick: () => navigate('/tournaments/create'),
    pulse: tournaments.length === 0,
  });

  return (
    <PullToRefresh onRefresh={refresh}>
      <div className="space-y-5 pb-8">

        {/* ── 0. Tournoi LIVE — hero card pleine largeur ──────────── */}
        {liveTournament && filter === 'all' && (
          <LiveHero tournament={liveTournament} />
        )}

        {/* ── 1. État vide ── */}
        {tournaments.length === 0 && <EmptyTournois />}

        {/* ── 2. Filtres pill (seulement s'il y a des tournois) ──── */}
        {tournaments.length > 0 && (
          <FilterPills filter={filter} onChange={setFilter} counts={counts} total={tournaments.length} />
        )}

        {/* ── 3. Liste ──────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {filtered.length === 0 ? (
            filter !== 'all' && <EmptyFilter key={filter} filter={filter} />
          ) : (
            <motion.div
              key={filter}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {filtered.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.22 }}
                >
                  <TournamentCard tournament={t} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 4. Aide discrète (accessible mais pas intrusif) ─────── */}
        {tournaments.length > 0 && <QuickHelp />}

      </div>
    </PullToRefresh>
  );
}

// ─── État vide ───────────────────────────────────────────────────────────────

function EmptyTournois() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-20 gap-3"
    >
      <Trophy className="w-10 h-10 text-gold/30" strokeWidth={1.5} />
      <p className="text-sm font-bold text-muted-2">Aucun tournoi pour l'instant</p>
      <p className="text-xs text-muted-2/60">Appuie sur + pour en créer un</p>
    </motion.div>
  );
}

// ─── Hero d'un tournoi live ───────────────────────────────────────────────────

function LiveHero({ tournament }: { tournament: Tournament }) {
  const count = tournament.entries?.length ?? 0;
  return (
    <Link to={`/tournaments/${encodeURIComponent(tournament.id)}`} className="block">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-2xl overflow-hidden active:scale-[0.98] transition-transform tap-transparent"
        style={{
          background: 'linear-gradient(145deg, rgba(42,34,12,0.9) 0%, rgba(18,15,6,0.96) 100%)',
          border: '1.5px solid rgba(255,201,74,0.5)',
          boxShadow: '0 0 32px rgba(255,201,74,0.18)',
        }}
      >
        {/* Scanline live */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent animate-pulse" />

        <div className="p-5">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold/15 border border-gold/30 text-gold text-[9px] font-extrabold uppercase tracking-[0.18em]">
              <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
              Live
            </span>
            <span className="text-[10px] text-muted-2 font-bold">
              {count}/{tournament.capacity} joueurs · {tournament.game && tournament.game !== 'babyfoot'
                ? (tournament.game === 'smash' ? '🎮 Smash' : tournament.game === 'streetfighter' ? '🥊 Street Fighter' : '♟ Échecs')
                : '⚽ Babyfoot'}
            </span>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <Trophy className="w-6 h-6 text-gold shrink-0" strokeWidth={2.2} fill="rgba(255,201,74,0.35)" />
            <div className="min-w-0">
              <h3 className="text-xl font-extrabold text-text-strong tracking-tight truncate">{tournament.name}</h3>
              <div className="text-[11px] text-muted-2">Par {tournament.createdByLogin}</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-bg-0/60 overflow-hidden mb-3">
            <div className="h-full rounded-full bg-gradient-to-r from-gold to-[#ffdb8a]"
              style={{ width: `${Math.min(100, Math.round(count / tournament.capacity * 100))}%` }} />
          </div>

          <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl metal-plate-gold text-[#1a1100] text-xs font-extrabold uppercase tracking-wider">
            Voir le bracket <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

// ─── Filtres en pills colorées ────────────────────────────────────────────────

interface FilterPillsProps {
  filter: Filter;
  onChange: (f: Filter) => void;
  counts: { live: number; open: number; done: number };
  total: number;
}

const PILL_META: Record<Filter, { label: string; accent: string }> = {
  all: { label: 'Tous', accent: 'border-border text-muted-2 bg-transparent' },
  live: { label: '● Live', accent: 'border-gold/50 text-gold' },
  open: { label: 'Inscriptions', accent: 'border-teal/50 text-teal' },
  done: { label: 'Terminés', accent: 'border-border/60 text-muted-2' },
};

function FilterPills({ filter, onChange, counts, total }: FilterPillsProps) {
  const opts: Array<{ key: Filter; badge: number }> = [
    { key: 'all', badge: total },
    { key: 'live', badge: counts.live },
    { key: 'open', badge: counts.open },
    { key: 'done', badge: counts.done },
  ];
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
      {opts.map(({ key, badge }) => {
        const active = filter === key;
        const m = PILL_META[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-extrabold uppercase tracking-[0.12em] transition-all tap-transparent ${
              active
                ? `${m.accent} bg-white/[0.06]`
                : 'border-border/40 text-muted-2 bg-transparent'
            }`}
          >
            {m.label}
            {badge > 0 && (
              <span className={`font-mono text-[9px] ${active ? 'opacity-80' : 'opacity-50'}`}>
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Empty filter state ───────────────────────────────────────────────────────

function EmptyFilter({ filter }: { filter: Filter }) {
  const msgs: Record<Filter, { emoji: string; main: string; sub: string }> = {
    all: { emoji: '🏆', main: 'Aucun tournoi', sub: '' },
    live: { emoji: '⏳', main: 'Aucun tournoi en cours', sub: 'Rendez-vous dans Inscriptions.' },
    open: { emoji: '📝', main: "Pas d'inscriptions ouvertes", sub: 'Lance-en un avec + en bas a droite.' },
    done: { emoji: '🥇', main: 'Aucun tournoi terminé', sub: 'Les résultats apparaîtront ici.' },
  };
  const m = msgs[filter];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10">
      <div className="text-4xl mb-3 opacity-50">{m.emoji}</div>
      <div className="text-sm font-bold text-text-strong mb-1">{m.main}</div>
      {m.sub && <div className="text-xs text-muted-2">{m.sub}</div>}
    </motion.div>
  );
}

// ─── Aide rapide discrète ─────────────────────────────────────────────────────

function QuickHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[10px] text-muted-2 hover:text-muted transition-colors tap-transparent">
        <Info className="w-3.5 h-3.5" strokeWidth={2} />
        Comment ça marche ?
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
            className="mt-2 space-y-2 overflow-hidden">
            <div className="grid grid-cols-2 gap-2">
              {[
                { num: '1', text: '+ Nouveau → choisis nom, capacité, discipline.' },
                { num: '2', text: "Les joueurs s'inscrivent depuis la carte." },
                { num: '3', text: 'Démarre : le bracket se génère automatiquement.' },
                { num: '4', text: 'Chaque match : saisir le score + confirmer.' },
              ].map(({ num, text }) => (
                <div key={num} className="flex gap-2 text-[10px] text-muted-2 p-2 rounded-lg bg-white/[0.02]">
                  <span className="w-4 h-4 rounded-full bg-gold/15 text-gold text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">{num}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
