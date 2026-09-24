"use client";

/**
 * Everything the app keeps in localStorage, as one file you can load in
 * another browser: progress, your algorithms, solves, sessions, settings, the
 * drill log, mode and theme.
 */

const PREFIX = "last-layer:";
// next-themes keeps the theme under this key.
const EXTRA_KEYS = ["theme"];
const APP = "last-layer";
const VERSION = 2;

export type Backup = { app: typeof APP; version: number; exportedAt: string; data: Record<string, unknown> };

const ours = (key: string) => key.startsWith(PREFIX) || EXTRA_KEYS.includes(key);

export function makeBackup(): Backup {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !ours(key)) continue;
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      data[key] = raw;
    }
  }
  return { app: APP, version: VERSION, exportedAt: new Date().toISOString(), data };
}

export function downloadBackup() {
  const date = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(new Blob([JSON.stringify(makeBackup())], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `last-layer-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Parse a backup file; throws if it isn't one. */
export function parseBackup(text: string): Backup {
  const parsed = JSON.parse(text) as Partial<Backup>;
  if (parsed?.app !== APP || typeof parsed.data !== "object" || parsed.data === null) throw new Error("Not a Last Layer backup");
  const keys = Object.keys(parsed.data);
  if (!keys.length || !keys.every(ours)) throw new Error("Not a Last Layer backup");
  return parsed as Backup;
}

/** Replace this browser's data with the backup's. Reload afterwards so every store rereads it. */
export function restoreBackup(backup: Backup) {
  const existing: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && ours(key)) existing.push(key);
  }
  existing.forEach((key) => localStorage.removeItem(key));
  for (const [key, value] of Object.entries(backup.data)) {
    localStorage.setItem(key, typeof value === "string" && key === "theme" ? value : JSON.stringify(value));
  }
}
