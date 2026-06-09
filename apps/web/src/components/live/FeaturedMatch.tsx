import { AnimatePresence, motion } from 'framer-motion';
import { Avatar } from '../Avatar';
import type { LiveTournament, TournamentMatch } from '../../lib/api';
import { avatarMap, eloMap, partnerOf, type FeaturedState } from '../../lib/liveTournament';

// Centre haut — affiche VS du match en avant, sur l'image babyfoot animée. Gère 1v1
// et 2v2 (paire affichée). Le visuel s'adapte à l'état (en cours / live / à venir /
// dernier match).

const STATE_BADGE: Record<FeaturedState, { label: string; tone: string }> = {
  active: { label: '⚔ MATCH EN COURS', tone: 'text-gold border-gold/60 bg-gold/10' },
  live: { label: '● EN DIRECT', tone: 'text-red border-red/60 bg-red/10' },
  next: { label: 'PROCHAIN DUEL', tone: 'text-teal border-teal/50 bg-teal/10' },
  last: { label: 'DERNIER MATCH', tone: 'text-muted-2 border-border bg-bg-2/60' },
};

function roundLabel(m: TournamentMatch, rounds: number): string {
  const stage = m.stage ?? 'bracket';
  if (stage === 'league') return m.poolIndex === 1 ? 'Match retour' : 'Journée de ligue';
  if (stage === 'pool') return `Poule ${(m.poolIndex ?? 0) + 1}`;
  const fromEnd = rounds - m.round;
  if (fromEnd === 0) return 'LA FINALE';
  if (fromEnd === 1) return 'Demi-finale';
  if (fromEnd === 2) return 'Quart de finale';
  return `Tour ${m.round}`;
}

export function FeaturedMatch({
  match,
  state,
  tournament,
  bracketRounds,
}: {
  match: TournamentMatch;
  state: FeaturedState;
  tournament: LiveTournament;
  bracketRounds: number;
}) {
  const entries = tournament.entries ?? [];
  const avatars = avatarMap(entries);
  const elos = eloMap(entries);
  const isBabyfoot = (tournament.game ?? 'babyfoot') === 'babyfoot';
  const badge = STATE_BADGE[state];
  const showScores = match.scoreA != null && match.scoreB != null;
  const winnerA = match.winnerLogin && match.winnerLogin === match.playerALogin;
  const winnerB = match.winnerLogin && match.winnerLogin === match.playerBLogin;

  return (
    <div className="relative flex flex-col items-center justify-center h-full w-full rounded-xl border border-border/60 bg-gradient-to-b from-bg-1/80 to-bg-0 overflow-hidden shadow-rivet">
      {/* Halo d'ambiance */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,201,74,0.10),transparent_65%)]" />

      <div className={`absolute top-[1.4vh] left-1/2 -translate-x-1/2 z-20 px-[1vw] py-[0.4vh] rounded-full border text-[1.5vh] font-bold uppercase tracking-[0.15em] ${badge.tone}`}>
        {badge.label}
      </div>

      <div className="relative z-10 flex items-center justify-between w-full px-[2vw] mt-[2vh]">
        <Fighter
          login={match.playerALogin}
          partner={match.playerALogin ? partnerOf(match.playerALogin, entries) : null}
          imageUrl={match.playerALogin ? avatars.get(match.playerALogin) ?? null : null}
          partnerImg={match.playerALogin ? avatars.get(partnerOf(match.playerALogin, entries) ?? '') ?? null : null}
          elo={match.playerALogin ? elos.get(match.playerALogin) : undefined}
          align="left"
          winner={!!winnerA}
          loser={!!match.winnerLogin && !winnerA}
        />

        {/* Centre : babyfoot + scores */}
        <div className="relative flex flex-col items-center justify-center shrink-0 px-[1vw]">
          {showScores ? (
            <div className="flex items-center gap-[1.2vw]">
              <Score value={match.scoreA!} highlight={!!winnerA} />
              <span className="font-display font-black text-[3vh] text-muted-2">·</span>
              <Score value={match.scoreB!} highlight={!!winnerB} />
            </div>
          ) : (
            <div className="font-display font-black text-[6vh] bg-gradient-to-b from-text-strong to-gold bg-clip-text text-transparent">
              VS
            </div>
          )}
          {isBabyfoot && (
            <img
              src="/baby anim-Photoroom.png"
              alt=""
              className="h-[14vh] w-auto object-contain mt-[0.5vh] drop-shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
            />
          )}
          <div className="mt-[0.4vh] text-[1.5vh] uppercase tracking-[0.18em] text-gold/90 font-gaming font-bold whitespace-nowrap">
            {roundLabel(match, bracketRounds)}
          </div>
        </div>

        <Fighter
          login={match.playerBLogin}
          partner={match.playerBLogin ? partnerOf(match.playerBLogin, entries) : null}
          imageUrl={match.playerBLogin ? avatars.get(match.playerBLogin) ?? null : null}
          partnerImg={match.playerBLogin ? avatars.get(partnerOf(match.playerBLogin, entries) ?? '') ?? null : null}
          elo={match.playerBLogin ? elos.get(match.playerBLogin) : undefined}
          align="right"
          winner={!!winnerB}
          loser={!!match.winnerLogin && !winnerB}
        />
      </div>
    </div>
  );
}

function Score({ value, highlight }: { value: number; highlight: boolean }) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={value}
        initial={{ scale: 0.4, opacity: 0, y: -10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.4, opacity: 0, y: 10 }}
        transition={{ type: 'spring', stiffness: 320, damping: 20 }}
        className={`font-display font-black tabular-nums text-[9vh] leading-none ${
          highlight ? 'text-gold drop-shadow-[0_0_22px_rgba(255,201,74,0.6)]' : 'text-text-strong'
        }`}
      >
        {value}
      </motion.span>
    </AnimatePresence>
  );
}

function Fighter({
  login,
  partner,
  imageUrl,
  partnerImg,
  elo,
  align,
  winner,
  loser,
}: {
  login: string | null;
  partner: string | null;
  imageUrl: string | null;
  partnerImg: string | null;
  elo: number | undefined;
  align: 'left' | 'right';
  winner: boolean;
  loser: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-[0.6vh] min-w-0 max-w-[24vw] transition-opacity ${
        loser ? 'opacity-50' : ''
      } ${align === 'left' ? 'items-center' : 'items-center'}`}
    >
      <div className="relative">
        <div className={winner ? 'ring-4 ring-gold rounded-full shadow-[0_0_30px_rgba(255,201,74,0.6)]' : ''}>
          <Avatar login={login ?? '?'} imageUrl={imageUrl} size="xl" grayscale={loser} />
        </div>
        {partner && (
          <div className="absolute -bottom-[0.5vh] -right-[0.5vh] rounded-full ring-2 ring-bg-0">
            <Avatar login={partner} imageUrl={partnerImg} size="md" grayscale={loser} />
          </div>
        )}
      </div>
      <div className="text-[2.6vh] font-display font-bold text-text-strong uppercase truncate max-w-full text-center">
        {login ?? '?'}
      </div>
      {partner && <div className="text-[1.4vh] text-muted-2 -mt-[0.4vh] truncate max-w-full">&amp; {partner}</div>}
      {elo != null && (
        <div className="text-[1.6vh] font-mono text-gold">
          ELO <span className="font-bold">{elo}</span>
        </div>
      )}
    </div>
  );
}
