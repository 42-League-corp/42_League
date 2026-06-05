import { useMemo } from 'react';
import { motion } from 'framer-motion';
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
}

// Dimensions de layout (px). Un match est une carte de hauteur fixe ;
// les cartes sont espacées verticalement pour aligner l'arbre.
const CARD_W = 220;
const CARD_H = 88;
const COL_GAP = 56; // espace horizontal entre colonnes (connecteurs)
const SLOT_H = 112; // pas vertical de base au round 1

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
            className="absolute text-[10px] uppercase tracking-wider text-muted font-semibold text-center"
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
                top: centerY(round, m.slot) + 12 - CARD_H / 2,
                width: CARD_W,
              }}
            >
              <MatchCard
                match={m}
                avatarOf={avatarOf}
                selected={selectedMatchId === m.id}
                onSelect={onSelectMatch}
              />
            </div>
          ));
        })}
      </div>
    </div>
  );
}

function MatchCard({
  match,
  avatarOf,
  selected,
  onSelect,
}: {
  match: TournamentMatch;
  avatarOf: Map<string, string | null>;
  selected: boolean;
  onSelect?: (m: TournamentMatch) => void;
}) {
  const winnerA = !!(match.winnerLogin && match.winnerLogin === match.playerALogin);
  const winnerB = !!(match.winnerLogin && match.winnerLogin === match.playerBLogin);
  const done = !!match.confirmedAt;
  const clickable = !!onSelect;

  return (
    <motion.div
      layout
      onClick={() => onSelect?.(match)}
      className={`rounded-lg border bg-bg-2/50 overflow-hidden transition-colors ${
        selected ? 'border-gold/60 ring-1 ring-gold/40' : done ? 'border-teal/40' : 'border-border'
      } ${clickable ? 'cursor-pointer hover:border-gold/40' : ''}`}
    >
      <SlotRow
        login={match.playerALogin}
        score={match.scoreA}
        winner={winnerA}
        avatarUrl={match.playerALogin ? avatarOf.get(match.playerALogin) ?? null : null}
      />
      <div className="h-px bg-border/40" />
      <SlotRow
        login={match.playerBLogin}
        score={match.scoreB}
        winner={winnerB}
        avatarUrl={match.playerBLogin ? avatarOf.get(match.playerBLogin) ?? null : null}
      />
    </motion.div>
  );
}

function SlotRow({
  login,
  score,
  winner,
  avatarUrl,
}: {
  login: string | null;
  score: number | null;
  winner: boolean;
  avatarUrl: string | null;
}) {
  return (
    <div
      className={`relative flex items-center justify-between gap-2 px-2 py-1.5 ${
        winner ? 'bg-gold/[0.07]' : ''
      }`}
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
            <Avatar login={login} imageUrl={avatarUrl} size="xs" />
          </motion.div>
        ) : (
          <div className="w-5 h-5 rounded-full border border-dashed border-muted/50 shrink-0" />
        )}
        <span
          className={`text-xs truncate ${
            winner ? 'text-text-strong font-bold' : login ? 'text-text' : 'text-muted'
          }`}
        >
          {login ?? '?'}
        </span>
      </div>
      <span
        className={`text-xs tabular-nums shrink-0 ${
          winner ? 'text-gold font-bold' : score != null && score < 0 ? 'text-red' : 'text-muted-2'
        }`}
      >
        {score != null ? score : '–'}
      </span>
    </div>
  );
}
