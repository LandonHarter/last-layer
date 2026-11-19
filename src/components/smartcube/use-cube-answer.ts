"use client";

import { useEffect, useRef, useState } from "react";
import type { Alg } from "@/data/algs";
import { CaseAttempt, type AttemptResult } from "@/lib/smartcube/matcher";
import { onGripTurn, useSmartCube } from "@/lib/smartcube/store";

/**
 * Answer a case by doing its algorithm on a connected smart cube (3x3 cases
 * only). A new attempt starts whenever `round` changes. `onResult` is called
 * once per attempt: solved, too many turns, or a long pause.
 */
export function useCubeAnswer(alg: Alg, main: string, round: unknown, enabled: boolean, onResult: (r: AttemptResult) => void) {
  const cube = useSmartCube();
  const active = enabled && cube.status === "connected" && alg.puzzle === "3x3";
  const attempt = useRef<CaseAttempt | null>(null);
  const [turns, setTurns] = useState(0);
  const callback = useRef(onResult);
  callback.current = onResult;

  useEffect(() => {
    if (!active) {
      attempt.current = null;
      return;
    }
    const a = new CaseAttempt(alg, main, performance.now());
    attempt.current = a;
    setTurns(0);
    const done = (r: AttemptResult | null) => {
      if (!r || attempt.current !== a) return;
      attempt.current = null;
      callback.current(r);
    };
    const off = onGripTurn((move, at) => {
      if (attempt.current !== a) return;
      const r = a.turn(move, at);
      setTurns(a.moves.length);
      done(r);
    });
    const timer = window.setInterval(() => done(a.tick(performance.now())), 250);
    return () => {
      off();
      window.clearInterval(timer);
    };
    // A new round (or case) starts a new attempt; the alg object is stable per case.
  }, [active, alg, main, round]);

  return {
    active,
    turns,
    /** Answering by hand: the times so far, if turning had started. */
    take(): AttemptResult | null {
      const a = attempt.current;
      if (!a) return null;
      attempt.current = null;
      return a.started ? a.giveUp(performance.now()) : null;
    },
  };
}
