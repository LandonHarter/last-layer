/**
 * Daily averages: once a day you start a daily on the Timer, and the next N
 * solves in that session are tagged with `daily: N`. Grouping them by local
 * calendar day gives one average per day, so progress reads by date rather
 * than by how many solves you happened to do. Pure functions, no React.
 */

import type { Solve } from "./solves";
import { averageOf, DNF, linearRegression, mean, trimmedAverage } from "./stats";

export const DAILY_SIZES = [5, 12, 25, 50];
export const DEFAULT_DAILY_SIZE = 12;

const DAY_MS = 86400000;

/** Local calendar day of a time, like `2026-10-22`. */
export function dayKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local midnight at the start of a day key. */
export function dayStart(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** The day key `offset` days from `key` (negative goes back). Safe across DST changes. */
export function shiftDay(key: string, offset: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + offset).getTime());
}

export type DailyRun = {
  day: string;
  size: number;
  /** The solves that count, oldest first: at most `size` of them. */
  solves: Solve[];
  /** Times that count, ms with penalties (DNF is Infinity). */
  times: number[];
  done: boolean;
  /** The aoN once done, otherwise null. */
  average: number | null;
  /** Average of what's done so far (trimmed from 5 solves), for a run in progress. */
  soFar: number | null;
};

// Same as `effectiveMs` in solves.ts, kept here so this module stays importable on the server.
const counted = (s: Pick<Solve, "ms" | "penalty">) => (s.penalty === "dnf" ? DNF : s.penalty === "+2" ? s.ms + 2000 : s.ms);

/** One run per day for a session, oldest day first. */
export function dailyRuns(solves: Solve[], session: string): DailyRun[] {
  const byDay = new Map<string, Solve[]>();
  for (const s of solves) {
    if (s.session !== session || !s.daily) continue;
    const key = dayKey(s.at);
    const list = byDay.get(key);
    if (list) list.push(s);
    else byDay.set(key, [s]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, list]) => {
      list.sort((a, b) => a.at - b.at);
      const size = list[0].daily!;
      const kept = list.slice(0, size);
      const times = kept.map(counted);
      const done = kept.length >= size;
      const finite = times.filter(Number.isFinite);
      const soFar = times.length >= 5 ? trimmedAverage(times) : finite.length ? mean(finite) : null;
      return { day, size, solves: kept, times, done, average: done ? averageOf(times, size) : null, soFar };
    });
}

/** Today's run, if one has started. */
export const todayRun = (runs: DailyRun[], now = Date.now()) => (runs.at(-1)?.day === dayKey(now) ? runs.at(-1)! : null);

/**
 * Days in a row with a finished daily, up to today. A day that isn't over yet
 * doesn't break it: with today not done, the streak counts back from yesterday.
 */
export function dailyStreak(runs: DailyRun[], now = Date.now()): number {
  const done = new Set(runs.filter((r) => r.done).map((r) => r.day));
  let day = dayKey(now);
  if (!done.has(day)) day = shiftDay(day, -1);
  let n = 0;
  while (done.has(day)) {
    n++;
    day = shiftDay(day, -1);
  }
  return n;
}

/** Finished dailies with a real (non-DNF) average. */
export const finishedRuns = (runs: DailyRun[]) => runs.filter((r): r is DailyRun & { average: number } => r.average !== null && Number.isFinite(r.average));

/**
 * Least-squares line through the daily averages against the date (x in epoch ms),
 * with the change per week and where the line will be 30 days after the last daily.
 * Null with fewer than 3 dailies on different days.
 */
export function dailyTrend(runs: DailyRun[]) {
  const done = finishedRuns(runs);
  const fit = linearRegression(
    done.map((r) => dayStart(r.day)),
    done.map((r) => r.average),
  );
  if (!fit) return null;
  const last = dayStart(done.at(-1)!.day);
  return { ...fit, perWeek: fit.slope * 7 * DAY_MS, projected: fit.intercept + fit.slope * (last + 30 * DAY_MS) };
}

/** How the latest finished daily compares: a best daily, and the change from the daily before it. */
export function dailyBadges(runs: DailyRun[]) {
  const done = finishedRuns(runs);
  const latest = done.at(-1);
  if (!latest) return null;
  const before = done.slice(0, -1);
  const previous = before.at(-1) ?? null;
  return {
    latest,
    isBest: before.length > 0 && before.every((r) => latest.average < r.average),
    previous,
    /** Negative is faster. */
    change: previous ? latest.average - previous.average : null,
  };
}
