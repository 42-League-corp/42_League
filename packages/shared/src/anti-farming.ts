export const ANTI_FARMING_WINDOW_DAYS = 7;
export const MAX_COUNTED_PER_PAIR_PER_WINDOW = 2;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface PriorMatch {
  playedAt: Date;
  countedForElo: boolean;
}

/**
 * Two players can have at most MAX_COUNTED_PER_PAIR_PER_WINDOW matches
 * counted toward ELO inside a rolling window. Beyond that, additional
 * matches are still recorded but won't move ratings.
 */
export function shouldCountForElo(
  priorMatchesBetweenPair: PriorMatch[],
  newMatchAt: Date,
): boolean {
  const windowStart = new Date(
    newMatchAt.getTime() - ANTI_FARMING_WINDOW_DAYS * MS_PER_DAY,
  );
  const countedInWindow = priorMatchesBetweenPair.filter(
    (m) =>
      m.countedForElo &&
      m.playedAt >= windowStart &&
      m.playedAt < newMatchAt,
  ).length;
  return countedInWindow < MAX_COUNTED_PER_PAIR_PER_WINDOW;
}
