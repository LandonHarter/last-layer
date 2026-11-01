/**
 * Time spent cubing, worked out from the solves you already have. A stretch
 * starts with a solve and keeps going while solves keep coming; a break of more
 * than `GAP_MS` ends it. Its length runs from the start of its first solve
 * (inspection included) to the end of its last. Pure functions, no React.
 */

import { dayKey, dayStart, shiftDay } from "./daily";
import type { Solve } from "./solves";

export const GAP_MS = 5 * 60000;

export type Stretch = {
  start: number;
  end: number;
  solves: number;
  /** Time on the clock, raw ms summed (penalties and DNFs still took that long). */
  solvingMs: number;
};

type Timed = Pick<Solve, "at" | "ms" | "inspectionMs">;

const startOf = (s: Timed) => s.at - s.ms - (s.inspectionMs ?? 0);

/** Stretches of solving, oldest first. */
export function practiceStretches(solves: Timed[], gap = GAP_MS): Stretch[] {
  const sorted = [...solves].sort((a, b) => a.at - b.at);
  const out: Stretch[] = [];
  for (const s of sorted) {
    const start = startOf(s);
    const last = out.at(-1);
    if (last && start - last.end <= gap) {
      last.end = Math.max(last.end, s.at);
      last.solves++;
      last.solvingMs += s.ms;
    } else {
      out.push({ start, end: s.at, solves: 1, solvingMs: s.ms });
    }
  }
  return out;
}

export type PracticeDay = {
  day: string;
  ms: number;
  /** Stretches that touch this day. */
  stretches: number;
  /** Solves that finished this day. */
  solves: number;
};

/** Time per local day, oldest first. A stretch over midnight counts toward both days. */
export function practiceDays(stretches: Stretch[]): PracticeDay[] {
  const byDay = new Map<string, PracticeDay>();
  const get = (day: string) => {
    let d = byDay.get(day);
    if (!d) byDay.set(day, (d = { day, ms: 0, stretches: 0, solves: 0 }));
    return d;
  };
  for (const s of stretches) {
    let day = dayKey(s.start);
    for (;;) {
      const next = dayStart(shiftDay(day, 1));
      const d = get(day);
      d.ms += Math.min(s.end, next) - Math.max(s.start, dayStart(day));
      d.stretches++;
      if (s.end <= next) break;
      day = shiftDay(day, 1);
    }
    // All of a stretch's solves go to the day it ended, close enough for a count.
    get(dayKey(s.end)).solves += s.solves;
  }
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
}

/** Totals for the figures: today, the last 7 and 30 days, all time, and the streak. */
export function practiceSummary(days: PracticeDay[], stretches: Stretch[], now = Date.now()) {
  const today = dayKey(now);
  const since = (n: number) => {
    const from = shiftDay(today, -(n - 1));
    return days.filter((d) => d.day >= from).reduce((t, d) => t + d.ms, 0);
  };
  const total = days.reduce((t, d) => t + d.ms, 0);
  const span = stretches.reduce((t, s) => t + (s.end - s.start), 0);
  const solving = stretches.reduce((t, s) => t + s.solvingMs, 0);

  // Days in a row with any cubing; today not over yet doesn't break it.
  const active = new Set(days.filter((d) => d.ms > 0).map((d) => d.day));
  let day = active.has(today) ? today : shiftDay(today, -1);
  let streak = 0;
  while (active.has(day)) {
    streak++;
    day = shiftDay(day, -1);
  }

  return {
    today: days.find((d) => d.day === today)?.ms ?? 0,
    week: since(7),
    month: since(30),
    total,
    perDay: active.size ? total / active.size : 0,
    longest: stretches.reduce<Stretch | null>((best, s) => (!best || s.end - s.start > best.end - best.start ? s : best), null),
    streak,
    /** Share of stretch time spent with the clock running. */
    onClock: span > 0 ? Math.min(1, solving / span) : null,
  };
}

/** "1 h 12 min", "8 min", "45 s". */
export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
}
