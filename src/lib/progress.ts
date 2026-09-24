"use client";

import { useSyncExternalStore } from "react";

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
};

export type Progress = Record<string, Entry>;

const KEY = "last-layer:progress:v1";
const EMPTY: Progress = {};
const listeners = new Set<() => void>();
let cache: Progress | null = null;

function read(): Progress {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Progress;
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: Progress) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: keep the in-memory copy for this session.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

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

/** Every algorithm for a case: yours first, then the built-in list. */
export function allAlgs(alg: { algs: string[] }, entry: Entry): string[] {
  return [...new Set([...(entry.custom ?? []), ...alg.algs])];
}

/** The algorithm you use for a case, falling back to its default. */
export function mainAlg(alg: { algs: string[] }, entry: Entry): string {
  return entry.main && allAlgs(alg, entry).includes(entry.main) ? entry.main : alg.algs[0];
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

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Current progress outside React, for event handlers that just wrote to it. */
export const getProgress = (): Progress => read();
