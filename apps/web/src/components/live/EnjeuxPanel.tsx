import { motion } from 'framer-motion';
import { tournamentEloMax, tournamentEloReward } from '@42-league/shared';
import { Avatar } from '../Avatar';
import { Sparkline } from './Sparkline';
import { PanelTitle } from './LivePanel';
import type { LiveTournament, TournamentMatch } from '../../lib/api';
import { type Standing, formOf, poolStandings } from '../../lib/tournamentStandings';
import { avatarMap, teamEloMap, partnerOf } from '../../lib/liveTournament';

// ─────────────────────────────────────────────────────────────────────────────
// Colonne gauche — « Classement & enjeux ». Refonte pour être lisible d'un coup
// d'œil sur une TV : plus de colonnes cryptiques (« J » / « V »). Chaque ligne
// porte sa mini-fiche (ELO · matchs joués · victoires · défaites) en clair, le
// critère de classement (la DIFFÉRENCE de buts) est mis en avant, la forme récente
// est dessinée, et la colonne « enjeu » dit ce que chaque place rapporte ou ce qu'il
// reste à faire pour se qualifier. Une LIGNE DE QUALIFICATION sépare visuellement les
// qualifiés du reste. Gère 1v1, 2v2, ligue ET poules.
// ─────────────────────────────────────────────────────────────────────────────

const GREEN = '#7fd66e';

const GAME_LABEL: Record<string, string> = {
  babyfoot: 'BABYFOOT',
  smash: 'SMASH',
  chess: 'ÉCHECS',
  streetfighter: 'STREET FIGHTER',
  flechettes: 'FLÉCHETTES',
};

function largestPow2AtMost(n: number): number {
  let p = 2;
  while (p * 2 <= n) p *= 2;
  return p;
}

export function EnjeuxPanel({
  standings,
  tournament,
  matches,
}: {
  standings: Standing[];
  tournament: LiveTournament;
  matches: TournamentMatch[];
}) {
  const gameLabel = GAME_LABEL[tournament.game ?? 'babyfoot'] ?? '';
  const isPools = tournament.format === 'pools';
  const pools = isPools ? poolStandings(matches) : [];
  const hasPoolData = pools.some((p) => p.standings.length > 0);

  return (
    <section className="flex flex-col min-h-0 h-full rounded-xl border border-border/60 bg-bg-1/70 shadow-rivet overflow-hidden">
      <PanelTitle>
        Classement &amp; enjeux <span className="text-muted-2 font-normal">({gameLabel})</span>
      </PanelTitle>

      {isPools && hasPoolData ? (
        <PoolsView pools={pools} tournament={tournament} matches={matches} />
      ) : (
        <LeagueView standings={standings} tournament={tournament} matches={matches} />
      )}
    </section>
  );
}

// ── Vue LIGUE / ÉLIMINATION (classement unique au goal average) ────────────────

function LeagueView({
  standings,
  tournament,
  matches,
}: {
  standings: Standing[];
  tournament: LiveTournament;
  matches: TournamentMatch[];
}) {
  const entries = tournament.entries ?? [];
  const avatars = avatarMap(entries);
  const elos = teamEloMap(entries);
  const is2v2 = tournament.mode === '2v2';
  const rows = standings.slice(0, 12);

  // Enjeux (miroir de la page de contrôle).
  const eloMax = tournamentEloMax(tournament.kind);
  const effectiveQualify = Math.min(
    64,
    Math.max(2, tournament.leagueQualifyCount ?? largestPow2AtMost(standings.length || 2)),
  );
  const highlightQualify = Math.min(effectiveQualify, standings.length);
  const projectedRounds = Math.max(1, Math.round(Math.log2(effectiveQualify)));
  const securedQualElo = tournamentEloReward({
    format: 'league',
    qualified: true,
    bracketRoundsWon: 0,
    totalBracketRounds: projectedRounds,
    max: eloMax,
  });
  const championPrize =
    tournament.kind === 'official' && tournament.prizeKind && tournament.prizeKind !== 'none'
      ? tournament.prizeKind === 'coins'
        ? `${tournament.prizeCoins ?? 0} 🪙`
        : (tournament.prizeItem?.name ?? 'cosmétique')
      : null;

  // Diff du dernier qualifié → « écart à rattraper » des places suivantes.
  const cutoffDiff = standings[highlightQualify - 1]?.diff ?? 0;

  if (standings.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[1.6vh] text-muted-2 px-4 text-center">
        En attente des premiers résultats…
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1 px-[0.6vw] pb-[0.8vh]">
      {/* Bandeau d'aide : critère de classement + zone de qualification. */}
      <div className="flex items-center justify-between px-[0.5vw] mb-[0.5vh] shrink-0">
        <span className="text-[1.05vh] uppercase tracking-[0.14em] text-gold/70 font-mono">
          Classé au goal&nbsp;average
        </span>
        <span className="text-[1.05vh] text-teal font-semibold uppercase tracking-[0.1em]">
          ● Top {highlightQualify} qualifié{highlightQualify > 1 ? 's' : ''}
        </span>
      </div>

      {/* En-tête de colonnes — libellés clairs (plus de lettres seules). */}
      <div className="flex items-center gap-[0.5vw] px-[0.5vw] pb-[0.3vh] text-[1.0vh] uppercase tracking-wide text-muted-2 font-semibold shrink-0">
        <span className="w-[1.8vw] text-center">#</span>
        <span className="flex-1">{is2v2 ? 'Équipe' : 'Joueur'}</span>
        <span className="w-[3vw] text-center" title="Différence de buts — critère de classement">Diff</span>
        <span className="w-[4.5vw] text-center">Forme</span>
        <span className="w-[5.2vw] text-right pr-[0.3vw]">Enjeu</span>
      </div>

      <div className="flex flex-col gap-[0.4vh] min-h-0 flex-1 overflow-hidden">
        {rows.map((s, i) => {
          const qualified = i < highlightQualify;
          const justOut = !qualified && i === highlightQualify; // 1er non-qualifié
          const gap = Math.max(0, cutoffDiff - s.diff);
          return (
            <div key={`row-${s.login}`}>
              {/* Ligne de qualification, juste avant le 1er non-qualifié. */}
              {justOut && highlightQualify < rows.length && (
                <div className="flex items-center gap-[0.5vw] my-[0.3vh] px-[0.5vw] select-none">
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent via-teal/50 to-teal/50" />
                  <span className="text-[0.95vh] uppercase tracking-[0.18em] text-teal/80 font-bold whitespace-nowrap">
                    Ligne de qualification
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-l from-transparent via-teal/50 to-teal/50" />
                </div>
              )}
              <StandingRow
                s={s}
                rank={i + 1}
                champion={i === 0}
                qualified={qualified}
                elo={elos.get(s.login)}
                avatarUrl={avatars.get(s.login) ?? null}
                partner={is2v2 ? partnerOf(s.login, entries) : null}
                form={formOf(s.login, matches)}
                enjeu={
                  i === 0
                    ? { tone: 'champion', main: `🏆 +${eloMax}`, title: championPrize ?? undefined }
                    : qualified
                      ? { tone: 'qualified', main: `+${securedQualElo}` }
                      : gap > 0
                        ? { tone: 'gap', main: `−${gap}`, sub: 'à la qualif' }
                        : { tone: 'gap', main: 'coude à coude' }
                }
              />
            </div>
          );
        })}
      </div>

      {championPrize && (
        <div className="mt-[0.4vh] text-center text-[1.15vh] text-gold/80 shrink-0">
          🏆 Champion remporte : <span className="font-bold">{championPrize}</span>
        </div>
      )}
    </div>
  );
}

// ── Vue POULES (un mini-classement par poule) ──────────────────────────────────

function PoolsView({
  pools,
  tournament,
  matches,
}: {
  pools: ReturnType<typeof poolStandings>;
  tournament: LiveTournament;
  matches: TournamentMatch[];
}) {
  const entries = tournament.entries ?? [];
  const avatars = avatarMap(entries);
  const elos = teamEloMap(entries);
  const is2v2 = tournament.mode === '2v2';
  // Combien se qualifient par poule (les 2 premiers par défaut, borné à la taille).
  const qualPerPool = 2;

  return (
    <div className="flex flex-col min-h-0 flex-1 px-[0.6vw] pb-[0.8vh] gap-[0.6vh] overflow-hidden">
      <div className="px-[0.5vw] text-[1.05vh] uppercase tracking-[0.14em] text-gold/70 font-mono shrink-0">
        Phase de poules · top {qualPerPool} qualifié{qualPerPool > 1 ? 's' : ''} par poule
      </div>
      <div className="flex flex-col gap-[0.7vh] min-h-0 flex-1 overflow-hidden">
        {pools.map(({ poolIndex, standings }) => (
          <div key={poolIndex} className="flex flex-col min-h-0">
            <div className="flex items-center gap-[0.4vw] px-[0.5vw] mb-[0.3vh] shrink-0">
              <span className="text-[1.2vh] font-gaming font-bold uppercase tracking-wider text-text-strong">
                Poule {poolIndex + 1}
              </span>
              <span className="h-px flex-1 bg-border/50" />
            </div>
            <div className="flex flex-col gap-[0.3vh]">
              {standings.slice(0, 6).map((s, i) => {
                // On qualifie les `qualPerPool` premiers, jamais le dernier d'une poule
                // (sinon « tout le monde qualifié » dans une poule de 2).
                const qualified = i < qualPerPool && i < standings.length - 1;
                return (
                  <StandingRow
                    key={s.login}
                    s={s}
                    rank={i + 1}
                    champion={false}
                    qualified={qualified}
                    elo={elos.get(s.login)}
                    avatarUrl={avatars.get(s.login) ?? null}
                    partner={is2v2 ? partnerOf(s.login, entries) : null}
                    form={formOf(s.login, matches)}
                    compact
                    enjeu={qualified ? { tone: 'qualified', main: 'Qualifié' } : { tone: 'gap', main: '' }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Ligne de classement partagée ───────────────────────────────────────────────

type Enjeu = {
  tone: 'champion' | 'qualified' | 'gap';
  main: string;
  sub?: string;
  title?: string;
};

function StandingRow({
  s,
  rank,
  champion,
  qualified,
  elo,
  avatarUrl,
  partner,
  form,
  enjeu,
  compact = false,
}: {
  s: Standing;
  rank: number;
  champion: boolean;
  qualified: boolean;
  elo: number | undefined;
  avatarUrl: string | null;
  partner: string | null;
  form: Array<'W' | 'L' | 'D'>;
  enjeu: Enjeu;
  compact?: boolean;
}) {
  const losses = Math.max(0, s.played - s.wins);
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  return (
    <motion.div
      layout
      className={`flex items-center gap-[0.5vw] rounded-lg px-[0.5vw] py-[0.4vh] border ${
        champion
          ? 'border-gold/50 bg-gold/[0.10] shadow-[inset_0_0_18px_rgba(255,201,74,0.08)]'
          : qualified
            ? 'border-teal/30 bg-teal/[0.06]'
            : 'border-border/40 bg-bg-2/40'
      }`}
    >
      {/* Rang (médaille pour le podium) */}
      <span
        className={`w-[1.8vw] text-center font-display font-black tabular-nums leading-none ${
          medal ? 'text-[1.9vh]' : champion ? 'text-gold text-[1.7vh]' : qualified ? 'text-teal text-[1.6vh]' : 'text-muted-2 text-[1.6vh]'
        }`}
      >
        {medal ?? rank}
      </span>

      {/* Joueur / équipe + mini-fiche en clair */}
      <div className="flex items-center gap-[0.4vw] flex-1 min-w-0">
        <Avatar login={s.login} imageUrl={avatarUrl} size="sm" />
        <div className="flex flex-col min-w-0 leading-tight">
          <span className="text-[1.5vh] text-text-strong font-semibold truncate">
            {s.login}
            {partner && <span className="text-muted-2 font-normal"> &amp; {partner}</span>}
          </span>
          {!compact && (
            <span className="text-[1.0vh] text-muted-2 truncate tabular-nums">
              {elo != null && <span className="text-gold/80 font-mono">{elo}</span>}
              {elo != null && <span className="mx-[0.25vw]">·</span>}
              {s.played} J
              <span className="mx-[0.25vw]">·</span>
              <span style={{ color: GREEN }}>{s.wins} V</span>
              <span className="mx-[0.25vw]">·</span>
              <span className="text-red/80">{losses} D</span>
            </span>
          )}
        </div>
      </div>

      {/* Différence de buts — le critère de classement, mis en avant */}
      <span
        className={`w-[3vw] text-center font-display font-black tabular-nums text-[1.9vh] leading-none ${
          s.diff < 0 ? 'text-red' : s.diff === 0 ? 'text-muted-2' : ''
        }`}
        style={s.diff > 0 ? { color: GREEN } : undefined}
      >
        {s.diff > 0 ? `+${s.diff}` : s.diff}
      </span>

      {/* Forme récente */}
      {!compact ? (
        <span className="w-[4.5vw] flex justify-center">
          <Sparkline form={form} />
        </span>
      ) : null}

      {/* Enjeu */}
      <span className={`${compact ? 'w-auto' : 'w-[5.2vw]'} text-right pr-[0.3vw] whitespace-nowrap`}>
        <EnjeuChip enjeu={enjeu} />
      </span>
    </motion.div>
  );
}

function EnjeuChip({ enjeu }: { enjeu: Enjeu }) {
  if (!enjeu.main) return <span className="text-[1.1vh] text-muted-2">—</span>;
  if (enjeu.tone === 'champion') {
    return (
      <span
        className="inline-block text-[1.2vh] font-bold text-gold drop-shadow-[0_0_8px_rgba(255,201,74,0.4)]"
        title={enjeu.title}
      >
        {enjeu.main}
      </span>
    );
  }
  if (enjeu.tone === 'qualified') {
    return <span className="text-[1.2vh] font-semibold text-teal">{enjeu.main}</span>;
  }
  // gap
  return (
    <span className="inline-flex flex-col items-end leading-none">
      <span className="text-[1.2vh] font-mono font-semibold text-muted-2">{enjeu.main}</span>
      {enjeu.sub && <span className="text-[0.85vh] uppercase tracking-wide text-muted-2/70">{enjeu.sub}</span>}
    </span>
  );
}
