"use client";

/**
 * Everything the app keeps (in this browser, or in your account when signed
 * in), as one file you can load elsewhere: progress, your algorithms, solves,
 * sessions, settings, the drill log, mode and theme.
 */

import { allItems, freezeSync, signedIn } from "./storage";
import { isDataKey } from "./user-data";

const APP = "last-layer";
const VERSION = 2;

export type Backup = { app: typeof APP; version: number; exportedAt: string; data: Record<string, unknown> };

const ours = isDataKey;

export function makeBackup(data: Record<string, unknown> = allItems()): Backup {
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

/** Replace your account's data with `data` (nothing, to start fresh). Reload afterwards. */
export async function replaceAccountData(data: Record<string, unknown>) {
  await freezeSync();
  const res = await fetch("/api/data/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`Import failed: ${res.status}`);
}

/**
 * Replace this browser's data (or your account's, when signed in) with the
 * backup's. Reload afterwards so every store rereads it.
 */
export async function restoreBackup(backup: Backup) {
  if (signedIn()) return replaceAccountData(backup.data);
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
