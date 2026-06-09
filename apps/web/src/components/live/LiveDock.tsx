import type { LiveTournament } from '../../lib/api';
import type { PhaseInfo } from '../../lib/liveTournament';

// Bandeau inférieur — rappel des disciplines (jeu du tournoi mis en avant) + phase.
const GAMES: Array<{ id: string; label: string; color: string; grey: string }> = [
  { id: 'babyfoot', label: 'Babyfoot', color: '/coulour-baby.webp', grey: '/gray-baby.webp' },
  { id: 'smash', label: 'Smash', color: '/smash-color.webp', grey: '/smash-grey.webp' },
  { id: 'streetfighter', label: 'Street Fighter', color: '/sf-color.webp', grey: '/sf-grey.webp' },
  { id: 'chess', label: 'Échecs', color: '/chess.webp', grey: '/gray-chess.webp' },
];

export function LiveDock({ tournament, phase }: { tournament: LiveTournament; phase: PhaseInfo }) {
  const game = tournament.game ?? 'babyfoot';
  return (
    <footer className="flex items-center justify-between px-[2vw] py-[0.8vh] border-t border-border/60 bg-gradient-to-t from-bg-1 to-bg-0">
      <div className="flex items-center gap-[1.4vw]">
        {GAMES.map((g) => {
          const active = g.id === game;
          return (
            <div key={g.id} className="flex items-center gap-[0.4vw]">
              <img
                src={active ? g.color : g.grey}
                alt={g.label}
                className={`h-[3.4vh] w-auto object-contain transition ${
                  active ? 'drop-shadow-[0_0_14px_rgba(255,201,74,0.6)]' : 'opacity-40'
                }`}
              />
              {active && (
                <span className="text-[1.5vh] font-gaming font-bold uppercase tracking-wider text-gold">
                  {g.label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-[0.8vw]">
        <span className="px-[1vw] py-[0.4vh] rounded-full border border-gold/40 bg-gold/10 text-[1.5vh] font-bold uppercase tracking-[0.15em] text-gold">
          {phase.label}
        </span>
        {phase.detail && <span className="text-[1.5vh] text-muted-2">{phase.detail}</span>}
      </div>
    </footer>
  );
}
