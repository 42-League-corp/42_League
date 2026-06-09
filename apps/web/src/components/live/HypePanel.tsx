import { motion } from 'framer-motion';
import { PanelTitle } from './LivePanel';
import type { LiveTournament } from '../../lib/api';
import { teamEloMap, teamLabelOf, pronostic, type TightMatch } from '../../lib/liveTournament';

// Colonne droite (bas) — « ÇA VA CHAUFFER » : le suspense du moment. Les matchs en
// cours dont l'écart de score est ≤ 1 (vrai frisson), puis les affiches à venir au
// pronostic le plus serré, avec un thermomètre de suspense clair.

export function HypePanel({
  tight,
  tournament,
}: {
  tight: TightMatch[];
  tournament: LiveTournament;
}) {
  const entries = tournament.entries ?? [];
  const elos = teamEloMap(entries);
  return (
    <section className="flex flex-col min-h-0 rounded-xl border border-red/30 bg-gradient-to-b from-red/[0.06] to-bg-1/70 overflow-hidden shrink-0">
      <PanelTitle>🔥 Ça va chauffer</PanelTitle>
      {tight.length === 0 ? (
        <div className="px-[0.8vw] pb-[1vh] text-[1.4vh] text-muted-2">Rien de bouillant… pour l'instant.</div>
      ) : (
        <div className="flex flex-col gap-[0.5vh] px-[0.8vw] pb-[1vh]">
          {tight.map((x) => {
            const eloA = elos.get(x.match.playerALogin ?? '');
            const eloB = elos.get(x.match.playerBLogin ?? '');
            const prono = pronostic(eloA, eloB);
            const heatPct = Math.round(prono.heat * 100);
            return (
              <motion.div
                layout
                key={x.match.id}
                className="rounded-lg bg-bg-2/40 border border-border/40 px-[0.7vw] py-[0.5vh]"
              >
                <div className="flex items-center justify-between gap-[0.5vw]">
                  <span className="text-[1.35vh] text-text truncate min-w-0">
                    {teamLabelOf(x.match.playerALogin, entries)}
                    <span className="text-muted-2 mx-[0.3vw]">vs</span>
                    {teamLabelOf(x.match.playerBLogin, entries)}
                  </span>
                  {x.kind === 'liveClose' ? (
                    <span className="shrink-0 text-[1.3vh] font-display font-black text-red whitespace-nowrap">
                      {x.match.scoreA}–{x.match.scoreB} 🔥
                    </span>
                  ) : (
                    <span className="shrink-0 text-[1.1vh] font-mono text-gold/90 whitespace-nowrap">
                      ΔELO {x.gap}
                    </span>
                  )}
                </div>
                {/* Thermomètre de suspense */}
                <div className="mt-[0.3vh] flex items-center gap-[0.5vw]">
                  <span className="text-[0.9vh] uppercase tracking-wide text-muted-2 shrink-0">
                    {x.kind === 'liveClose' ? 'En cours' : 'Suspense'}
                  </span>
                  <div className="flex-1 h-[0.55vh] rounded-full bg-bg-3/80 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-gold via-[#ff8a3a] to-red"
                      animate={{ width: `${x.kind === 'liveClose' ? 100 : Math.max(8, heatPct)}%` }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
