"use client";

import { useSyncExternalStore } from "react";

/**
 * A value kept in localStorage and shared by every component that reads it,
 * the same way `progress.ts` works. Object values are merged over `fallback`,
 * so new fields get their defaults.
 */
export function createStore<T>(key: string, fallback: T) {
  const listeners = new Set<() => void>();
  let cache: T | undefined;

  function read(): T {
    if (cache !== undefined) return cache;
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw === null ? fallback : (JSON.parse(raw) as T);
      cache = isPlainObject(fallback) && isPlainObject(parsed) ? { ...fallback, ...parsed } : parsed;
    } catch {
      cache = fallback;
    }
    return cache as T;
  }

  function write(next: T) {
    cache = next;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Storage full or blocked: keep the in-memory copy for this session.
    }
    listeners.forEach((l) => l());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
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
