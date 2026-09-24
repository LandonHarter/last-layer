"use client";

import { createStore } from "./store";

/** The app has two halves: learning algorithms, and timing full solves. */
export type Mode = "algs" | "timer";

const modeStore = createStore<Mode>("last-layer:mode:v1", "algs");
export const useStoredMode = modeStore.use;
export const setStoredMode = (mode: Mode) => modeStore.write(mode);

export const MODE_HOME: Record<Mode, string> = { algs: "/", timer: "/timer" };

/** Pages that belong to one mode. Analyze belongs to both and follows the stored mode. */
export function modeForPath(pathname: string): Mode | null {
  if (pathname.startsWith("/timer")) return "timer";
  if (pathname.startsWith("/analyze")) return null;
  return "algs";
}
