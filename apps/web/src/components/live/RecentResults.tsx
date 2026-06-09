import { motion } from 'framer-motion';
import { Avatar } from '../Avatar';
import { PanelTitle } from './StandingsPanel';
import type { LiveTournament, TournamentMatch } from '../../lib/api';
import { avatarMap } from '../../lib/liveTournament';

// Centre bas (phase ligue) — fil des derniers résultats confirmés.
export function RecentResults({
  matches,
  tournament,
}: {
  matches: TournamentMatch[];
  tournament: LiveTournament;
}) {
  const avatars = avatarMap(tournament.entries ?? []);
  return (
    <section className="flex flex-col min-h-0 h-full rounded-xl border border-border/60 bg-bg-1/70 overflow-hidden">
      <PanelTitle>Derniers résultats</PanelTitle>
      {matches.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[1.5vh] text-muted-2">
          Aucun match terminé pour l'instant.
        </div>
      ) : (
        <div className="flex flex-col gap-[0.5vh] px-[1vw] pb-[1vh] min-h-0 flex-1">
          {matches.map((m) => {
            const aWin = m.winnerLogin === m.playerALogin;
            return (
              <motion.div
                layout
                key={m.id}
                className="flex items-center gap-[0.6vw] rounded-lg bg-bg-2/50 border border-border/40 px-[0.8vw] py-[0.5vh]"
              >
                <Side login={m.playerALogin} img={avatars.get(m.playerALogin ?? '') ?? null} win={aWin} align="left" />
                <div className="flex items-center gap-[0.5vw] font-display font-black tabular-nums text-[2.2vh] shrink-0">
                  <span className={aWin ? 'text-gold' : 'text-muted-2'}>{m.scoreA ?? '–'}</span>
                  <span className="text-muted-2 text-[1.4vh]">:</span>
                  <span className={!aWin ? 'text-gold' : 'text-muted-2'}>{m.scoreB ?? '–'}</span>
                </div>
                <Side login={m.playerBLogin} img={avatars.get(m.playerBLogin ?? '') ?? null} win={!aWin} align="right" />
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Side({
  login,
  img,
  win,
  align,
}: {
  login: string | null;
  img: string | null;
  win: boolean;
  align: 'left' | 'right';
}) {
  return (
    <div className={`flex items-center gap-[0.5vw] flex-1 min-w-0 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
      <Avatar login={login ?? '?'} imageUrl={img} size="sm" grayscale={!win} />
      <span className={`text-[1.6vh] truncate ${win ? 'text-text-strong font-bold' : 'text-muted-2'}`}>
        {login ?? '?'}
      </span>
    </div>
  );
}
