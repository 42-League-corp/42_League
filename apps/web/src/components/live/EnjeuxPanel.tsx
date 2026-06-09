import { motion } from 'framer-motion';
import { tournamentEloMax, tournamentEloReward } from '@42-league/shared';
import { Avatar } from '../Avatar';
import { Sparkline } from './Sparkline';
import { PanelTitle } from './LivePanel';
import type { LiveTournament, TournamentMatch } from '../../lib/api';
import type { Standing } from '../../lib/tournamentStandings';
import { formOf } from '../../lib/tournamentStandings';
import { avatarMap, eloMap, partnerOf } from '../../lib/liveTournament';

// Colonne gauche — classement au goal average AVEC la colonne « ENJEU » (comme la
// section « Phase de ligue · classement au goal average » de la page de contrôle).
// Remplace l'ancien podium. Les places qualifiables sont surlignées et l'enjeu de
// chaque rang (bonus ELO + cash-prize du champion) est affiché en temps réel.

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
  const entries = tournament.entries ?? [];
  const avatars = avatarMap(entries);
  const elos = eloMap(entries);
  const is2v2 = tournament.mode === '2v2';
  const gameLabel = GAME_LABEL[tournament.game ?? 'babyfoot'] ?? '';
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

  return (
    <section className="flex flex-col min-h-0 h-full rounded-xl border border-border/60 bg-bg-1/70 shadow-rivet overflow-hidden">
      <PanelTitle>
        Classement &amp; enjeux <span className="text-muted-2 font-normal">({gameLabel})</span>
      </PanelTitle>
      <div className="px-[1vw] -mt-[0.6vh] mb-[0.4vh] text-[1.1vh] uppercase tracking-[0.16em] text-gold/70 font-mono shrink-0">
        Goal average · top {highlightQualify} qualifié{highlightQualify > 1 ? 's' : ''}
      </div>

      {standings.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[1.6vh] text-muted-2 px-4 text-center">
          En attente des premiers résultats…
        </div>
      ) : (
        <div className="flex flex-col min-h-0 flex-1 px-[0.6vw] pb-[1vh]">
          {/* En-tête de colonnes */}
          <div className="flex items-center gap-[0.5vw] px-[0.5vw] pb-[0.4vh] text-[1.1vh] uppercase tracking-wide text-muted-2 font-semibold shrink-0">
            <span className="w-[1.6vw] text-center">#</span>
            <span className="flex-1">{is2v2 ? 'Équipe' : 'Joueur'}</span>
            <span className="w-[2vw] text-center">J</span>
            <span className="w-[2vw] text-center">V</span>
            <span className="w-[2.4vw] text-center">Diff</span>
            <span className="w-[5.5vw] text-right pr-[0.3vw]">Enjeu</span>
          </div>

          <div className="flex flex-col gap-[0.4vh] min-h-0 flex-1">
            {rows.map((s, i) => {
              const qualified = i < highlightQualify;
              const champion = i === 0;
              const partner = is2v2 ? partnerOf(s.login, entries) : null;
              return (
                <motion.div
                  layout
                  key={s.login}
                  className={`flex items-center gap-[0.5vw] rounded-lg px-[0.5vw] py-[0.45vh] border ${
                    champion
                      ? 'border-gold/50 bg-gold/[0.10]'
                      : qualified
                        ? 'border-teal/30 bg-teal/[0.06]'
                        : 'border-border/40 bg-bg-2/40'
                  }`}
                >
                  <span
                    className={`w-[1.6vw] text-center font-display font-black text-[1.7vh] ${
                      champion ? 'text-gold' : qualified ? 'text-teal' : 'text-muted-2'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="flex items-center gap-[0.4vw] flex-1 min-w-0">
                    <Avatar login={s.login} imageUrl={avatars.get(s.login) ?? null} size="sm" />
                    <div className="flex flex-col min-w-0 leading-tight">
                      <span className="text-[1.5vh] text-text-strong font-semibold truncate">{s.login}</span>
                      {partner && <span className="text-[1.05vh] text-muted-2 truncate">&amp; {partner}</span>}
                    </div>
                  </div>
                  <span className="w-[2vw] text-center text-[1.4vh] tabular-nums text-muted-2">{s.played}</span>
                  <span className="w-[2vw] text-center text-[1.5vh] tabular-nums font-bold text-text">{s.wins}</span>
                  <span
                    className={`w-[2.4vw] text-center text-[1.4vh] tabular-nums ${
                      s.diff > 0 ? 'text-[#7fd66e]' : s.diff < 0 ? 'text-red' : 'text-muted-2'
                    }`}
                  >
                    {s.diff > 0 ? `+${s.diff}` : s.diff}
                  </span>
                  <span className="w-[5.5vw] text-right pr-[0.3vw] whitespace-nowrap">
                    {champion ? (
                      <span className="text-[1.2vh] font-bold text-gold" title={championPrize ?? undefined}>
                        🏆 +{eloMax}
                      </span>
                    ) : qualified ? (
                      <span className="text-[1.2vh] font-semibold text-teal">+{securedQualElo}</span>
                    ) : (
                      <span className="text-[1.4vh] text-steel-dark">
                        <Sparkline form={formOf(s.login, matches)} />
                      </span>
                    )}
                  </span>
                  {/* ELO discret en bout de ligne pour les qualifiés (l'enjeu prend la place) */}
                  {qualified && (
                    <span className="hidden 2xl:inline text-[1.1vh] font-mono text-muted-2 tabular-nums">
                      {elos.get(s.login) ?? ''}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>

          {championPrize && (
            <div className="mt-[0.5vh] text-center text-[1.2vh] text-gold/80 shrink-0">
              🏆 Champion : <span className="font-bold">{championPrize}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
