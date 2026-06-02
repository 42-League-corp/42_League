import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, ChevronDown, ChevronLeft, Flame } from 'lucide-react';
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

const OFFICIAL_CUP = '#ff6b6b'; // coupe rouge = titre officiel (vaut plus)
const FRIENDLY_CUP = '#ffc94a';

function displayName(e: LeaderboardEntry): string {
  const full = [e.firstName, e.lastName].filter(Boolean).join(' ').trim();
  return full || e.login;
}

export function GoatPage() {
  const { leaderboard, matches, tournaments, me } = useLeagueData();
  const { game } = useGameMode();
  const ranking = useMemo(
    () => computeGoat(leaderboard, matches.filter((m) => (m.game ?? 'babyfoot') === game), tournaments),
    [leaderboard, matches, tournaments, game],
  );

  const goat = ranking[0];
  const rest = ranking.slice(1);

  return (
    <Panel title="G.O.A.T" sub="Greatest Of All Time" accent="crown">
      <div className="flex items-center justify-between mb-4">
        <Link
          to="/leaderboard"
          className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-2 hover:text-gold"
        >
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
          Classement
        </Link>
        {/* Explication du score pondéré */}
        <div className="text-[10px] text-muted-2 text-right leading-tight max-w-[180px]">
          Score pondéré :<br/>
          <span className="text-gold/80">ELO × 50%</span>
          {' · '}
          <span className="text-[#f5b942]/80">W% × 30%</span>
          {' · '}
          <span className="text-[#cd7f32]/80">Titres × 20%</span>
        </div>
      </div>

      {/* Contexte : ce n'est pas le classement ELO brut */}
      <div className="mb-5 px-3 py-2.5 rounded-xl bg-gold/[0.05] border border-gold/15 text-[11px] text-muted-2 leading-relaxed">
        🏅 Le <span className="text-gold font-semibold">G.O.A.T</span> n'est pas forcément le n°1 ELO — c'est le joueur
        qui combine le meilleur <span className="text-text font-semibold">ELO</span>,
        le meilleur <span className="text-text font-semibold">win rate</span> et
        le plus de <span className="text-text font-semibold">titres</span> de tournois.
      </div>

      {!goat ? (
        <div className="text-center text-muted-2 py-12">
          Pas encore assez de données pour désigner un G.O.A.T.
        </div>
      ) : (
        <>
          <GoatHeroCard player={goat} isMe={goat.entry.login === me?.login} />

          <div className="mt-6">
            <div className="font-gaming text-[10px] uppercase tracking-[0.18em] text-gold/80 font-extrabold mb-2 flex items-center gap-2">
              <span className="inline-block w-1 h-2.5 bg-gradient-to-b from-gold to-gold-dim rounded-sm" />
              Les prétendants
            </div>
            <div className="space-y-1.5">
              {rest.map((p) => (
                <GoatRow key={p.entry.login} player={p} isMe={p.entry.login === me?.login} />
              ))}
            </div>
          </div>

          <p className="mt-5 text-[11px] text-muted-2 leading-relaxed">
            Le score agrège toutes les stats positives, pondérées (du plus lourd au plus léger) :
            {GOAT_WEIGHTS.map((w, i) => (
              <span key={w.key}>
                {i === 0 ? ' ' : ' · '}
                <span className="text-text">{w.label}</span> ({Math.round(w.weight * 100)}%)
              </span>
            ))}
            . Les joueurs à très faible volume de matchs sont amortis.
          </p>
        </>
      )}
    </Panel>
  );
}

// ─── Grosse case du G.O.A.T ───────────────────────────────────────────────────
function GoatHeroCard({ player, isMe }: { player: GoatPlayer; isMe: boolean }) {
  const { entry, metrics } = player;
  return (
    <div className="relative rounded-2xl border-2 border-gold/50 bg-gradient-to-b from-gold/[0.08] to-transparent p-5 sm:p-6 overflow-hidden">
      <div className="absolute -right-6 -top-6 opacity-[0.07] pointer-events-none">
        <Crown className="w-40 h-40 text-gold" fill="currentColor" strokeWidth={1} />
      </div>

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="relative shrink-0 mx-auto sm:mx-0">
          <Avatar
            login={entry.login}
            imageUrl={entry.imageUrl}
            size="xl"
            className="ring-2 ring-gold ring-offset-2 ring-offset-bg-1 shadow-gold-glow"
          />
          <Crown
            className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 text-gold drop-shadow-[0_2px_6px_rgba(255,201,74,0.7)]"
            fill="currentColor"
            strokeWidth={1.5}
          />
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-gold mb-0.5">
            🐐 Le G.O.A.T {isMe && '· toi'}
          </div>
          <PlayerLink login={entry.login} className="inline-flex">
            <span className="font-display text-2xl sm:text-3xl font-black text-text-strong leading-none">
              {displayName(entry)}
            </span>
          </PlayerLink>
          <div className="text-xs text-muted-2 mt-1">
            @{entry.login} · #{entry.rank} ELO
          </div>
        </div>

        <div className="text-center shrink-0">
          <div className="font-display text-4xl sm:text-5xl font-black gradient-text-brand tabular-nums leading-none">
            {player.score}
          </div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-2 font-bold mt-1">
            Score GOAT
          </div>
        </div>
      </div>

      {/* Détail complet des stats du GOAT */}
      <div className="relative mt-5 pt-5 border-t border-gold/15">
        <StatGrid metrics={metrics} />
        <div className="mt-4">
          <MetricBars player={player} />
        </div>
      </div>
    </div>
  );
}

// ─── Ligne « prétendant » repliée, dépliable via « voir plus » ────────────────
function GoatRow({ player, isMe }: { player: GoatPlayer; isMe: boolean }) {
  const [open, setOpen] = useState(false);
  const { entry, metrics } = player;
  return (
    <div
      className={`rounded-xl border transition-colors ${
        isMe ? 'border-gold/40 bg-gold/[0.05]' : 'border-border bg-bg-2/30'
      }`}
    >
      <div className="flex items-center gap-3 p-2.5">
        <span className="w-6 text-center font-display font-black tabular-nums text-muted-2">
          {player.rank}
        </span>
        <PlayerLink login={entry.login} className="flex items-center gap-2.5 min-w-0 flex-1">
          <Avatar login={entry.login} imageUrl={entry.imageUrl} size="sm" />
          <div className="min-w-0">
            <div className="font-semibold text-text-strong truncate leading-tight">
              {displayName(entry)}
            </div>
            <div className="text-[10px] text-muted-2 truncate">
              @{entry.login} · {metrics.elo} ELO
            </div>
          </div>
        </PlayerLink>

        {/* Aperçu compact : coupes officielles si présentes */}
        {metrics.officialTitles > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red">
            <TournamentCup accent={OFFICIAL_CUP} className="w-4 h-4" />
            {metrics.officialTitles}
          </span>
        )}

        <div className="text-right shrink-0">
          <div className="font-display text-lg font-black text-gold tabular-nums leading-none">
            {player.score}
          </div>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="ml-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-2 hover:text-gold transition-colors"
          aria-expanded={open}
        >
          {open ? 'Réduire' : 'Voir plus'}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2.5} />
        </button>
      </div>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-border/40">
          <StatGrid metrics={metrics} />
          <div className="mt-3">
            <MetricBars player={player} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Grille des stats brutes ──────────────────────────────────────────────────
function StatGrid({ metrics }: { metrics: GoatPlayer['metrics'] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <StatBox label="ELO" value={String(metrics.elo)} tone="gold" />
      <StatBox
        label="Tournois officiels"
        value={String(metrics.officialTitles)}
        cup={OFFICIAL_CUP}
        tone="red"
      />
      <StatBox
        label="Tournois amicaux"
        value={String(metrics.friendlyTitles)}
        cup={FRIENDLY_CUP}
      />
      <StatBox
        label="Goal average"
        value={metrics.goalDiffPerGame >= 0 ? `+${metrics.goalDiffPerGame.toFixed(1)}` : metrics.goalDiffPerGame.toFixed(1)}
      />
      <StatBox label="Écart moy. en V" value={`+${metrics.avgWinMargin.toFixed(1)}`} />
      <StatBox
        label="Série V max"
        value={metrics.maxWinStreak >= 2 ? String(metrics.maxWinStreak) : '—'}
        icon={metrics.maxWinStreak >= 2}
      />
      <StatBox label="Win rate" value={`${metrics.winRate}%`} />
      <StatBox label="Matchs" value={`${metrics.wins}V – ${metrics.losses}D`} />
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
  cup,
  icon,
}: {
  label: string;
  value: string;
  tone?: 'gold' | 'red';
  cup?: string;
  icon?: boolean;
}) {
  const valCls = tone === 'gold' ? 'text-gold' : tone === 'red' ? 'text-red' : 'text-text-strong';
  return (
    <div className="rounded-lg border border-border/60 bg-bg-1/40 px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-2 font-bold mb-0.5 truncate">
        {label}
      </div>
      <div className={`flex items-center gap-1 font-display font-extrabold tabular-nums ${valCls}`}>
        {cup && <TournamentCup accent={cup} className="w-4 h-4 shrink-0" />}
        {icon && <Flame className="w-3.5 h-3.5 text-[#ff8c3a]" fill="currentColor" strokeWidth={2} />}
        {value}
      </div>
    </div>
  );
}

// ─── Barres de contribution par métrique ──────────────────────────────────────
function MetricBars({ player }: { player: GoatPlayer }) {
  return (
    <div className="space-y-1.5">
      {GOAT_WEIGHTS.map((w) => {
        const n = player.norm[w.key as GoatMetricKey];
        const pct = Math.round(n * 100);
        return (
          <div key={w.key} className="flex items-center gap-2">
            <span className="w-32 shrink-0 text-[10px] uppercase tracking-wider text-muted-2 font-semibold truncate">
              {w.label}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-bg-1 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold/60 to-gold"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-12 text-right text-[10px] font-mono tabular-nums text-muted-2">
              {Math.round(w.weight * 100)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
