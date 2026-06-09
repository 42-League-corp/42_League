import { motion } from 'framer-motion';
import { Avatar } from '../Avatar';
import { PanelTitle } from './StandingsPanel';
import type { LiveTournament, TournamentMatch } from '../../lib/api';
import { avatarMap } from '../../lib/liveTournament';

// Centre (phase finale) — arbre compact en lecture seule, dimensionné pour tenir sans
// scroll. Colonnes par tour, réparties verticalement ; le « match en cours » est
// surligné. La math des connecteurs de BracketTree est volontairement simplifiée ici
// (répartition flex) pour rester lisible sur une TV.

function roundLabel(round: number, rounds: number): string {
  const fromEnd = rounds - round;
  if (fromEnd === 0) return 'Finale';
  if (fromEnd === 1) return 'Demies';
  if (fromEnd === 2) return 'Quarts';
  return `Tour ${round}`;
}

export function LiveBracket({
  matches,
  rounds,
  tournament,
  activeMatchId,
}: {
  matches: TournamentMatch[];
  rounds: number;
  tournament: LiveTournament;
  activeMatchId?: string | null;
}) {
  const avatars = avatarMap(tournament.entries ?? []);
  const byRound = new Map<number, TournamentMatch[]>();
  for (const m of matches) {
    const arr = byRound.get(m.round) ?? [];
    arr.push(m);
    byRound.set(m.round, arr);
  }
  for (const arr of byRound.values()) arr.sort((a, b) => a.slot - b.slot);

  return (
    <section className="flex flex-col min-h-0 h-full rounded-xl border border-border/60 bg-bg-1/70 overflow-hidden">
      <PanelTitle>Tableau final</PanelTitle>
      <div className="flex-1 flex items-stretch gap-[1vw] px-[1vw] pb-[1.2vh] min-h-0">
        {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => {
          const arr = byRound.get(round) ?? [];
          return (
            <div key={round} className="flex-1 flex flex-col min-w-0">
              <div className="text-center text-[1.2vh] uppercase tracking-[0.16em] text-muted font-bold mb-[0.6vh] shrink-0">
                {roundLabel(round, rounds)}
              </div>
              <div className="flex-1 flex flex-col justify-around gap-[0.5vh] min-h-0">
                {arr.map((m) => (
                  <BracketCard
                    key={m.id}
                    match={m}
                    avatars={avatars}
                    active={activeMatchId === m.id}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BracketCard({
  match,
  avatars,
  active,
}: {
  match: TournamentMatch;
  avatars: Map<string, string | null>;
  active: boolean;
}) {
  const done = !!match.confirmedAt;
  return (
    <motion.div
      layout
      className={`rounded-lg border overflow-hidden bg-bg-2/50 ${
        active ? 'border-gold' : done ? 'border-teal/40' : 'border-border/50'
      }`}
      animate={
        active
          ? { boxShadow: ['0 0 0 0 rgba(255,201,74,0)', '0 0 14px 2px rgba(255,201,74,0.5)', '0 0 0 0 rgba(255,201,74,0)'] }
          : { boxShadow: '0 0 0 0 rgba(255,201,74,0)' }
      }
      transition={active ? { duration: 1.6, repeat: Infinity } : { duration: 0.2 }}
    >
      <BracketRow
        login={match.playerALogin}
        img={avatars.get(match.playerALogin ?? '') ?? null}
        score={match.scoreA}
        winner={!!match.winnerLogin && match.winnerLogin === match.playerALogin}
        loser={done && match.winnerLogin !== match.playerALogin}
      />
      <div className="h-px bg-border/40" />
      <BracketRow
        login={match.playerBLogin}
        img={avatars.get(match.playerBLogin ?? '') ?? null}
        score={match.scoreB}
        winner={!!match.winnerLogin && match.winnerLogin === match.playerBLogin}
        loser={done && match.winnerLogin !== match.playerBLogin}
      />
    </motion.div>
  );
}

function BracketRow({
  login,
  img,
  score,
  winner,
  loser,
}: {
  login: string | null;
  img: string | null;
  score: number | null;
  winner: boolean;
  loser: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-[0.4vw] px-[0.5vw] py-[0.4vh] ${winner ? 'bg-gold/[0.08]' : ''} ${
        loser ? 'opacity-45' : ''
      }`}
    >
      {login ? (
        <Avatar login={login} imageUrl={img} size="xs" grayscale={loser} />
      ) : (
        <div className="w-6 h-6 rounded-full border border-dashed border-muted/40 shrink-0" />
      )}
      <span className={`text-[1.4vh] truncate flex-1 ${winner ? 'text-text-strong font-bold' : 'text-muted-2'}`}>
        {login ?? '—'}
      </span>
      <span className={`text-[1.4vh] font-mono tabular-nums shrink-0 ${winner ? 'text-gold font-bold' : 'text-muted-2'}`}>
        {score ?? '–'}
      </span>
    </div>
  );
}
