import { motion } from 'framer-motion';
import { Avatar } from '../Avatar';
import { PanelTitle } from './LivePanel';
import type { LiveTournament, TournamentMatch } from '../../lib/api';
import { avatarMap, teamLabelOf } from '../../lib/liveTournament';

// Colonne droite (haut) — « PROCHAINS DUELS » : affiches à venir avec jauge de HYPE
// (mises sur les participants, repli proximité ELO).
export function UpcomingDuels({
  duels,
  tournament,
  hypes,
}: {
  duels: TournamentMatch[];
  tournament: LiveTournament;
  hypes: Map<string, number>;
}) {
  const entries = tournament.entries ?? [];
  const avatars = avatarMap(entries);
  return (
    <section className="flex flex-col min-h-0 flex-1 rounded-xl border border-border/60 bg-bg-1/70 overflow-hidden">
      <PanelTitle>Prochains duels</PanelTitle>
      {duels.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[1.5vh] text-muted-2 px-4 text-center">
          Aucune affiche programmée.
        </div>
      ) : (
        <div className="flex flex-col gap-[0.6vh] px-[0.8vw] pb-[1vh] min-h-0 flex-1">
          {duels.map((m) => {
            const hype = Math.round((hypes.get(m.id) ?? 0) * 100);
            return (
              <motion.div
                layout
                key={m.id}
                className="rounded-lg bg-bg-2/50 border border-border/40 px-[0.7vw] py-[0.6vh]"
              >
                <div className="flex items-center justify-between gap-[0.5vw]">
                  <DuelSide login={m.playerALogin} img={avatars.get(m.playerALogin ?? '') ?? null} entries={entries} align="left" />
                  <span className="text-[1.3vh] font-display font-black text-muted-2 shrink-0">VS</span>
                  <DuelSide login={m.playerBLogin} img={avatars.get(m.playerBLogin ?? '') ?? null} entries={entries} align="right" />
                </div>
                <div className="mt-[0.5vh] flex items-center gap-[0.5vw]">
                  <span className="text-[1.1vh] uppercase tracking-wider text-gold/80 font-bold shrink-0">Hype</span>
                  <div className="flex-1 h-[0.9vh] rounded-full bg-bg-3/80 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-gold-deep via-gold to-gold"
                      animate={{ width: `${Math.max(4, hype)}%` }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                    />
                  </div>
                  <span className="text-[1.2vh] font-mono text-gold tabular-nums w-[3ch] text-right shrink-0">{hype}%</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DuelSide({
  login,
  img,
  entries,
  align,
}: {
  login: string | null;
  img: string | null;
  entries: LiveTournament['entries'];
  align: 'left' | 'right';
}) {
  return (
    <div className={`flex items-center gap-[0.4vw] flex-1 min-w-0 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
      <Avatar login={login ?? '?'} imageUrl={img} size="sm" />
      <span className="text-[1.4vh] text-text truncate">{teamLabelOf(login, entries ?? [])}</span>
    </div>
  );
}
