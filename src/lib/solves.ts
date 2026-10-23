"use client";

import { isTimerPuzzle, type TimerPuzzle } from "./scramble";
import { DNF } from "./stats";
import { createStore } from "./store";

export type Penalty = "none" | "+2" | "dnf";

export type Solve = {
  id: string;
  /** Raw time on the clock, in ms, before any penalty. */
  ms: number;
  penalty: Penalty;
  scramble: string;
  /** When the solve finished (epoch ms). */
  at: number;
  session: string;
  /** Inspection used, in ms, when inspection was on. */
  inspectionMs?: number;
  /** OLL case you solved it with, like `oll-21`. Optional. */
  oll?: string;
  /** PLL case you solved it with, like `pll-t`. Optional. */
  pll?: string;
  /** Counted toward that day's daily average of this many solves (see `daily.ts`). */
  daily?: number;
};

/** The last-layer steps a solve can be tagged with. */
export type SolveStep = "oll" | "pll";

/** A group of solves on one puzzle. Sessions saved before puzzles existed are 3x3. */
export type Session = { id: string; name: string; puzzle?: TimerPuzzle };

export const sessionPuzzle = (s: Session | undefined): TimerPuzzle => (isTimerPuzzle(s?.puzzle) ? s.puzzle : "3x3");

type TimerData = { solves: Solve[]; sessions: Session[]; current: string };

const MAIN: Session = { id: "main", name: "Main" };
const timerStore = createStore<TimerData>("last-layer:timer:v1", { solves: [], sessions: [MAIN], current: MAIN.id });

export const useTimerData = timerStore.use;
export const getTimerData = timerStore.read;

export type TimerSettings = {
  /** How long Space must be held before the timer is ready. */
  holdMs: number;
  /** WCA inspection: 15 s, +2 after 15, DNF after 17. */
  inspection: boolean;
  /** Show the running time, or just "Solving". */
  showRunning: boolean;
  /** Start and stop with Space (or a tap), read a Stackmat plugged into an audio input, or type each time in. */
  input: "keyboard" | "stackmat" | "typing";
  /** The audio input the Stackmat is on; empty for the default one. */
  stackmatDevice: string;
};

const settingsStore = createStore<TimerSettings>("last-layer:timer-settings:v1", {
  holdMs: 300,
  inspection: false,
  showRunning: true,
  input: "keyboard",
  stackmatDevice: "",
});
export const useTimerSettings = settingsStore.use;
export const updateTimerSettings = (change: Partial<TimerSettings>) => settingsStore.update((s) => ({ ...s, ...change }));

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export function addSolve(solve: Omit<Solve, "id" | "session">): Solve {
  const full = { ...solve, id: newId(), session: timerStore.read().current };
  timerStore.update((d) => ({ ...d, solves: [...d.solves, full] }));
  return full;
}

export function setPenalty(id: string, penalty: Penalty) {
  timerStore.update((d) => ({ ...d, solves: d.solves.map((s) => (s.id === id ? { ...s, penalty } : s)) }));
}

/** Tag a solve with the OLL or PLL case it had, or clear it with undefined. */
export function setSolveCase(id: string, step: SolveStep, caseId: string | undefined) {
  timerStore.update((d) => ({ ...d, solves: d.solves.map((s) => (s.id === id ? { ...s, [step]: caseId } : s)) }));
}

/** Tag solves as part of a daily average, or untag them with undefined. */
export function setSolvesDaily(ids: string[], size: number | undefined) {
  const set = new Set(ids);
  timerStore.update((d) => ({ ...d, solves: d.solves.map((s) => (set.has(s.id) ? { ...s, daily: size } : s)) }));
}

export function deleteSolve(id: string) {
  timerStore.update((d) => ({ ...d, solves: d.solves.filter((s) => s.id !== id) }));
}

/** Put a deleted solve back where it was, for undo. */
export function restoreSolve(solve: Solve) {
  timerStore.update((d) => ({ ...d, solves: [...d.solves, solve].sort((a, b) => a.at - b.at) }));
}

export function setCurrentSession(id: string) {
  timerStore.update((d) => ({ ...d, current: id }));
}

export function addSession(name: string, puzzle: TimerPuzzle = "3x3"): Session {
  const session = { id: newId(), name, puzzle };
  timerStore.update((d) => ({ ...d, sessions: [...d.sessions, session], current: session.id }));
  return session;
}

export function renameSession(id: string, name: string) {
  timerStore.update((d) => ({ ...d, sessions: d.sessions.map((s) => (s.id === id ? { ...s, name } : s)) }));
}

/** Change the puzzle a session scrambles for. Its solves stay. */
export function setSessionPuzzle(id: string, puzzle: TimerPuzzle) {
  timerStore.update((d) => ({ ...d, sessions: d.sessions.map((s) => (s.id === id ? { ...s, puzzle } : s)) }));
}

/**
 * Removes a session and its solves. Removing the last one leaves a fresh,
 * empty session in its place; its id is returned so undo can drop it again.
 */
export function deleteSession(id: string): string | null {
  let standIn: string | null = null;
  timerStore.update((d) => {
    let sessions = d.sessions.filter((s) => s.id !== id);
    if (!sessions.length) {
      standIn = newId();
      sessions = [{ id: standIn, name: MAIN.name, puzzle: "3x3" }];
    }
    return { solves: d.solves.filter((s) => s.session !== id), sessions, current: d.current === id ? sessions[0].id : d.current };
  });
  return standIn;
}

/** Put a deleted session and its solves back, for undo. */
export function restoreSession(session: Session, solves: Solve[], wasCurrent: boolean, standIn: string | null) {
  timerStore.update((d) => {
    const unused = (id: string) => id === standIn && !d.solves.some((s) => s.session === id);
    const sessions = [...d.sessions.filter((s) => s.id !== session.id && !unused(s.id)), session];
    return {
      sessions,
      solves: [...d.solves, ...solves].sort((a, b) => a.at - b.at),
      current: wasCurrent || !sessions.some((s) => s.id === d.current) ? session.id : d.current,
    };
  });
}

/** Merge solves from an export, skipping ids already present. */
export function importTimerData(data: Partial<TimerData>) {
  timerStore.update((d) => {
    const ids = new Set(d.solves.map((s) => s.id));
    const sessionIds = new Set(d.sessions.map((s) => s.id));
    return {
      ...d,
      sessions: [...d.sessions, ...(data.sessions ?? []).filter((s) => !sessionIds.has(s.id))],
      solves: [...d.solves, ...(data.solves ?? []).filter((s) => !ids.has(s.id))].sort((a, b) => a.at - b.at),
    };
  });
}

/** Time that counts, in ms: +2 adds two seconds, DNF is Infinity. */
export function effectiveMs(s: Pick<Solve, "ms" | "penalty">): number {
  return s.penalty === "dnf" ? DNF : s.penalty === "+2" ? s.ms + 2000 : s.ms;
}

/** 12.34, 1:02.34, DNF. Pass decimals 1 while the clock runs if you like. */
export function formatMs(ms: number | null | undefined, decimals = 2): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "–";
  if (!Number.isFinite(ms)) return "DNF";
  const scale = 10 ** decimals;
  // Truncate like a stackmat rather than rounding up.
  const total = Math.floor(ms / (1000 / scale) + 1e-9) / scale;
  const minutes = Math.floor(total / 60);
  const seconds = total - minutes * 60;
  const s = seconds.toFixed(decimals);
  return minutes ? `${minutes}:${seconds < 10 ? "0" : ""}${s}` : s;
}

export function formatSolve(s: Pick<Solve, "ms" | "penalty">): string {
  if (s.penalty === "dnf") return "DNF";
  return s.penalty === "+2" ? `${formatMs(s.ms + 2000)}+` : formatMs(s.ms);
}

// ---------------------------------------------------------------------------
// Drill log: one entry per Missed / Got it in a drill, for Analyze.

export type DrillAttempt = {
  /** Case id, like `pll-t`. */
  id: string;
  ok: boolean;
  /** From the case appearing to the answer, in ms. Timed drills: from "Set up" to "Done", recognition plus execution. */
  ms: number;
  /** Whether the algorithm was revealed before answering. */
  revealed: boolean;
  /** Whether your notes were shown as a hint before answering. */
  hinted?: boolean;
  /** Whether it was a timed drill, with the case image hidden. */
  timed?: boolean;
  at: number;
};

const drillStore = createStore<DrillAttempt[]>("last-layer:drill-log:v1", []);
export const useDrillLog = drillStore.use;
export const logDrillAttempt = (a: DrillAttempt) => drillStore.update((log) => [...log, a]);
export const clearDrillLog = () => drillStore.write([]);
