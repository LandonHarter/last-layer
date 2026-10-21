import type { Penalty } from "./solves";
import { DNF, trimmedAverage } from "./stats";

/**
 * One time typed into the timer: "12.34", "1:02.34", "12.34+" (+2), "DNF",
 * or digits only like a csTimer typing pad, where the last two are hundredths
 * and the two before seconds: "1234" is 12.34, "110234" is 11:02.34.
 * DNF may carry the time it would have been: "DNF(1:02.34)". Null if it doesn't parse.
 */
export function parseTypedTime(text: string): { ms: number; penalty: Penalty } | null {
  const t = text.trim().replace(/\s+/g, "");
  const dnf = /^dnf(?:\((.*)\))?$/i.exec(t);
  if (dnf) {
    if (!dnf[1]) return { ms: 0, penalty: "dnf" };
    const inner = parseTypedTime(dnf[1]);
    return inner && inner.penalty === "none" ? { ms: inner.ms, penalty: "dnf" } : null;
  }
  const plus = t.endsWith("+");
  const body = plus ? t.slice(0, -1) : t;
  let ms: number;
  if (/^\d+$/.test(body)) {
    const n = body.padStart(3, "0");
    const cs = Number(n.slice(-2));
    const sec = Number(n.slice(-4, -2));
    const min = Number(n.slice(0, -4) || "0");
    if (n.length > 4 && sec >= 60) return null;
    ms = (min * 60 + sec) * 1000 + cs * 10;
  } else {
    const m = /^(?:(\d+):)?(\d+(?:\.\d*)?|\.\d+)$/.exec(body);
    if (!m || (m[1] && Number(m[2]) >= 60)) return null;
    ms = Math.round(((m[1] ? Number(m[1]) * 60 : 0) + Number(m[2])) * 1000);
  }
  if (ms <= 0) return null;
  return { ms, penalty: plus ? "+2" : "none" };
}

/**
 * Times typed by hand: "12.34", "1:02.5", "DNF", "12.34+" (a +2, which adds
 * two seconds). Separated by spaces, commas or new lines; brackets around
 * counting-out times are ignored. Returns ms, or null for what doesn't parse.
 */
export function parseTimes(text: string): { times: number[]; bad: string[] } {
  const times: number[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/[\s,;]+/).filter(Boolean)) {
    const token = raw.replace(/[()]/g, "");
    if (/^dnf$/i.test(token)) {
      times.push(DNF);
      continue;
    }
    const m = /^(?:(\d+):)?(\d+(?:\.\d+)?)(\+)?$/.exec(token);
    if (!m) {
      bad.push(raw);
      continue;
    }
    const ms = Math.round(((m[1] ? Number(m[1]) * 60 : 0) + Number(m[2])) * 1000) + (m[3] ? 2000 : 0);
    times.push(ms);
  }
  return { times, bad };
}

/** WCA-style average of all the times: mean of 3, or trimmed (best and worst 1 or 5% dropped). */
export function averageAll(times: number[]): number | null {
  if (times.length === 3) return times.some((t) => !Number.isFinite(t)) ? DNF : (times[0] + times[1] + times[2]) / 3;
  return trimmedAverage(times);
}

export type LastSolve = {
  /** The average if the last solve is your best yet (best possible average). */
  best: number;
  /** The average if the last solve is a DNF (worst possible average). */
  worst: number;
  /** Slowest last solve that still gets `target` or better: Infinity if any time does, null if none does. */
  needed: number | null;
};

/** With all but the last solve of an average done, what's still possible. */
export function lastSolve(done: number[], target: number): LastSolve | null {
  if (done.length < 2) return null;
  const avg = (x: number) => averageAll([...done, x])!;
  const best = avg(0);
  const worst = avg(DNF);
  if (worst <= target) return { best, worst, needed: Infinity };
  if (best > target) return { best, worst, needed: null };
  // The average only gets worse as the last time grows, so search for where it crosses.
  let lo = 0;
  let hi = 10 * 60 * 1000;
  if (avg(hi) <= target) return { best, worst, needed: hi };
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (avg(mid) <= target) lo = mid;
    else hi = mid;
  }
  return { best, worst, needed: lo };
}
