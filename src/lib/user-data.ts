/**
 * The shape of a signed-in account's data, shared by the browser and the
 * server. Every store keeps one value under one key (the localStorage key it
 * uses when signed out). Most values are saved whole as a document; solves and
 * the drill log grow without bound, so only what changed is sent for them.
 */

import type { DrillAttempt, Penalty, Solve } from "./solves";

export const TIMER_KEY = "last-layer:timer:v1";
export const DRILL_KEY = "last-layer:drill-log:v1";
/** next-themes keeps the theme under this key. */
export const THEME_KEY = "theme";

/** Keys a store may use: `last-layer:<name>:v<n>`, plus the theme. */
export function isDataKey(key: string): boolean {
  return key === THEME_KEY || /^last-layer:[a-z0-9-]+:v\d+$/.test(key);
}

export type TimerDoc = { sessions: unknown; current: unknown };

export type SyncOps = {
  /** Whole values, by key. For the timer, everything but the solves. */
  docs: Record<string, unknown>;
  solves?: { upsert: Solve[]; remove: string[] };
  /** `clear` drops the whole log before `append` is added. */
  drill?: { clear: boolean; append: DrillAttempt[] };
};

type TimerValue = { solves?: Solve[]; sessions?: unknown; current?: unknown };

/**
 * What to send to bring the server from `prev` (what it has) to `cur`. Stores
 * replace values rather than mutate them, so anything that is still the same
 * object hasn't changed.
 */
export function diffKey(ops: SyncOps, key: string, prev: unknown, cur: unknown) {
  if (prev === cur) return;
  if (key === TIMER_KEY) {
    const p = (prev ?? {}) as TimerValue;
    const c = (cur ?? {}) as TimerValue;
    if (prev === undefined || p.sessions !== c.sessions || p.current !== c.current) ops.docs[key] = { sessions: c.sessions, current: c.current };
    const before = new Map((p.solves ?? []).map((s) => [s.id, s]));
    const upsert = (c.solves ?? []).filter((s) => before.get(s.id) !== s);
    const now = new Set((c.solves ?? []).map((s) => s.id));
    const remove = [...before.keys()].filter((id) => !now.has(id));
    if (upsert.length || remove.length) {
      const solves = (ops.solves ??= { upsert: [], remove: [] });
      solves.upsert.push(...upsert);
      solves.remove.push(...remove);
    }
    return;
  }
  if (key === DRILL_KEY) {
    const p = Array.isArray(prev) ? (prev as DrillAttempt[]) : [];
    const c = Array.isArray(cur) ? (cur as DrillAttempt[]) : [];
    // Usually the log only grew: send the new answers.
    const grew = c.length >= p.length && (p.length === 0 || c[p.length - 1] === p[p.length - 1]);
    ops.drill = grew ? { clear: false, append: c.slice(p.length) } : { clear: true, append: c };
    return;
  }
  ops.docs[key] = cur;
}

export const isEmptyOps = (ops: SyncOps) => !Object.keys(ops.docs).length && !ops.solves && !ops.drill;

// ---------------------------------------------------------------------------
// Checking what comes in. The server never trusts the client's values.

const PENALTIES: Penalty[] = ["none", "+2", "dnf"];
const INT_MAX = 2 ** 31 - 1;

const str = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const optStr = (v: unknown, max: number) => (str(v, max) && v ? v : undefined);
const time = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const ms = (v: unknown) => Math.min(INT_MAX, Math.round(v as number));

export function cleanSolve(v: unknown): Solve | null {
  const s = v as Partial<Solve> | null;
  if (!s || !str(s.id, 100) || !s.id || !time(s.ms) || !time(s.at) || !str(s.session, 100)) return null;
  return {
    id: s.id,
    ms: ms(s.ms),
    penalty: PENALTIES.includes(s.penalty as Penalty) ? (s.penalty as Penalty) : "none",
    scramble: str(s.scramble, 1000) ? s.scramble : "",
    at: Math.round(s.at),
    session: s.session,
    inspectionMs: time(s.inspectionMs) ? ms(s.inspectionMs) : undefined,
    oll: optStr(s.oll, 50),
    pll: optStr(s.pll, 50),
  };
}

export function cleanDrillAttempt(v: unknown): DrillAttempt | null {
  const a = v as Partial<DrillAttempt> | null;
  if (!a || !str(a.id, 50) || !a.id || typeof a.ok !== "boolean" || !time(a.ms) || !time(a.at)) return null;
  return { id: a.id, ok: a.ok, ms: ms(a.ms), revealed: a.revealed === true, hinted: typeof a.hinted === "boolean" ? a.hinted : undefined, timed: a.timed === true || undefined, at: Math.round(a.at) };
}

export const cleanList = <T>(v: unknown, clean: (x: unknown) => T | null): T[] =>
  Array.isArray(v) ? v.map(clean).filter((x): x is T => x !== null) : [];
