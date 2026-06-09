import { motion } from 'framer-motion';
import { Avatar } from '../Avatar';
import { PanelTitle } from './LivePanel';
import type { LiveTournament, TournamentMatch } from '../../lib/api';
import { avatarMap, teamEloMap, teamLabelOf, pronostic } from '../../lib/liveTournament';

// Colonne droite (haut) — « PROCHAINS DUELS ». Chaque affiche montre le matchup et un
// badge de pronostic ELO (serré / équilibré / favori) pour savoir tout de suite si le
// duel s'annonce disputé. (Plus de barres : la hype est sur le match en cours.)
export function UpcomingDuels({
  duels,
  tournament,
}: {
  duels: TournamentMatch[];
  tournament: LiveTournament;
}) {
  const entries = tournament.entries ?? [];
  const avatars = avatarMap(entries);
  const elos = teamEloMap(entries);
  return (
    <section className="flex flex-col min-h-0 flex-1 rounded-xl border border-border/60 bg-bg-1/70 overflow-hidden">
      <PanelTitle>Prochains duels</PanelTitle>
      {duels.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[1.5vh] text-muted-2 px-4 text-center">
          Aucune affiche programmée.
        </div>
      ) : (
        <div className="flex flex-col gap-[0.6vh] px-[0.8vw] pb-[1vh] min-h-0 flex-1 overflow-hidden">
          {duels.map((m) => {
            const eloA = m.playerALogin ? elos.get(m.playerALogin) : undefined;
            const eloB = m.playerBLogin ? elos.get(m.playerBLogin) : undefined;
            const prono = pronostic(eloA, eloB);
            const badge =
              prono.tone === 'serre'
                ? { text: '🔥 SERRÉ', cls: 'text-red bg-red/10 border-red/40' }
                : prono.tone === 'equilibre'
                  ? { text: 'ÉQUILIBRÉ', cls: 'text-teal bg-teal/10 border-teal/40' }
                  : { text: 'FAVORI', cls: 'text-gold bg-gold/10 border-gold/40' };
            return (
              <motion.div
                layout
                key={m.id}
                className="rounded-lg bg-bg-2/50 border border-border/40 px-[0.7vw] py-[0.7vh]"
              >
                <div className="flex items-center justify-between gap-[0.5vw]">
                  <DuelSide login={m.playerALogin} img={avatars.get(m.playerALogin ?? '') ?? null} entries={entries} align="left" />
                  <span className={`shrink-0 text-[0.95vh] font-bold uppercase tracking-wide px-[0.4vw] py-[0.15vh] rounded border ${badge.cls}`}>
                    {prono.unknown ? 'VS' : badge.text}
                  </span>
                  <DuelSide login={m.playerBLogin} img={avatars.get(m.playerBLogin ?? '') ?? null} entries={entries} align="right" />
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
      <span className="text-[1.35vh] text-text truncate">{teamLabelOf(login, entries ?? [])}</span>
    </div>
  );
}
