import { prisma } from './db.js';
import { randomUUID } from 'node:crypto';

export function totalRounds(capacity: number): number {
  return Math.log2(capacity);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

/**
 * Build the full bracket: round 1 has `capacity/2` matches with shuffled players,
 * subsequent rounds are empty placeholders.
 */
export async function generateBracket(
  tournamentId: string,
  capacity: number,
  loginsIn: string[],
): Promise<void> {
  const logins = shuffle(loginsIn);
  const rounds = totalRounds(capacity);
  const data: Array<{
    id: string;
    tournamentId: string;
    round: number;
    slot: number;
    playerALogin: string | null;
    playerBLogin: string | null;
  }> = [];

  // Round 1: real players paired
  let matchesInRound = capacity / 2;
  for (let s = 0; s < matchesInRound; s++) {
    data.push({
      id: randomUUID(),
      tournamentId,
      round: 1,
      slot: s,
      playerALogin: logins[s * 2] ?? null,
      playerBLogin: logins[s * 2 + 1] ?? null,
    });
  }
  // Subsequent rounds: empty
  for (let r = 2; r <= rounds; r++) {
    matchesInRound = capacity / Math.pow(2, r);
    for (let s = 0; s < matchesInRound; s++) {
      data.push({
        id: randomUUID(),
        tournamentId,
        round: r,
        slot: s,
        playerALogin: null,
        playerBLogin: null,
      });
    }
  }
  await prisma.tournamentMatch.createMany({ data });
}

/**
 * After a match has a winner, propagate them to the next round's match.
 * Returns true if this was the final (tournament should be marked finished).
 */
export async function advanceWinner(
  tournamentId: string,
  round: number,
  slot: number,
  winnerLogin: string,
  capacity: number,
): Promise<{ isFinal: boolean }> {
  const rounds = totalRounds(capacity);
  if (round >= rounds) return { isFinal: true };
  const nextRound = round + 1;
  const nextSlot = Math.floor(slot / 2);
  const side = slot % 2 === 0 ? 'A' : 'B';
  await prisma.tournamentMatch.update({
    where: {
      tournamentId_round_slot: {
        tournamentId,
        round: nextRound,
        slot: nextSlot,
      },
    },
    data:
      side === 'A'
        ? { playerALogin: winnerLogin }
        : { playerBLogin: winnerLogin },
  });
  return { isFinal: false };
}
