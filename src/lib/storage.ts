"use client";

/**
 * Where the stores keep their values. Signed out, that is localStorage, as
 * before. Signed in, it is the account: values are loaded with the page and
 * changes are sent to `/api/data` shortly after they happen. localStorage is
 * left alone while signed in.
 */

import { useSyncExternalStore } from "react";
import { THEME_KEY, diffKey, isDataKey, isEmptyOps, type SyncOps } from "./user-data";

type Account = {
  data: Record<string, unknown>;
  /** What the server has, as far as we know: the values last sent and accepted. */
  saved: Map<string, unknown>;
  dirty: Set<string>;
};

let account: Account | null = null;

/** Switch to the account's data. Called once, before anything reads a store. */
export function startAccount(data: Record<string, unknown>) {
  if (account || typeof window === "undefined") return;
  account = { data: { ...data }, saved: new Map(Object.entries(data)), dirty: new Set() };
  window.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  window.addEventListener("pagehide", () => flush());
  window.addEventListener("beforeunload", (e) => {
    if (busy()) e.preventDefault();
  });
}

export const signedIn = () => account !== null;

/** A stored value, or undefined if there is none. */
export function readItem(key: string): unknown {
  if (account) return account.data[key];
  const raw = localStorage.getItem(key);
  if (raw === null) return undefined;
  // next-themes keeps the theme as a bare string.
  if (key === THEME_KEY) return raw;
  return JSON.parse(raw);
}

export function writeItem(key: string, value: unknown) {
  if (account) {
    account.data[key] = value;
    account.dirty.add(key);
    schedule();
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the store keeps its in-memory copy for this session.
  }
}

/** Every value the app keeps, for a backup. */
export function allItems(): Record<string, unknown> {
  if (account) return { ...account.data };
  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !isDataKey(key)) continue;
    try {
      data[key] = readItem(key);
    } catch {
      data[key] = localStorage.getItem(key);
    }
  }
  return data;
}

/** This browser's own data, whether or not you're signed in. For moving it into an account. */
export function localItems(): Record<string, unknown> {
  const current = account;
  account = null;
  try {
    return allItems();
  } finally {
    account = current;
  }
}

// ---------------------------------------------------------------------------
// Sending changes

export type SyncStatus = "saved" | "saving" | "retrying";
let status: SyncStatus = "saved";
const statusListeners = new Set<() => void>();
function setStatus(next: SyncStatus) {
  if (next === status) return;
  status = next;
  statusListeners.forEach((l) => l());
}
const subscribeStatus = (l: () => void) => {
  statusListeners.add(l);
  return () => statusListeners.delete(l);
};
export const useSyncStatus = () => useSyncExternalStore(subscribeStatus, () => status, () => "saved" as const);

const DEBOUNCE_MS = 500;
// keepalive requests (which survive closing the tab) are capped at 64 KB.
const KEEPALIVE_MAX = 60 * 1024;
let timer: number | undefined;
let inFlight: Promise<void> | null = null;
let failures = 0;
let frozen = false;

const busy = () => !!account && (account.dirty.size > 0 || inFlight !== null);

function schedule(delay = DEBOUNCE_MS) {
  window.clearTimeout(timer);
  timer = window.setTimeout(flush, delay);
  if (status === "saved") setStatus("saving");
}

/** Send whatever changed now. Resolves once it is saved (or has failed and been queued again). */
export function flush(): Promise<void> {
  window.clearTimeout(timer);
  if (!account || frozen) return Promise.resolve();
  if (inFlight) return inFlight.then(() => (account?.dirty.size ? flush() : undefined));
  const acc = account;
  if (!acc.dirty.size) return Promise.resolve();

  const ops: SyncOps = { docs: {} };
  const sent = new Map<string, unknown>();
  for (const key of acc.dirty) {
    diffKey(ops, key, acc.saved.get(key), acc.data[key]);
    sent.set(key, acc.data[key]);
  }
  acc.dirty.clear();
  if (isEmptyOps(ops)) {
    sent.forEach((v, k) => acc.saved.set(k, v));
    setStatus("saved");
    return Promise.resolve();
  }

  const body = JSON.stringify(ops);
  if (!failures) setStatus("saving");
  inFlight = fetch("/api/data", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: body.length < KEEPALIVE_MAX,
  })
    .then((res) => {
      if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
      sent.forEach((v, k) => acc.saved.set(k, v));
      failures = 0;
    })
    .catch(() => {
      // Send these keys again later, diffed against what the server last accepted.
      sent.forEach((_, k) => acc.dirty.add(k));
      failures++;
      setStatus("retrying");
    })
    .finally(() => {
      inFlight = null;
      if (acc.dirty.size) schedule(failures ? Math.min(30000, 1000 * 2 ** failures) : DEBOUNCE_MS);
      else setStatus("saved");
    });
  return inFlight;
}

/** Wait for pending changes, then stop sending: the account's data is about to be replaced. */
export async function freezeSync() {
  await flush();
  frozen = true;
  window.clearTimeout(timer);
}
