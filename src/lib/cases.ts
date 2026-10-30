import { applyAlg, colorOf, f2lSolved, isSolved, keepsOrientation, solvedCube, topCornersSolved, topEdgesOriented, topOriented, type Sticker } from "./cube";
import { CFOP_SETS, isCfopSet } from "./cfop-sets";
import {
  megaApply,
  megaEdgesPlaced,
  megaF2LSolved,
  megaIsSolved,
  megaKeepsOrientation,
  megaOriented,
  megaSolved,
} from "./megaminx";
import { invertAlg, parseAlg, simplifyAlg, type Notation } from "./notation";
import { applyMoves, belowTopSolved, bestOrientation, facesUniform, isSolvedState, keepsOrientationN, solvedState, topReduced } from "./nxn";
import { CUBE_SIZE, notationOf, puzzleOf, type AlgSet } from "./puzzles";
import {
  sq1Apply,
  sq1CornersPermuted,
  sq1CubeShape,
  sq1Oriented,
  sq1Solved,
  sq1Solved1,
  SQ1_ALL_TURNS,
  SQ1_AUFS,
  type Sq1State,
} from "./sq1";

export type { AlgSet };

/** What the case checks need to know about a case. */
export type CaseLike = { set: AlgSet; group: string; algs: string[] };

export const AUFS = ["", "U", "U2", "U'"] as const;
export const MEGA_AUFS = ["", "U", "U2", "U2'", "U'"] as const;

/**
 * How one kind of case is checked: a simulator, the step it finishes, and the
 * turns you may make before (and for a step that ends solved, after) the alg.
 */
type Engine = {
  notation: Notation;
  /** The state after `alg` from solved. */
  start: (alg: string) => unknown;
  apply: (state: unknown, alg: string) => unknown;
  done: (state: unknown) => boolean;
  keepsOrientation: (alg: string) => boolean;
  before: readonly string[];
  after: readonly string[];
  /** The step ends with the puzzle solved (up to turns of the layers), even with no turns listed after. */
  endsSolved?: boolean;
};

const cube3 = (done: (s: Sticker[]) => boolean, after: readonly string[]): Engine => ({
  notation: "cube",
  start: (alg) => applyAlg(solvedCube(), alg),
  apply: (s, alg) => applyAlg(s as Sticker[], alg),
  done: (s) => done(s as Sticker[]),
  keepsOrientation,
  before: AUFS,
  after,
});

const nxn = (n: number, done: (s: Uint8Array) => boolean, before: readonly string[], after: readonly string[]): Engine => ({
  notation: "cube",
  start: (alg) => (n === 2 ? bestOrientation(applyMoves(solvedState(n), alg, n), n) : applyMoves(solvedState(n), alg, n)),
  apply: (s, alg) => applyMoves(s as Uint8Array, alg, n),
  done: (s) => done(s as Uint8Array),
  keepsOrientation: (alg) => keepsOrientationN(alg, n),
  before,
  after,
});

const mega = (done: (s: Uint8Array) => boolean, after: readonly string[]): Engine => ({
  notation: "megaminx",
  start: (alg) => megaApply(megaSolved(), alg),
  apply: (s, alg) => megaApply(s as Uint8Array, alg),
  done: (s) => done(s as Uint8Array),
  keepsOrientation: megaKeepsOrientation,
  before: MEGA_AUFS,
  after,
});

// Square-1: a slice that turns while blocked leaves the state broken, which no step counts as done.
// Each check allows any turn of the layers at the end, so `after` stays empty.
const sq1 = (done: (s: Sq1State) => boolean, before: readonly string[], endsSolved = false): Engine => ({
  notation: "sq1",
  start: (alg) => sq1Apply(sq1Solved(), alg),
  apply: (s, alg) => sq1Apply(s as Sq1State, alg),
  done: (s) => done(s as Sq1State),
  // The Square-1 has no rotations in its notation, so every alg keeps the hold.
  keepsOrientation: () => true,
  before,
  after: [""],
  endsSolved,
});

// PBL turns both layers: any turn of the top with any turn of the bottom.
const BOTH_LAYERS = AUFS.flatMap((u) => AUFS.map((d) => `${u} ${d.replace("U", "D")}`.trim()));

const engines = new Map<string, Engine>();

/** The checks for a case. Big-cube parity sets mix OLL parity (ends reduced) with cases that end solved. */
export function engineFor(c: Pick<CaseLike, "set" | "group">): Engine {
  const key = `${c.set}|${c.group}`;
  let engine = engines.get(key);
  if (engine) return engine;
  const n = CUBE_SIZE[puzzleOf(c.set)] ?? 0;
  if (isCfopSet(c.set)) {
    const goal = CFOP_SETS[c.set].goal;
    engine = goal === "solved" ? { ...cube3(isSolved, AUFS), endsSolved: true }
      : goal === "corners" ? cube3((s) => f2lSolved(s) && topOriented(s) && topCornersSolved(s), AUFS)
      : goal === "edges" ? cube3((s) => f2lSolved(s) && topEdgesOriented(s), [""])
      : cube3((s) => f2lSolved(s) && topOriented(s), [""]);
    engines.set(key, engine);
    return engine;
  }
  switch (c.set) {
    case "F2L":
      engine = cube3(f2lSolved, [""]);
      break;
    case "OLL":
      engine = cube3((s) => f2lSolved(s) && topOriented(s), [""]);
      break;
    case "PLL":
      engine = { ...cube3(isSolved, AUFS), endsSolved: true };
      break;
    case "2x2-OLL":
      // Ortega: top and bottom one colour each; the layers can be out of order.
      engine = nxn(2, (s) => uniform(s, 2, 0) && uniform(s, 2, 1), AUFS, [""]);
      break;
    case "2x2-PBL":
      engine = nxn(2, (s) => facesUniform(s, 2), BOTH_LAYERS, BOTH_LAYERS);
      break;
    case "mega-EO":
      engine = mega((s) => megaF2LSolved(s) && megaOriented(s, false), [""]);
      break;
    case "mega-CO":
      engine = mega((s) => megaF2LSolved(s) && megaOriented(s, true), [""]);
      break;
    case "mega-EP":
      engine = mega((s) => megaF2LSolved(s) && megaOriented(s, true) && megaEdgesPlaced(s), MEGA_AUFS);
      break;
    case "mega-CP":
      engine = mega(megaIsSolved, MEGA_AUFS);
      break;
    case "sq1-CS":
      // Out of shape, any turn of either layer is the same case.
      engine = sq1(sq1CubeShape, SQ1_ALL_TURNS);
      break;
    case "sq1-CO":
      engine = sq1((s) => sq1Oriented(s, false), SQ1_AUFS);
      break;
    case "sq1-EO":
      engine = sq1((s) => sq1Oriented(s, true), SQ1_AUFS);
      break;
    case "sq1-CP":
      engine = sq1(sq1CornersPermuted, SQ1_AUFS);
      break;
    case "sq1-EP":
    case "sq1-parity":
      engine = sq1(sq1Solved1, SQ1_AUFS, true);
      break;
    default:
      engine =
        c.group === "OLL parity"
          ? nxn(n, (s) => belowTopSolved(s, n) && topReduced(s, n), AUFS, [""])
          : nxn(n, isSolvedState, AUFS, AUFS);
  }
  engines.set(key, engine);
  return engine;
}

/** Face `face` (index in FACES order) shows a single colour. */
function uniform(s: Uint8Array, n: number, face: number): boolean {
  const start = face * n * n;
  for (let i = start; i < start + n * n; i++) if (s[i] !== s[start]) return false;
  return true;
}

/** The step a case's algorithm finishes. */
export function stepDone(c: Pick<CaseLike, "set" | "group">, state: unknown): boolean {
  return engineFor(c).done(state);
}

/** The state a case starts from: undo its reference algorithm on a solved puzzle. */
export function caseState(c: CaseLike, reference: string = c.algs[0]): unknown {
  const engine = engineFor(c);
  return engine.start(invertAlg(reference, engine.notation));
}

/** 3x3 only: the case's state as stickers, for the sticker-level checks in tests. */
export function caseStickers(reference: string): Sticker[] {
  return applyAlg(solvedCube(), invertAlg(reference));
}

/** Canonical 3x3 recognition key, ignoring pieces the step deliberately leaves unsolved.
 * Both starting AUF and ending AUF are included, so symmetric cases collapse too.
 */
export function cubeCaseKey(c: CaseLike): string {
  const engine = engineFor(c);
  const home = solvedCube();
  const goal = isCfopSet(c.set) ? CFOP_SETS[c.set].goal : c.set === "PLL" ? "solved" : c.set === "F2L" ? "pair" : "orientation";
  const undo = invertAlg(c.algs[0]);
  const keys: string[] = [];
  for (const after of engine.after) for (const before of engine.before) {
    const state = applyAlg(solvedCube(), `${after} ${undo} ${before}`);
    const slots = state.map((s) => {
      const origin = home[s.id];
      const corner = origin.pos.every((v) => v !== 0);
      const pair = origin.pos[0] === 1 && origin.pos[2] === 1 && origin.pos[1] < 1;
      const color = colorOf(s);
      const value = goal === "solved" || (goal === "corners" && corner) || pair ? color
        : goal === "pair" ? "_"
        : color === "U" && (goal === "orientation" || !corner) ? "U" : "_";
      return `${s.pos.join(",")}/${s.normal.join(",")}:${value}`;
    }).sort();
    keys.push(slots.join("|"));
  }
  return keys.sort()[0];
}

/**
 * If `candidate` solves the case, return it with any turn of the top needed
 * first (and, for steps that end solved, after) so it solves the case exactly
 * as pictured. Otherwise null.
 */
export function fitAlg(c: CaseLike, candidate: string, reference: string = c.algs[0]): string | null {
  const engine = engineFor(c);
  let clean: string;
  try {
    clean = simplifyAlg(candidate, engine.notation);
    if (!clean || !engine.keepsOrientation(clean)) return null;
  } catch {
    return null;
  }
  const start = caseState(c, reference);
  for (const before of engine.before) {
    const state = engine.apply(start, `${before} ${clean}`);
    for (const after of engine.after) {
      if (engine.done(after ? engine.apply(state, after) : state)) {
        return simplifyAlg(`${before} ${clean} ${after}`, engine.notation);
      }
    }
  }
  return null;
}

/** True when doing `setup` from solved, then some turn of the top, then `alg`, finishes the step. */
export function setupWorks(c: Pick<CaseLike, "set" | "group">, setup: string, alg: string): boolean {
  const engine = engineFor(c);
  const state = engine.start(setup);
  return engine.before.some((before) => {
    const done = engine.apply(state, `${before} ${alg}`);
    return engine.after.some((after) => engine.done(after ? engine.apply(done, after) : done));
  });
}

/** Cheap check that an alg string parses for the set's puzzle. */
export function isValidNotation(alg: string, set: AlgSet = "OLL"): boolean {
  try {
    const moves = parseAlg(alg, notationOf(set));
    if (!moves.length) return false;
    // Make sure every move exists on this puzzle (no 3Rw on a 2x2, no M on a 4x4).
    engineFor({ set, group: "" }).start(alg);
    return true;
  } catch {
    return false;
  }
}
