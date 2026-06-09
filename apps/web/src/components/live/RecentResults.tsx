import { motion } from 'framer-motion';
import { Avatar } from '../Avatar';
import { PanelTitle } from './LivePanel';
import type { LiveTournament, TournamentMatch } from '../../lib/api';
import { avatarMap, teamEloMap, marginInfo, upsetGap } from '../../lib/liveTournament';

// Centre bas (phase ligue) — fil des derniers résultats confirmés, enrichi : on lit
// d'un coup d'œil À QUEL POINT c'était serré (badge d'écart + barre de score) et si
// c'était une SURPRISE (le petit ELO qui renverse le favori).

const GREEN = '#7fd66e';

const MARGIN_TONE: Record<string, string> = {
  nailbiter: 'text-red border-red/50 bg-red/10',
  tight: 'text-gold border-gold/50 bg-gold/10',
  clear: 'text-muted-2 border-border/50 bg-bg-2/60',
  blowout: 'text-teal border-teal/40 bg-teal/10',
};

export function RecentResults({
  matches,
  tournament,
}: {
  matches: TournamentMatch[];
  tournament: LiveTournament;
}) {
  const avatars = avatarMap(tournament.entries ?? []);
  const elos = teamEloMap(tournament.entries ?? []);
  return (
    <section className="flex flex-col min-h-0 h-full rounded-xl border border-border/60 bg-bg-1/70 overflow-hidden">
      <PanelTitle>Derniers résultats</PanelTitle>
      {matches.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[1.5vh] text-muted-2">
          Aucun match terminé pour l'instant.
        </div>
      ) : (
        <div className="flex flex-col gap-[0.5vh] px-[1vw] pb-[1vh] min-h-0 flex-1 overflow-hidden">
          {matches.map((m) => {
            const aWin = m.winnerLogin === m.playerALogin;
            const margin = marginInfo(m);
            const upset = upsetGap(m, elos);
            const total = (m.scoreA ?? 0) + (m.scoreB ?? 0);
            const aShare = total > 0 ? Math.round(((m.scoreA ?? 0) / total) * 100) : 50;
            return (
              <motion.div
                layout
                key={m.id}
                className="rounded-lg bg-bg-2/50 border border-border/40 px-[0.8vw] py-[0.45vh]"
              >
                <div className="flex items-center gap-[0.6vw]">
                  <Side login={m.playerALogin} img={avatars.get(m.playerALogin ?? '') ?? null} win={aWin} align="left" />
                  <div className="flex items-center gap-[0.5vw] font-display font-black tabular-nums text-[2.1vh] shrink-0">
                    <span className={aWin ? 'text-gold' : 'text-muted-2'}>{m.scoreA ?? '–'}</span>
                    <span className="text-muted-2 text-[1.3vh]">:</span>
                    <span className={!aWin ? 'text-gold' : 'text-muted-2'}>{m.scoreB ?? '–'}</span>
                  </div>
                  <Side login={m.playerBLogin} img={avatars.get(m.playerBLogin ?? '') ?? null} win={!aWin} align="right" />
                </div>
                {/* Barre de partage du score + badges d'intensité */}
                <div className="mt-[0.35vh] flex items-center gap-[0.5vw]">
                  <div className="relative flex-1 h-[0.6vh] rounded-full overflow-hidden bg-bg-3/80">
                    <div
                      className="absolute inset-y-0 left-0"
                      style={{ width: `${aShare}%`, background: aWin ? '#ffc94a' : 'rgba(168,152,128,0.5)' }}
                    />
                    <div
                      className="absolute inset-y-0 right-0"
                      style={{ width: `${100 - aShare}%`, background: !aWin ? '#ffc94a' : 'rgba(168,152,128,0.5)' }}
                    />
                    <div className="absolute inset-y-0 left-1/2 w-px bg-bg-0/60" />
                  </div>
                  {upset != null && (
                    <span
                      className="shrink-0 text-[1.0vh] font-bold uppercase tracking-wide px-[0.4vw] py-[0.1vh] rounded border border-teal/50 text-teal bg-teal/10"
                      style={{ color: GREEN, borderColor: `${GREEN}80` }}
                      title={`Le moins coté de ${upset} pts ELO s'impose`}
                    >
                      ⚡ Surprise
                    </span>
                  )}
                  {margin && (
                    <span
                      className={`shrink-0 text-[1.0vh] font-bold uppercase tracking-wide px-[0.4vw] py-[0.1vh] rounded border ${MARGIN_TONE[margin.kind]}`}
                    >
                      {margin.label}
                    </span>
                  )}
                </div>
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
