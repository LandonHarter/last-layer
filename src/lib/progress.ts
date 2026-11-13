"use client";

import { ALGS_BY_ID, type Alg } from "@/data/algs";
import { f2lToSlot } from "./f2l-slot";
import { createStore } from "./store";

export type Status = "unknown" | "learning" | "learned";

export const STATUS_LABELS: Record<Status, string> = {
  unknown: "Don't know",
  learning: "In progress",
  learned: "Learned",
};

export type Entry = {
  status: Status;
  attempts: number;
  misses: number;
  /** Misses since the last success; drives how often a case comes back. */
  missStreak: number;
  lastSeen: number;
  /** The algorithm you use for this case. Unset means the case's default. */
  main?: string;
  /** Algorithms you added yourself. */
  custom?: string[];
  /** Your own notes for the case, shown as a hint in Drill. */
  notes?: string;
};

export type Progress = Record<string, Entry>;

const store = createStore<Progress>("last-layer:progress:v1", {});
const read = store.read;
const write = store.write;

export const blankEntry = (): Entry => ({ status: "unknown", attempts: 0, misses: 0, missStreak: 0, lastSeen: 0 });

export function entryFor(progress: Progress, id: string): Entry {
  return progress[id] ?? blankEntry();
}

export function setStatus(id: string, status: Status) {
  const current = read();
  write({ ...current, [id]: { ...entryFor(current, id), status } });
}

function update(id: string, change: (entry: Entry) => Entry) {
  const current = read();
  write({ ...current, [id]: change(entryFor(current, id)) });
}

export function setMain(id: string, alg: string) {
  update(id, (e) => ({ ...e, main: alg }));
}

export function addCustom(id: string, alg: string) {
  update(id, (e) => (e.custom?.includes(alg) ? e : { ...e, custom: [...(e.custom ?? []), alg] }));
}

export function removeCustom(id: string, alg: string) {
  update(id, (e) => ({
    ...e,
    custom: (e.custom ?? []).filter((a) => a !== alg),
    main: e.main === alg ? undefined : e.main,
  }));
}

export function setNotes(id: string, notes: string) {
  update(id, (e) => ({ ...e, notes: notes || undefined }));
}

/** Every algorithm for a case: yours first, then the built-in list. */
export function allAlgs(alg: { algs: string[] }, entry: Entry): string[] {
  return [...new Set([...(entry.custom ?? []), ...alg.algs])];
}

/** The algorithm you use for a case, falling back to its default. */
export function mainAlg(alg: { algs: string[] }, entry: Entry): string {
  return entry.main && allAlgs(alg, entry).includes(entry.main) ? entry.main : alg.algs[0];
}

/** Your front-right algs moved to this slot: shown with the slot's own list, and the default main until you pick one. */
function fromFrontRight(alg: Alg, progress: Progress): { custom: string[]; main?: string } {
  const base = alg.base && ALGS_BY_ID.get(alg.base);
  if (!base || !alg.slot) return { custom: [] };
  const entry = entryFor(progress, alg.base!);
  return {
    custom: (entry.custom ?? []).map((a) => f2lToSlot(a, alg.slot!)),
    main: entry.main && allAlgs(base, entry).includes(entry.main) ? f2lToSlot(entry.main, alg.slot) : undefined,
  };
}

/** Every algorithm for a case, F2L slots including your front-right ones moved over. */
export function algsFor(alg: Alg, progress: Progress): string[] {
  const own = entryFor(progress, alg.id);
  return [...new Set([...(own.custom ?? []), ...fromFrontRight(alg, progress).custom, ...alg.algs])];
}

/** The algorithm you use for a case. An F2L slot you haven't picked one for follows your front-right main. */
export function mainFor(alg: Alg, progress: Progress): string {
  const own = entryFor(progress, alg.id);
  if (own.main && algsFor(alg, progress).includes(own.main)) return own.main;
  return fromFrontRight(alg, progress).main ?? alg.algs[0];
}

export function recordAttempt(id: string, success: boolean) {
  const current = read();
  const entry = entryFor(current, id);
  write({
    ...current,
    [id]: {
      ...entry,
      attempts: entry.attempts + 1,
      misses: entry.misses + (success ? 0 : 1),
      missStreak: success ? 0 : entry.missStreak + 1,
      lastSeen: Date.now(),
    },
  });
}

export const useProgress = (): Progress => store.use();

/** Current progress outside React, for event handlers that just wrote to it. */
export const getProgress = (): Progress => read();
