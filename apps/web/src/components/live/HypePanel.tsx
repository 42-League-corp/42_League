import { motion } from 'framer-motion';
import { PanelTitle } from './LivePanel';
import type { LiveTournament } from '../../lib/api';
import { teamLabelOf, type TightMatch } from '../../lib/liveTournament';

// Colonne droite (bas) — encart « MATCHS SERRÉS » : met en avant le suspense (écarts
// de score ≤ 1 en cours, ou plus petits écarts d'ELO à venir).
export function HypePanel({
  tight,
  tournament,
}: {
  tight: TightMatch[];
  tournament: LiveTournament;
}) {
  const entries = tournament.entries ?? [];
  return (
    <section className="flex flex-col min-h-0 rounded-xl border border-red/30 bg-gradient-to-b from-red/[0.06] to-bg-1/70 overflow-hidden shrink-0">
      <PanelTitle>🔥 Matchs serrés</PanelTitle>
      {tight.length === 0 ? (
        <div className="px-[0.8vw] pb-[1vh] text-[1.4vh] text-muted-2">Rien de bouillant… pour l'instant.</div>
      ) : (
        <div className="flex flex-col gap-[0.5vh] px-[0.8vw] pb-[1vh]">
          {tight.map((x) => (
            <motion.div
              layout
              key={x.match.id}
              className="flex items-center justify-between gap-[0.5vw] rounded-lg bg-bg-2/40 border border-border/40 px-[0.7vw] py-[0.5vh]"
            >
              <span className="text-[1.4vh] text-text truncate min-w-0">
                {teamLabelOf(x.match.playerALogin, entries)}
                <span className="text-muted-2 mx-[0.3vw]">vs</span>
                {teamLabelOf(x.match.playerBLogin, entries)}
              </span>
              {x.kind === 'liveClose' ? (
                <span className="shrink-0 text-[1.3vh] font-display font-black text-red whitespace-nowrap">
                  {x.match.scoreA}–{x.match.scoreB} 🔥
                </span>
              ) : (
                <span className="shrink-0 text-[1.2vh] font-mono text-gold/90 whitespace-nowrap">
                  ΔELO {x.gap}
                </span>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
