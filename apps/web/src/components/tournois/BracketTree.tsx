import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar } from '../Avatar';
import type { TournamentMatch, TournamentEntry } from '../../lib/api';

// Vrai arbre de bracket : colonnes par tour (round 1 à gauche, finale à droite),
// chaque match est une carte 2 joueurs reliée à son parent par des connecteurs SVG.
// Règle des connecteurs : round r slot s -> round r+1 slot floor(s/2),
// branche A si s pair, branche B si s impair.

export interface BracketTreeProps {
  matches: TournamentMatch[];
  rounds: number;
  entries: TournamentEntry[];
  onSelectMatch?: (m: TournamentMatch) => void;
  selectedMatchId?: string | null;
  // Match désigné « en cours » (« match suivant ») : mis en avant (anneau doré
  // pulsé + badge « EN COURS »).
  activeMatchId?: string | null;
}

// Dimensions de layout (px). Un match est une carte de hauteur fixe ;
// les cartes sont espacées verticalement pour aligner l'arbre.
const CARD_W = 264;
const CARD_H = 108;
const COL_GAP = 64; // espace horizontal entre colonnes (connecteurs)
const SLOT_H = 136; // pas vertical de base au round 1

// Repères internes d'une carte, pour faire voler l'avatar du vainqueur vers sa
// prochaine place : centre de l'avatar de chaque ligne (A = haut, B = bas).
const AVATAR_X = 26; // px-2.5 (10) + rayon avatar sm (16)
const ROW_A_Y = 27; // centre vertical de la ligne du haut
const ROW_B_Y = 81; // centre vertical de la ligne du bas
const AVATAR_D = 32; // diamètre avatar sm (w-8 h-8)

interface Flight {
  key: string;
  login: string;
  avatarUrl: string | null;
  x1: number;
  y1: number;
  midX: number; // coude du connecteur (sortie de carte → montée verticale)
  x2: number;
  y2: number;
}

function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'Finale';
  if (fromEnd === 1) return 'Demies';
  if (fromEnd === 2) return 'Quarts';
  return `Tour ${round}`;
}

export default function BracketTree({
  matches,
  rounds,
  entries,
  onSelectMatch,
  selectedMatchId,
  activeMatchId,
}: BracketTreeProps) {
  // Index avatar/imageUrl par login.
  const avatarOf = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const e of entries) map.set(e.login, e.user?.imageUrl ?? null);
    return map;
  }, [entries]);

  // Matchs groupés par round et triés par slot.
  const byRound = useMemo(() => {
    const m = new Map<number, TournamentMatch[]>();
    for (const match of matches) {
      const arr = m.get(match.round) ?? [];
      arr.push(match);
      m.set(match.round, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.slot - b.slot);
    return m;
  }, [matches]);

  // Position verticale du centre de chaque match. Au round r, le pas double
  // (les matchs s'écartent), et l'offset initial recentre la carte parent.
  const centerY = (round: number, slot: number): number => {
    const step = SLOT_H * Math.pow(2, round - 1);
    return step * slot + step / 2;
  };

  // Hauteur totale = pas du round 1 × nombre de slots du round 1.
  const round1Count = (byRound.get(1) ?? []).length;
  const totalHeight = Math.max(round1Count, 1) * SLOT_H + 24;
  const totalWidth = rounds * CARD_W + (rounds - 1) * COL_GAP + 24;

  const colX = (round: number) => 12 + (round - 1) * (CARD_W + COL_GAP);
  const cardTop = (round: number, slot: number) => centerY(round, slot) + 12 - CARD_H / 2;

  // ── Animation d'avancement : quand un match se confirme, l'avatar du vainqueur
  // « monte » l'arbre jusqu'à sa prochaine place (le perdant, lui, est grisé).
  // On ne rejoue PAS les avancements déjà acquis au 1er rendu (revisite de page).
  const flownRef = useRef<Set<string>>(new Set());
  const initedRef = useRef(false);
  const [flights, setFlights] = useState<Flight[]>([]);

  const computeFlight = (m: TournamentMatch): Flight | null => {
    if (!m.winnerLogin || m.round >= rounds) return null;
    const fromA = m.winnerLogin === m.playerALogin;
    const x1 = colX(m.round) + AVATAR_X;
    const y1 = cardTop(m.round, m.slot) + (fromA ? ROW_A_Y : ROW_B_Y);
    const parentSlot = Math.floor(m.slot / 2);
    const landsA = m.slot % 2 === 0; // branche A si slot pair (cf. connecteurs)
    const x2 = colX(m.round + 1) + AVATAR_X;
    const y2 = cardTop(m.round + 1, parentSlot) + (landsA ? ROW_A_Y : ROW_B_Y);
    // Coude du connecteur : milieu de l'inter-colonne (cf. `connectors`). L'avatar
    // sort de la carte, longe ce coude, puis monte/descend le long de la branche.
    const midX = colX(m.round) + CARD_W + COL_GAP / 2;
    return { key: m.id, login: m.winnerLogin, avatarUrl: avatarOf.get(m.winnerLogin) ?? null, x1, y1, midX, x2, y2 };
  };

  useEffect(() => {
    const confirmed = matches.filter((m) => m.confirmedAt && m.winnerLogin && m.round < rounds);
    // 1er rendu : on marque tout comme déjà acquis (pas d'animation rétroactive).
    if (!initedRef.current) {
      confirmed.forEach((m) => flownRef.current.add(m.id));
      initedRef.current = true;
      return;
    }
    const fresh = confirmed.filter((m) => !flownRef.current.has(m.id));
    if (fresh.length === 0) return;
    const added: Flight[] = [];
    for (const m of fresh) {
      flownRef.current.add(m.id);
      const f = computeFlight(m);
      if (f) added.push(f);
    }
    if (added.length === 0) return;
    setFlights((prev) => [...prev, ...added]);
    const keys = new Set(added.map((f) => f.key));
    const tm = setTimeout(() => {
      setFlights((prev) => prev.filter((f) => !keys.has(f.key)));
    }, 1500);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, rounds]);

  // Connecteurs : pour chaque match (sauf round final), trait jusqu'au parent.
  const connectors = useMemo(() => {
    const lines: { d: string; key: string }[] = [];
    for (let r = 1; r < rounds; r++) {
      const arr = byRound.get(r) ?? [];
      for (const m of arr) {
        const parentSlot = Math.floor(m.slot / 2);
        const x1 = colX(r) + CARD_W;
        const y1 = centerY(r, m.slot) + 12;
        const x2 = colX(r + 1);
        const y2 = centerY(r + 1, parentSlot) + 12;
        const midX = x1 + COL_GAP / 2;
        // Coude orthogonal : sortie horizontale, montée/descente, entrée.
        lines.push({
          key: `${m.id}-conn`,
          d: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`,
        });
      }
    }
    return lines;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byRound, rounds]);

  if (matches.length === 0) {
    return <div className="text-center text-muted-2 py-8 text-sm">Tableau en préparation…</div>;
  }

  return (
    <div className="overflow-x-auto -mx-4 px-4 pb-2">
      {/* En-têtes de tour alignés sur les colonnes. */}
      <div className="relative" style={{ width: totalWidth, height: 24 }}>
        {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => (
          <div
            key={`hdr-${round}`}
            className="absolute text-[11px] uppercase tracking-wider text-muted font-semibold text-center"
            style={{ left: colX(round), width: CARD_W, top: 0 }}
          >
            {roundLabel(round, rounds)}
          </div>
        ))}
      </div>

      <div className="relative" style={{ width: totalWidth, height: totalHeight }}>
        {/* Connecteurs SVG en fond. */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={totalWidth}
          height={totalHeight}
          fill="none"
        >
          {connectors.map((c) => (
            <path
              key={c.key}
              d={c.d}
              stroke="currentColor"
              strokeWidth={1.5}
              className="text-border"
            />
          ))}
        </svg>

        {/* Cartes de match positionnées en absolu. */}
        {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => {
          const arr = byRound.get(round) ?? [];
          return arr.map((m) => (
            <div
              key={m.id}
              className="absolute"
              style={{
                left: colX(round),
                top: cardTop(round, m.slot),
                width: CARD_W,
              }}
            >
              <MatchCard
                match={m}
                avatarOf={avatarOf}
                selected={selectedMatchId === m.id}
                active={activeMatchId === m.id}
                onSelect={onSelectMatch}
              />
            </div>
          ));
        })}

        {/* Avatars en vol : montée du vainqueur vers sa prochaine place. */}
        <AnimatePresence>
          {flights.map((f) => (
            <motion.div
              key={f.key}
              className="absolute pointer-events-none z-20"
              style={{ width: AVATAR_D, height: AVATAR_D, left: 0, top: 0 }}
              initial={{ x: f.x1 - AVATAR_D / 2, y: f.y1 - AVATAR_D / 2, scale: 1, opacity: 1 }}
              animate={{
                // Trajet en 3 segments calqué sur le connecteur orthogonal :
                // (1) sortie horizontale de la carte jusqu'au coude, (2) montée/
                // descente verticale le long de la branche, (3) entrée dans la
                // carte parent jusqu'à la place de l'avatar.
                x: [f.x1, f.midX, f.midX, f.x2].map((v) => v - AVATAR_D / 2),
                y: [f.y1, f.y1, f.y2, f.y2].map((v) => v - AVATAR_D / 2),
                scale: [1, 1.15, 1.15, 1],
                opacity: [1, 1, 1, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, ease: 'easeInOut', times: [0, 0.3, 0.75, 1] }}
            >
              <div className="rounded-full ring-2 ring-gold shadow-[0_0_18px_rgba(255,201,74,0.8)]">
                <Avatar login={f.login} imageUrl={f.avatarUrl} size="sm" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MatchCard({
  match,
  avatarOf,
  selected,
  active,
  onSelect,
}: {
  match: TournamentMatch;
  avatarOf: Map<string, string | null>;
  selected: boolean;
  active: boolean;
  onSelect?: (m: TournamentMatch) => void;
}) {
  const winnerA = !!(match.winnerLogin && match.winnerLogin === match.playerALogin);
  const winnerB = !!(match.winnerLogin && match.winnerLogin === match.playerBLogin);
  const done = !!match.confirmedAt;
  const clickable = !!onSelect;

  return (
    <div className="relative">
      {/* Badge « EN COURS » : posé HORS de la carte (qui est en overflow-hidden
          pour arrondir les coins des lignes) afin de ne pas être rogné. */}
      {active && !done && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-30 px-2 py-0.5 rounded-full bg-gold text-[#1a0d00] text-[9px] font-extrabold uppercase tracking-wider shadow whitespace-nowrap pointer-events-none">
          ⚔ En cours
        </div>
      )}
      <motion.div
        layout
        onClick={() => onSelect?.(match)}
        className={`relative rounded-lg border bg-bg-2/50 overflow-hidden transition-colors ${
          active
            ? 'border-gold'
            : selected
              ? 'border-gold/60 ring-1 ring-gold/40'
              : done
                ? 'border-teal/40'
                : 'border-border'
        } ${clickable ? 'cursor-pointer hover:border-gold/40' : ''}`}
        animate={
          active
            ? { boxShadow: ['0 0 0 0 rgba(255,201,74,0.0)', '0 0 16px 2px rgba(255,201,74,0.55)', '0 0 0 0 rgba(255,201,74,0.0)'] }
            : { boxShadow: '0 0 0 0 rgba(255,201,74,0)' }
        }
        transition={active ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
      >
        <SlotRow
          login={match.playerALogin}
          score={match.scoreA}
          winner={winnerA}
          loser={done && !winnerA && !!match.playerALogin}
          avatarUrl={match.playerALogin ? avatarOf.get(match.playerALogin) ?? null : null}
        />
        <div className="h-px bg-border/40" />
        <SlotRow
          login={match.playerBLogin}
          score={match.scoreB}
          winner={winnerB}
          loser={done && !winnerB && !!match.playerBLogin}
          avatarUrl={match.playerBLogin ? avatarOf.get(match.playerBLogin) ?? null : null}
        />
      </motion.div>
    </div>
  );
}

function SlotRow({
  login,
  score,
  winner,
  loser,
  avatarUrl,
}: {
  login: string | null;
  score: number | null;
  winner: boolean;
  loser: boolean;
  avatarUrl: string | null;
}) {
  return (
    <div
      className={`relative flex items-center justify-between gap-2 px-2.5 py-2.5 transition-opacity ${
        winner ? 'bg-gold/[0.07]' : ''
      } ${loser ? 'opacity-45' : ''}`}
    >
      {/* Liseré gagnant + animation de montée de la pp. */}
      {winner && (
        <motion.span
          layout
          className="absolute left-0 top-0 bottom-0 w-[3px] bg-gold"
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          style={{ originY: 0.5 }}
        />
      )}
      <div className="flex items-center gap-2 min-w-0">
        {login ? (
          <motion.div
            layout
            initial={winner ? { y: 6, scale: 0.9, opacity: 0.6 } : false}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="shrink-0"
          >
            <Avatar login={login} imageUrl={avatarUrl} size="sm" grayscale={loser} />
          </motion.div>
        ) : (
          <div className="w-8 h-8 rounded-full border border-dashed border-muted/50 shrink-0" />
        )}
        <span
          className={`text-sm truncate ${
            winner ? 'text-text-strong font-bold' : login ? 'text-text' : 'text-muted'
          }`}
        >
          {login ?? '?'}
        </span>
      </div>
      <span
        className={`text-sm tabular-nums shrink-0 ${
          winner ? 'text-gold font-bold' : score != null && score < 0 ? 'text-red' : 'text-muted-2'
        }`}
      >
        {score != null ? score : '–'}
      </span>
    </div>
  );
}
