import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Crown, ChevronLeft, Flame } from 'lucide-react';
import { Panel } from '../components/Panel';
import { Avatar } from '../components/Avatar';
import { PlayerLink } from '../components/PlayerLink';
import { TournamentCup } from '../components/TournamentCup';
import { useLeagueData } from '../hooks/useLeagueData';
import { useGameMode } from '../hooks/useGameMode';
import {
  computeGoat,
  GOAT_WEIGHTS,
  type GoatPlayer,
  type GoatMetricKey,
} from '../lib/goat';
import type { LeaderboardEntry } from '../lib/api';

const OFFICIAL_CUP = '#ff6b6b';
const FRIENDLY_CUP = '#ffc94a';

function displayName(e: LeaderboardEntry): string {
  const full = [e.firstName, e.lastName].filter(Boolean).join(' ').trim();
  return full || e.login;
}

export function GoatPage() {
  const { leaderboard, matches, tournaments, me } = useLeagueData();
  const { game } = useGameMode();
  const navigate = useNavigate();
  const [showIntro, setShowIntro] = useState(true);
  const ranking = useMemo(
    () => computeGoat(leaderboard, matches.filter((m) => (m.game ?? 'babyfoot') === game), tournaments),
    [leaderboard, matches, tournaments, game],
  );

  const goat = ranking[0];
  const rest = ranking.slice(1);

  return (
    <Panel title="G.O.A.T" sub="Greatest Of All Time" accent="crown">
      {/* ── Bouton retour ── */}
      <button
        type="button"
        onClick={() => navigate('/leaderboard')}
        className="group inline-flex items-center gap-1 mb-4 rounded-lg px-2.5 py-1.5 text-[11px] uppercase tracking-wider font-semibold text-muted-2 hover:text-gold hover:bg-white/[0.03] border border-transparent hover:border-border/50 transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" strokeWidth={2.5} />
        Retour
      </button>

      {/* ── Contenu (grisé tant que l'intro est affichée) ── */}
      <motion.div
        animate={{
          opacity: showIntro ? 0.35 : 1,
          filter: showIntro ? 'blur(3px)' : 'blur(0px)',
        }}
        initial={false}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className={showIntro ? 'pointer-events-none select-none' : ''}
        aria-hidden={showIntro}
      >
      <div className="flex items-center justify-between mb-5">
        <Link to="/leaderboard" className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-2 hover:text-gold transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
          Classement
        </Link>
        <div className="text-[10px] text-muted-2 text-right leading-snug">
          <span className="text-gold/80">ELO 50%</span>
          {' · '}
          <span className="text-[#f5b942]/80">WR 30%</span>
          {' · '}
          <span className="text-[#cd7f32]/80">Titres 20%</span>
        </div>
      </div>

      {!goat ? (
        <div className="text-center text-muted-2 py-16">
          <div className="text-5xl mb-3 opacity-40">🐐</div>
          <div className="text-sm font-semibold">Pas encore assez de données</div>
          <div className="text-xs mt-1">Joue quelques matchs pour voir émerger un G.O.A.T</div>
        </div>
      ) : (
        <>
          {/* ── Héro G.O.A.T ── */}
          <GoatHero player={goat} isMe={goat.entry.login === me?.login} />

          {/* ── Prétendants : grille de cartes, tout visible, pas de "Voir plus" ── */}
          {rest.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="font-gaming text-[10px] uppercase tracking-[0.18em] text-gold/80 font-extrabold">Les prétendants</span>
                <div className="flex-1 h-px bg-gradient-to-r from-gold/20 to-transparent" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rest.map((p) => (
                  <ContenderCard key={p.entry.login} player={p} isMe={p.entry.login === me?.login} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
      </motion.div>

      {/* ── Overlay d'explication (premier affichage) ── */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            key="goat-intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 z-30 flex items-center justify-center p-4 sm:p-6"
            style={{ background: 'rgba(8,6,3,0.55)', backdropFilter: 'blur(2px)' }}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-md rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(155deg, rgba(50,38,12,0.96) 0%, rgba(20,16,7,0.98) 100%)',
                border: '1.5px solid rgba(255,201,74,0.45)',
                boxShadow: '0 0 50px rgba(255,201,74,0.18), inset 0 1px 0 rgba(255,215,120,0.12)',
              }}
            >
              <div className="absolute -right-6 -top-6 opacity-[0.07] pointer-events-none">
                <Crown className="w-40 h-40 text-gold" fill="currentColor" strokeWidth={0.5} />
              </div>
              <div className="relative p-6 sm:p-7">
                <div className="flex items-center gap-2.5 mb-3">
                  <Crown className="w-6 h-6 text-gold drop-shadow-[0_2px_8px_rgba(255,201,74,0.6)]" fill="currentColor" strokeWidth={1.5} />
                  <span className="font-display text-xl font-black text-text-strong leading-none">
                    Le G.O.A.T
                  </span>
                </div>
                <div className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-gold mb-4">
                  🐐 Greatest Of All Time
                </div>
                <p className="text-sm text-muted leading-relaxed">
                  Bienvenue dans le panthéon de la 42 League. Cette page met à l'honneur les meilleurs
                  joueurs de tous les temps, classés par un <span className="text-gold/90 font-semibold">Score G.O.A.T</span> qui
                  synthétise toute leur carrière.
                </p>
                <p className="text-sm text-muted leading-relaxed mt-3">
                  Le classement combine trois mesures : l'<span className="text-gold/90 font-semibold">ELO</span> (50 %),
                  le <span className="text-[#f5b942]/90 font-semibold">taux de victoire</span> (30 %) et
                  les <span className="text-[#cd7f32]/90 font-semibold">titres remportés</span> en tournoi (20 %).
                  Le joueur en tête trône en couronne, ses prétendants le suivent juste en dessous.
                </p>
                <button
                  type="button"
                  onClick={() => setShowIntro(false)}
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-display text-sm font-black uppercase tracking-wider text-bg-1 bg-gradient-to-r from-gold to-[#f5b942] hover:brightness-110 shadow-gold-glow transition-all active:scale-[0.98]"
                >
                  J'ai compris
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}

// ─── Héro (n°1) ──────────────────────────────────────────────────────────────

function GoatHero({ player, isMe }: { player: GoatPlayer; isMe: boolean }) {
  const { entry, metrics } = player;
  return (
    <div className="relative rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, rgba(50,38,12,0.9) 0%, rgba(22,18,8,0.95) 100%)',
        border: '1.5px solid rgba(255,201,74,0.45)',
        boxShadow: '0 0 40px rgba(255,201,74,0.14), inset 0 1px 0 rgba(255,215,120,0.12)',
      }}
    >
      {/* Filigrane couronne */}
      <div className="absolute -right-8 -top-8 opacity-[0.06] pointer-events-none">
        <Crown className="w-48 h-48 text-gold" fill="currentColor" strokeWidth={0.5} />
      </div>

      <div className="relative p-5 sm:p-6">
        {/* En-tête */}
        <div className="flex items-start gap-4 mb-5">
          <div className="relative shrink-0">
            <Avatar login={entry.login} imageUrl={entry.imageUrl} size="xl"
              className="ring-2 ring-gold ring-offset-2 ring-offset-bg-1 shadow-gold-glow" />
            <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 text-gold drop-shadow-[0_2px_8px_rgba(255,201,74,0.75)]"
              fill="currentColor" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-extrabold uppercase tracking-[0.24em] text-gold mb-1">
              🐐 Greatest Of All Time {isMe && '· toi'}
            </div>
            <PlayerLink login={entry.login} className="inline-block">
              <span className="font-display text-2xl sm:text-3xl font-black text-text-strong leading-none">
                {displayName(entry)}
              </span>
            </PlayerLink>
            <div className="text-xs text-muted-2 mt-1">@{entry.login} · #{entry.rank} ELO</div>
          </div>
          {/* Score GOAT */}
          <div className="text-right shrink-0">
            <div className="font-display text-5xl font-black gradient-text-brand tabular-nums leading-none">
              {player.score}
            </div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-muted-2 font-bold mt-1">Score</div>
          </div>
        </div>

        {/* Stats grid compacte */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <MiniStat label="ELO" value={String(metrics.elo)} accent="gold" />
          <MiniStat label="Win rate" value={`${metrics.winRate}%`} accent="gold" />
          <MiniStat label="Matchs" value={`${metrics.wins}V`} accent="teal" />
          <MiniStat label="Coupe off." value={String(metrics.officialTitles)} accent={metrics.officialTitles > 0 ? 'red' : 'muted'} />
        </div>

        {/* Barres de contribution */}
        <MetricBars player={player} />
      </div>
    </div>
  );
}

// ─── Carte prétendant (visible d'emblée, sans expand) ────────────────────────

function ContenderCard({ player, isMe }: { player: GoatPlayer; isMe: boolean }) {
  const { entry, metrics } = player;
  return (
    <div className={`rounded-xl p-3.5 transition-colors ${
      isMe ? 'border border-gold/35 bg-gold/[0.04]' : 'border border-border/50 bg-white/[0.02]'
    }`}>
      {/* En-tête de carte */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-7 text-center font-display font-black tabular-nums text-muted-2 text-sm shrink-0">
          {player.rank}
        </span>
        <PlayerLink login={entry.login} className="flex items-center gap-2 min-w-0 flex-1">
          <Avatar login={entry.login} imageUrl={entry.imageUrl} size="sm" />
          <div className="min-w-0">
            <div className="font-semibold text-text-strong truncate text-sm leading-tight">
              {displayName(entry)}
            </div>
            <div className="text-[10px] text-muted-2 font-mono">{metrics.elo} ELO · {metrics.wins}V</div>
          </div>
        </PlayerLink>
        {/* Score GOAT proéminent */}
        <div className="text-right shrink-0">
          <div className="font-display text-xl font-black text-gold tabular-nums">{player.score}</div>
          {metrics.officialTitles > 0 && (
            <div className="flex items-center justify-end gap-0.5 mt-0.5">
              <TournamentCup accent={OFFICIAL_CUP} className="w-3 h-3" />
              <span className="text-[10px] text-red font-bold">{metrics.officialTitles}</span>
            </div>
          )}
        </div>
      </div>

      {/* Barres compactes — toutes visibles sans expand */}
      <div className="space-y-1">
        {GOAT_WEIGHTS.slice(0, 3).map((w) => {
          const pct = Math.round((player.norm[w.key as GoatMetricKey] ?? 0) * 100);
          return (
            <div key={w.key} className="flex items-center gap-2">
              <span className="w-20 text-[9px] uppercase tracking-wider text-muted-2 font-semibold truncate shrink-0">
                {w.label}
              </span>
              <div className="flex-1 h-1 rounded-full bg-bg-1 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-gold/50 to-gold"
                  style={{ width: `${pct}%`, transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)' }} />
              </div>
              <span className="text-[9px] font-mono text-muted-2 w-7 text-right shrink-0">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function MiniStat({ label, value, accent }: { label: string; value: string; accent: 'gold' | 'teal' | 'red' | 'muted' }) {
  const cls = accent === 'gold' ? 'text-gold' : accent === 'teal' ? 'text-teal' : accent === 'red' ? 'text-red' : 'text-text-strong';
  return (
    <div className="rounded-lg bg-bg-1/60 px-2 py-1.5 text-center">
      <div className={`font-display font-extrabold tabular-nums text-sm ${cls}`}>{value}</div>
      <div className="text-[8px] uppercase tracking-wider text-muted-2 mt-0.5 truncate">{label}</div>
    </div>
  );
}

function MetricBars({ player }: { player: GoatPlayer }) {
  return (
    <div className="space-y-1.5">
      {GOAT_WEIGHTS.map((w) => {
        const pct = Math.round((player.norm[w.key as GoatMetricKey] ?? 0) * 100);
        return (
          <div key={w.key} className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-[10px] uppercase tracking-wider text-muted-2 font-semibold truncate">
              {w.label}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-bg-0/60 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-gold/60 to-gold"
                style={{ width: `${pct}%` }} />
            </div>
            <span className="w-9 text-right text-[10px] font-mono tabular-nums text-muted-2">
              {Math.round(w.weight * 100)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// unused but kept for compat
const _FRIENDLY_CUP = FRIENDLY_CUP;
void _FRIENDLY_CUP;
const _Flame = Flame;
void _Flame;
