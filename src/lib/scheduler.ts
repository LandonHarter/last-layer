import type { Entry, Status } from "./progress";

/** How often each status comes up relative to the others. */
export const STATUS_WEIGHT: Record<Status, number> = {
  unknown: 0,
  learning: 6,
  learned: 1,
};

const MAX_STREAK_BOOST = 3;

export function weightFor(entry: Entry): number {
  return STATUS_WEIGHT[entry.status] * (1 + Math.min(entry.missStreak, MAX_STREAK_BOOST));
}

/**
 * Weighted random pick. Never repeats the previous case unless it is the only
 * one. No other recency damping: in small pools it would drown out the status
 * weights and learned cases would come up nearly as often as new ones.
 */
export function pickNext(
  pool: { id: string; entry: Entry }[],
  recent: string[],
  random: () => number = Math.random,
): string | null {
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0].id;

  const last = recent.at(-1);
  const weighted = pool.map(({ id, entry }) => ({ id, weight: id === last ? 0 : weightFor(entry) }));

  const total = weighted.reduce((sum, w) => sum + w.weight, 0);
  if (total === 0) return pool.find((p) => p.id !== last)!.id;

  let roll = random() * total;
  for (const w of weighted) {
    roll -= w.weight;
    if (roll < 0) return w.id;
  }
  return weighted.findLast((w) => w.weight > 0)!.id;
}
