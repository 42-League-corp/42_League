import { motion } from 'framer-motion';
import { Avatar } from '../Avatar';
import { PanelTitle } from './LivePanel';
import type { LiveTournament, TournamentMatch } from '../../lib/api';
import { avatarMap, teamEloMap, teamLabelOf, pronostic } from '../../lib/liveTournament';

// Colonne droite (haut) — « PROCHAINS DUELS ». Chaque affiche montre le PRONOSTIC ELO
// (barre de probabilité de victoire de chaque camp) pour comprendre tout de suite si
// le duel sera serré, plus un badge de suspense et une jauge d'engouement (mises).

const GREEN = '#7fd66e';

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
  const elos = teamEloMap(entries);
  return (
    <section className="flex flex-col min-h-0 flex-1 rounded-xl border border-border/60 bg-bg-1/70 overflow-hidden">
      <PanelTitle>Prochains duels</PanelTitle>
      {duels.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[1.5vh] text-muted-2 px-4 text-center">
          Aucune affiche programmée.
        </div>
      ) : (
        <div className="flex flex-col gap-[0.55vh] px-[0.8vw] pb-[1vh] min-h-0 flex-1 overflow-hidden">
          {duels.map((m) => {
            const hype = Math.round((hypes.get(m.id) ?? 0) * 100);
            const eloA = m.playerALogin ? elos.get(m.playerALogin) : undefined;
            const eloB = m.playerBLogin ? elos.get(m.playerBLogin) : undefined;
            const prono = pronostic(eloA, eloB);
            const pctA = Math.round(prono.pa * 100);
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
                className="rounded-lg bg-bg-2/50 border border-border/40 px-[0.7vw] py-[0.55vh]"
              >
                <div className="flex items-center justify-between gap-[0.5vw]">
                  <DuelSide login={m.playerALogin} img={avatars.get(m.playerALogin ?? '') ?? null} entries={entries} align="left" />
                  <span className={`shrink-0 text-[0.95vh] font-bold uppercase tracking-wide px-[0.4vw] py-[0.1vh] rounded border ${badge.cls}`}>
                    {prono.unknown ? 'VS' : badge.text}
                  </span>
                  <DuelSide login={m.playerBLogin} img={avatars.get(m.playerBLogin ?? '') ?? null} entries={entries} align="right" />
                </div>

                {/* Pronostic ELO : barre de probabilité A vs B */}
                <div className="mt-[0.45vh] flex items-center gap-[0.5vw]">
                  <span className="text-[1.05vh] font-mono tabular-nums text-muted-2 w-[3ch] text-right shrink-0">
                    {prono.unknown ? '–' : `${pctA}%`}
                  </span>
                  <div className="relative flex-1 h-[0.7vh] rounded-full overflow-hidden bg-bg-3/80">
                    <motion.div
                      className="absolute inset-y-0 left-0"
                      style={{ background: `linear-gradient(90deg, ${GREEN}, ${GREEN}99)` }}
                      animate={{ width: prono.unknown ? '50%' : `${pctA}%` }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                    />
                    <div className="absolute inset-y-0 left-1/2 w-px bg-text-strong/30" />
                  </div>
                  <span className="text-[1.05vh] font-mono tabular-nums text-muted-2 w-[3ch] shrink-0">
                    {prono.unknown ? '–' : `${100 - pctA}%`}
                  </span>
                </div>

                {/* Engouement (mises) — secondaire */}
                <div className="mt-[0.3vh] flex items-center gap-[0.5vw]">
                  <span className="text-[0.95vh] uppercase tracking-wider text-gold/70 font-bold shrink-0">Hype</span>
                  <div className="flex-1 h-[0.5vh] rounded-full bg-bg-3/80 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-gold-deep via-gold to-gold"
                      animate={{ width: `${Math.max(3, hype)}%` }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                    />
                  </div>
                  <span className="text-[1.0vh] font-mono text-gold/90 tabular-nums w-[3ch] text-right shrink-0">{hype}%</span>
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
