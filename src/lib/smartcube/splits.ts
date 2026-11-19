import { ALGS } from "@/data/algs";
import { applyAlg, colorOf, f2lSolved, faceOf, isSolved, solvedCube, topOriented, type Face, type Sticker, type Vec } from "../cube";
import { AUFS } from "../cases";
import { opposite as OPPOSITE, recolourToCentres, rotationFor } from "./state";
import { decodeMoves, type TimedMove } from "./moves";

/**
 * CFOP splits of a recorded solve: replay the scramble and the turns, find the
 * first cross (any colour), then the F2L pairs, OLL and PLL on that cross.
 * Each step's time splits into recognition (from the step before finishing to
 * the first turn) and execution (first turn to done).
 */

export type StepName = "cross" | "f2l" | "oll" | "pll";
export type Step = {
  name: StepName | "pair";
  /** Index in the moves of the turn that finished the step; -1 when it was done before the first turn. */
  end: number;
  /** Moves of the step: from the one after the last step ended to `end`. */
  first: number;
  /** When it finished, ms from the first turn. */
  at: number;
  recogMs: number;
  execMs: number;
  moves: number;
  /** Done already when the step before finished. */
  skipped: boolean;
};

export type Splits = {
  cross: Face;
  /** Cross, F2L, OLL, PLL; only as far as the solve got. */
  steps: Step[];
  /** The four pairs, inside F2L. */
  pairs: Step[];
};

const home = (s: Sticker) => colorOf(s) === faceOf(s.normal);
const NORMALS: Record<Face, Vec> = { U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1] };
const axisOf = (n: Vec) => n.findIndex((v) => v !== 0);

/** Stickers of the pieces whose solved positions match `where`. */
function piecesHome(state: Sticker[], where: (pos: Vec) => boolean): boolean {
  return state.every((s) => !where(s.pos) || home(s));
}

function crossDone(state: Sticker[], face: Face): boolean {
  const n = NORMALS[face];
  const a = axisOf(n);
  return piecesHome(state, (p) => p[a] === n[a] && p.filter((v) => v !== 0).length === 2);
}

/** Pairs solved on top of the `face` cross. */
function pairsDone(state: Sticker[], face: Face): number {
  const n = NORMALS[face];
  const a = axisOf(n);
  const [i, j] = [0, 1, 2].filter((k) => k !== a);
  let count = 0;
  for (const di of [-1, 1])
    for (const dj of [-1, 1])
      if (piecesHome(state, (p) => p[i] === di && p[j] === dj && p[a] !== -n[a])) count++;
  return count;
}

function f2lDone(state: Sticker[], face: Face): boolean {
  const n = NORMALS[face];
  const a = axisOf(n);
  return piecesHome(state, (p) => p[a] !== -n[a]);
}

function ollDone(state: Sticker[], face: Face): boolean {
  const n = NORMALS[face];
  const a = axisOf(n);
  const top = state.filter((s) => s.normal[a] === -n[a]);
  return f2lDone(state, face) && top.every((s) => colorOf(s) === colorOf(top[0]));
}

const FACES: Face[] = ["D", "U", "F", "B", "R", "L"];

export function computeSplits(scramble: string, moves: TimedMove[]): Splits | null {
  let state = applyAlg(solvedCube(), scramble);
  const states = [state];
  for (const m of moves) {
    state = applyAlg(state, m.move);
    states.push(state);
  }
  // states[k + 1] is after move k. The cross is the colour whose F2L is done first.
  const firstIndex = (test: (s: Sticker[]) => boolean, from = 0) => {
    for (let k = from; k < states.length; k++) if (test(states[k])) return k;
    return -1;
  };
  let cross: Face | null = null;
  let f2lAt = Infinity;
  for (const f of FACES) {
    const k = firstIndex((s) => f2lDone(s, f));
    if (k >= 0 && k < f2lAt) [cross, f2lAt] = [f, k];
  }
  if (!cross) {
    // No F2L: take the first cross, if any, for a partial split.
    let crossAt = Infinity;
    for (const f of FACES) {
      const k = firstIndex((s) => crossDone(s, f));
      if (k >= 0 && k < crossAt) [cross, crossAt] = [f, k];
    }
    if (!cross) return null;
  }
  const face = cross;
  const marks: [StepName, number][] = [];
  const crossAt = firstIndex((s) => crossDone(s, face));
  marks.push(["cross", crossAt]);
  const f2l = firstIndex((s) => f2lDone(s, face), crossAt);
  if (f2l >= 0) {
    marks.push(["f2l", f2l]);
    const oll = firstIndex((s) => ollDone(s, face), f2l);
    if (oll >= 0) {
      marks.push(["oll", oll]);
      const pll = firstIndex(isSolved, oll);
      if (pll >= 0) marks.push(["pll", pll]);
    }
  }
  const time = (k: number) => (k <= 0 ? 0 : moves[k - 1].t);
  const step = (name: Step["name"], prev: number, at: number): Step => {
    const skipped = at === prev;
    const firstT = skipped ? time(at) : moves[prev].t;
    return {
      name,
      end: at - 1,
      first: prev,
      at: time(at),
      recogMs: skipped || name === "cross" ? 0 : firstT - time(prev),
      execMs: skipped ? 0 : time(at) - (name === "cross" ? 0 : firstT),
      moves: at - prev,
      skipped,
    };
  };
  const steps: Step[] = [];
  let prev = 0;
  for (const [name, at] of marks) {
    steps.push(step(name, prev, at));
    prev = at;
  }
  const pairs: Step[] = [];
  if (f2l >= 0) {
    let p = crossAt;
    for (let n = 1; n <= 4; n++) {
      const at = firstIndex((s) => crossDone(s, face) && pairsDone(s, face) >= n, p);
      if (at < 0 || at > f2l) break;
      pairs.push(step("pair", p, at));
      p = at;
    }
  }
  return { cross: face, steps, pairs };
}

/** The state turned so the cross is down, recoloured so checks read colours relative to the centres. */
function crossDown(state: Sticker[], cross: Face): Sticker[] {
  // Only face turns reach here, so each centre is still on its own face.
  const front = (["F", "R", "B", "L"] as Face[]).find((f) => f !== cross && f !== OPPOSITE[cross]) ?? "F";
  return recolourToCentres(applyAlg(state, rotationFor(OPPOSITE[cross], front)!));
}

const OLLS = ALGS.filter((a) => a.set === "OLL");
const PLLS = ALGS.filter((a) => a.set === "PLL");

/** The OLL case at this state (F2L done on `cross`), or null for a skip. */
export function identifyOll(state: Sticker[], cross: Face): string | null {
  const s = crossDown(state, cross);
  if (topOriented(s)) return null;
  for (const c of OLLS)
    for (const auf of AUFS) {
      const after = applyAlg(s, `${auf} ${c.algs[0]}`);
      if (f2lSolved(after) && topOriented(after)) return c.id;
    }
  return null;
}

/** The PLL case at this state (OLL done on `cross`), or null for a skip. */
export function identifyPll(state: Sticker[], cross: Face): string | null {
  const s = crossDown(state, cross);
  if (AUFS.some((a) => isSolved(applyAlg(s, a)))) return null;
  for (const c of PLLS)
    for (const before of AUFS) {
      const after = applyAlg(s, `${before} ${c.algs[0]}`);
      if (AUFS.some((a) => isSolved(applyAlg(after, a)))) return c.id;
    }
  return null;
}

/** OLL and PLL cases a recorded solve had (undefined where skipped or not reached). */
export function identifyCases(scramble: string, moves: TimedMove[], splits: Splits | null = computeSplits(scramble, moves)) {
  if (!splits) return {};
  const at = (name: StepName) => splits.steps.find((s) => s.name === name);
  const stateAfter = (k: number) => applyAlg(applyAlg(solvedCube(), scramble), moves.slice(0, k + 1).map((m) => m.move).join(" "));
  const f2l = at("f2l");
  const oll = at("oll");
  return {
    oll: f2l ? identifyOll(stateAfter(f2l.end), splits.cross) ?? undefined : undefined,
    pll: oll ? identifyPll(stateAfter(oll.end), splits.cross) ?? undefined : undefined,
  };
}

const cache = new WeakMap<object, Splits | null>();

/** Splits of a saved smart cube solve, worked out once per solve object. Null without moves or a CFOP shape. */
export function splitsOf(solve: { scramble: string; moves?: string }): Splits | null {
  if (!solve.moves) return null;
  if (cache.has(solve)) return cache.get(solve)!;
  let result: Splits | null = null;
  try {
    result = computeSplits(solve.scramble, decodeMoves(solve.moves));
  } catch {
    result = null;
  }
  cache.set(solve, result);
  return result;
}
