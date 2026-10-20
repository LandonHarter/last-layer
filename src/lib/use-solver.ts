"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { faceTurnsOnly } from "./notation";
import type { SolverRequest, SolverResponse } from "./solver.worker";

type Pending = Map<number, { resolve: (s: string) => void; reject: (e: Error) => void }>;

/**
 * The 3x3 two-phase solver in a web worker. `solve` takes any 3x3 alg (wide,
 * slice and rotation moves too) and returns face turns, at most 22 of them.
 * `scramble` gives a random-state scramble.
 */
export function useSolver() {
  const worker = useRef<Worker | null>(null);
  const pending = useRef<Pending>(new Map());
  const nextId = useRef(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const w = new Worker(new URL("./solver.worker.ts", import.meta.url), { type: "module" });
    const waiting = pending.current;
    w.onmessage = (e: MessageEvent<SolverResponse>) => {
      const p = waiting.get(e.data.id);
      if (!p) return;
      waiting.delete(e.data.id);
      if (!waiting.size) setBusy(false);
      if ("error" in e.data) p.reject(new Error(e.data.error));
      else p.resolve(e.data.result);
    };
    worker.current = w;
    return () => {
      w.terminate();
      worker.current = null;
      waiting.clear();
    };
  }, []);

  const send = useCallback((req: Omit<SolverRequest, "id">) => {
    const w = worker.current;
    if (!w) return Promise.reject(new Error("Solver isn't running"));
    const id = nextId.current++;
    setBusy(true);
    return new Promise<string>((resolve, reject) => {
      pending.current.set(id, { resolve, reject });
      w.postMessage({ ...req, id } as SolverRequest);
    });
  }, []);

  const solve = useCallback((alg: string) => send({ type: "solve", moves: faceTurnsOnly(alg) } as Omit<SolverRequest, "id">), [send]);
  const scramble = useCallback(() => send({ type: "scramble" }), [send]);
  return { solve, scramble, busy };
}
