import { motion } from 'framer-motion';
import { Avatar } from '../Avatar';
import { Sparkline } from './Sparkline';
import type { LiveTournament, TournamentMatch } from '../../lib/api';
import type { Standing } from '../../lib/tournamentStandings';
import { formOf } from '../../lib/tournamentStandings';
import { avatarMap, eloMap, teamLabelOf } from '../../lib/liveTournament';

// Colonne gauche — « CLASSEMENT GÉNÉRAL » : podium top-3 + lignes suivantes. En ligue
// c'est le classement au goal average ; conservé tel quel comme historique une fois
// l'arbre généré. Aucun scroll : on borne le nombre de lignes affichées.

const GAME_LABEL: Record<string, string> = {
  babyfoot: 'BABYFOOT',
  smash: 'SMASH',
  chess: 'ÉCHECS',
  streetfighter: 'STREET FIGHTER',
  flechettes: 'FLÉCHETTES',
};

const PODIUM_ORDER = [1, 0, 2]; // 2e à gauche, 1er au centre, 3e à droite

export function StandingsPanel({
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
  const podium = standings.slice(0, 3);
  const rest = standings.slice(3, 10);
  const gameLabel = GAME_LABEL[tournament.game ?? 'babyfoot'] ?? '';

  return (
    <section className="flex flex-col min-h-0 h-full rounded-xl border border-border/60 bg-bg-1/70 shadow-rivet overflow-hidden">
      <PanelTitle>
        Classement général <span className="text-muted-2 font-normal">({gameLabel})</span>
      </PanelTitle>

      {standings.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[1.6vh] text-muted-2 px-4 text-center">
          En attente des premiers résultats…
        </div>
      ) : (
        <div className="flex flex-col min-h-0 flex-1 px-[1vw] pb-[1vh]">
          {/* Podium */}
          <div className="flex items-end justify-center gap-[0.8vw] pt-[1vh] pb-[1.4vh]">
            {PODIUM_ORDER.map((idx) => {
              const s = podium[idx];
              if (!s) return <div key={idx} className="w-[5vw]" />;
              const isFirst = idx === 0;
              return (
                <motion.div
                  layout
                  key={s.login}
                  className="flex flex-col items-center"
                  style={{ width: isFirst ? '6.5vw' : '5.5vw' }}
                >
                  {isFirst && <div className="text-[2.4vh] -mb-[0.6vh]">👑</div>}
                  <div className={isFirst ? 'scale-110' : ''}>
                    <Avatar
                      login={s.login}
                      imageUrl={avatars.get(s.login) ?? null}
                      size={isFirst ? 'xl' : 'lg'}
                    />
                  </div>
                  <div className="mt-[0.4vh] text-[1.6vh] font-bold text-text-strong truncate max-w-full text-center">
                    {teamLabelOf(s.login, entries)}
                  </div>
                  <div
                    className={`mt-[0.4vh] w-full rounded-t-md flex items-center justify-center font-display font-black ${
                      isFirst
                        ? 'bg-gradient-to-b from-gold/40 to-gold/5 text-gold'
                        : 'bg-bg-3/70 text-muted-2'
                    }`}
                    style={{ height: isFirst ? '5vh' : '3.4vh', fontSize: isFirst ? '2.6vh' : '2vh' }}
                  >
                    {idx + 1}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Lignes suivantes */}
          <div className="flex flex-col gap-[0.5vh] min-h-0 flex-1">
            {rest.map((s, i) => (
              <motion.div
                layout
                key={s.login}
                className="flex items-center gap-[0.6vw] rounded-lg bg-bg-2/50 border border-border/40 px-[0.6vw] py-[0.5vh]"
              >
                <span className="w-[2vw] text-center font-mono text-[1.7vh] text-muted-2 shrink-0">
                  #{i + 4}
                </span>
                <Avatar login={s.login} imageUrl={avatars.get(s.login) ?? null} size="sm" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[1.6vh] text-text truncate font-semibold">
                    {teamLabelOf(s.login, entries)}
                  </span>
                  <span className="text-[1.1vh] text-muted-2 tabular-nums">
                    {s.wins}V · diff {s.diff >= 0 ? '+' : ''}{s.diff}
                  </span>
                </div>
                <Sparkline form={formOf(s.login, matches)} />
                <span className="w-[3.4vw] text-right font-mono font-bold text-[1.7vh] text-gold tabular-nums shrink-0">
                  {elos.get(s.login) ?? '—'}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[0.6vw] px-[1vw] py-[1vh] shrink-0">
      <span className="inline-block w-[0.4vw] h-[2vh] bg-gradient-to-b from-gold to-gold-deep rounded-sm" />
      <h2 className="font-gaming font-bold uppercase tracking-[0.12em] text-[1.9vh] text-text-strong">
        {children}
      </h2>
    </div>
  );
}
