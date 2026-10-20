"use client";

import { useSyncExternalStore } from "react";
import { readItem, signedIn, writeItem } from "./storage";

/**
 * A value kept in localStorage (or the account, when signed in; see
 * `storage.ts`) and shared by every component that reads it. Object values
 * are merged over `fallback`, so new fields get their defaults.
 */
export function createStore<T>(key: string, fallback: T) {
  const listeners = new Set<() => void>();
  let cache: T | undefined;

  function read(): T {
    if (cache !== undefined) return cache;
    try {
      const stored = readItem(key) as T | undefined;
      const parsed = stored === undefined || stored === null ? fallback : stored;
      cache = isPlainObject(fallback) && isPlainObject(parsed) ? { ...fallback, ...parsed } : parsed;
    } catch {
      cache = fallback;
    }
    return cache as T;
  }

  function write(next: T) {
    cache = next;
    writeItem(key, next);
    listeners.forEach((l) => l());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    // Another tab changed this browser's data. Signed in, localStorage isn't used.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || signedIn()) return;
      cache = undefined;
      listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  return {
    read,
    write,
    update: (change: (current: T) => T) => write(change(read())),
    use: () => useSyncExternalStore(subscribe, read, () => fallback),
  };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
