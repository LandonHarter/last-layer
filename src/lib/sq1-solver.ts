/**
 * Random-state Square-1 scrambles, the way WCA scrambles are made: pick a
 * position uniformly at random, solve it with a two-phase search, and give
 * the inverse of the solution. Lengths are counted in slices.
 *
 * Phase 1 brings the puzzle to cube shape, with the permutation parity that
 * phase 2 can solve. Its table holds, for every slice-ready shape (each
 * layer's corner pattern at its current turn) and parity, how many slices it
 * takes to get there. Phase 2 stays in cube shape, turning the layers by
 * quarters and slicing, and is pruned by tables of the corners and the edges
 * (each with the middle layer).
 *
 * Phase 2 works in one frame: the top turned (1,0) from solved, the bottom
 * as solved. There a slice keeps both layers square. Turning a square layer by
 * a quarter moves four corners and four edges round (two odd cycles), and a
 * slice swaps two pairs of each, so the parity of the reading order of all
 * pieces never changes in phase 2; phase 1 has to fix it.
 *
 * Tables are built on first use (about half a second) and a solve takes
 * tens of milliseconds, sometimes up to a second, so the app runs it in the
 * solver worker.
 */

import { formatSq1, isCorner, sq1ApplyMoves, sq1Solved, SQ1_LENGTH, type Sq1Move, type Sq1State } from "./sq1";

const MIDDLE = 24;
const SLICE: Sq1Move[] = ["/"];

// ---------------------------------------------------------------------------
// Shapes

/** Corner starts of a layer as a 12-bit mask, read from slot 0 (a piece starts there in a slice-ready state). */
function layerMask(s: Sq1State, base: number): number {
  let m = 0;
  for (let i = 0; i < 12; ) {
    if (isCorner(s[base + i])) {
      m |= 1 << i;
      i += 2;
    } else i++;
  }
  return m;
}

/** A slice can turn when no corner starts at slot 5 or 11 (and so sits across the cut). */
const sliceReady = (mask: number) => (mask & 0x820) === 0;
const rotate = (mask: number, r: number) => ((mask << r) | (mask >>> (12 - r))) & 0xfff;

/** Turns r (0 to 11, as `turnLayer` counts them) that leave a layer of this mask slice-ready. */
const readyTurns = new Map<number, number[]>();
function turnsFor(mask: number): number[] {
  let list = readyTurns.get(mask);
  if (!list) {
    list = [];
    for (let r = 0; r < 12; r++) if (sliceReady(rotate(mask, r))) list.push(r);
    readyTurns.set(mask, list);
  }
  return list;
}

/** Parity of the order the pieces are read in: top from slot 0, then bottom from slot 0. */
function readingParity(s: Sq1State): number {
  const seq: number[] = [];
  for (const base of [0, 12])
    for (let i = 0; i < 12; ) {
      seq.push(s[base + i] >> 1);
      i += isCorner(s[base + i]) ? 2 : 1;
    }
  let p = 0;
  for (let i = 0; i < seq.length; i++) for (let j = i + 1; j < seq.length; j++) if (seq[i] > seq[j]) p ^= 1;
  return p;
}

const nodeKey = (s: Sq1State) => layerMask(s, 0) | (layerMask(s, 12) << 12) | (readingParity(s) << 24);

/** The move that turns the top by `top` and the bottom by `bottom`, both as `turnLayer` counts them (the bottom is written negated). */
const turn = (top: number, bottom: number): Sq1Move => ({ top, bottom: -bottom });

// ---------------------------------------------------------------------------
// Phase 2: cube shape

// Square layers are slice-ready at two turns: corner first (A, as solved) or edge first (B).
const SQ_A = 0x249; // corners start at slots 0, 3, 6, 9
const SQ_B = 0x492; // corners start at slots 1, 4, 7, 10

/**
 * A slice keeps cube shape only when one layer is A and the other B. Frame 0
 * is top B, bottom A; frame 1 is top A, bottom B.
 */
const FRAMES = [
  { top: SQ_B, bottom: SQ_A, ref: sq1ApplyMoves(sq1Solved(), [turn(1, 0)]) },
  { top: SQ_A, bottom: SQ_B, ref: sq1ApplyMoves(sq1Solved(), [turn(0, 1)]) },
];

const FACT = [1, 1, 2, 6, 24, 120, 720, 5040];
const N_PERM = 40320;

function encodePerm(p: number[]): number {
  let idx = 0;
  for (let i = 0; i < 8; i++) {
    let smaller = 0;
    for (let j = i + 1; j < 8; j++) if (p[j] < p[i]) smaller++;
    idx += smaller * FACT[7 - i];
  }
  return idx;
}

function decodePerm(idx: number): number[] {
  const left = [0, 1, 2, 3, 4, 5, 6, 7];
  const p: number[] = [];
  for (let i = 0; i < 8; i++) {
    const f = FACT[7 - i];
    p.push(left.splice(Math.floor(idx / f), 1)[0]);
    idx %= f;
  }
  return p;
}

/**
 * Corners (or edges) in reading order: top from slot 0, then bottom from slot
 * 0. In a slice-ready cube shape that's four of each per layer, whichever way
 * each layer is turned; the four on top come first.
 */
function readKind(s: Sq1State, corner: boolean): number[] {
  const out: number[] = [];
  for (const base of [0, 12])
    for (let i = 0; i < 12; ) {
      const c = isCorner(s[base + i]);
      if (c === corner) out.push((s[base + i] >> 1) - (corner ? 0 : 8));
      i += c ? 2 : 1;
    }
  return out;
}

/** The table that applies a permutation of reading positions (`from[i]` is where position i's piece came from). */
function permTable(from: number[]): Uint16Array {
  const table = new Uint16Array(N_PERM);
  for (let i = 0; i < N_PERM; i++) {
    const p = decodePerm(i);
    table[i] = encodePerm(from.map((j) => p[j]));
  }
  return table;
}

/** Where each reading position's piece comes from when a move takes `before` to `after`. */
const fromOf = (before: number[], after: number[]) => after.map((v) => before.indexOf(v));
const key = (from: number[]) => from.join(",");

type Move2 = { move: Sq1Move; c: Uint16Array; e: Uint16Array; to: number };

type Phase2 = {
  /** Per frame: a turn into a frame (then a slice follows). */
  mid: Move2[][];
  /** Per frame: a turn that ends solved, if the pieces are right. */
  final: Move2[][];
  /** Per frame: the slice. */
  cSlice: Uint16Array[];
  eSlice: Uint16Array[];
  /** Slices needed, by (perm * 2 + middle) * 2 + frame, to reach a state one turn from solved. */
  cPrune: Int8Array;
  ePrune: Int8Array;
};

/** Turns (as `turnLayer` counts them) that take a layer of pattern `from` to pattern `to`. */
const rotations = (from: number, to: number) => Array.from({ length: 12 }, (_, r) => r).filter((r) => rotate(from, r) === to);

function buildPhase2(): Phase2 {
  const tables = new Map<string, Uint16Array>();
  const table = (from: number[]) => {
    const k = key(from);
    let t = tables.get(k);
    if (!t) tables.set(k, (t = permTable(from)));
    return t;
  };
  const turnsBetween = (ref: Sq1State, top: number, bottom: number, toTop: number, toBottom: number, to: number): Move2[] =>
    rotations(top, toTop).flatMap((a) =>
      rotations(bottom, toBottom).map((b) => {
        const move = turn(a, b);
        const after = sq1ApplyMoves(ref, [move]);
        return {
          move,
          c: table(fromOf(readKind(ref, true), readKind(after, true))),
          e: table(fromOf(readKind(ref, false), readKind(after, false))),
          to,
        };
      }),
    );

  const cSlice: Uint16Array[] = [];
  const eSlice: Uint16Array[] = [];
  for (const f of FRAMES) {
    const after = sq1ApplyMoves(f.ref, SLICE);
    if (layerMask(after, 0) !== f.top || layerMask(after, 12) !== f.bottom) throw new Error("Square-1 slice leaves cube shape");
    cSlice.push(table(fromOf(readKind(f.ref, true), readKind(after, true))));
    eSlice.push(table(fromOf(readKind(f.ref, false), readKind(after, false))));
  }
  const mid = FRAMES.map((f) => FRAMES.flatMap((g, to) => turnsBetween(f.ref, f.top, f.bottom, g.top, g.bottom, to)));
  const final = FRAMES.map((f) => turnsBetween(f.ref, f.top, f.bottom, SQ_A, SQ_A, -1));
  // From solved into each frame: the states one final turn from solved.
  const solved = sq1Solved();
  const seeds = FRAMES.map((f, to) => turnsBetween(solved, SQ_A, SQ_A, f.top, f.bottom, to));

  const prune = (kind: "c" | "e", slice: Uint16Array[]) => {
    const dist = new Int8Array(N_PERM * 4).fill(-1);
    let frontier: number[] = [];
    for (const list of seeds)
      for (const m of list) {
        const x = (m[kind][0] * 2) * 2 + m.to;
        if (dist[x] < 0) {
          dist[x] = 0;
          frontier.push(x);
        }
      }
    // A state x at distance d + 1 turns (into frame g) and slices to a state at distance d;
    // so from y in frame g, slice back and undo the turn: that is a turn out of g.
    for (let d = 0; frontier.length; d++) {
      const next: number[] = [];
      for (const y of frontier) {
        const g = y & 1;
        const z = slice[g][y >> 2];
        const m = ((y >> 1) & 1) ^ 1;
        for (const mv of mid[g]) {
          const x = (mv[kind][z] * 2 + m) * 2 + mv.to;
          if (dist[x] < 0) {
            dist[x] = d + 1;
            next.push(x);
          }
        }
      }
      frontier = next;
    }
    return dist;
  };
  return { mid, final, cSlice, eSlice, cPrune: prune("c", cSlice), ePrune: prune("e", eSlice) };
}

const corners = (s: Sq1State) => encodePerm(readKind(s, true));
const edges = (s: Sq1State) => encodePerm(readKind(s, false));
const frameOf = (s: Sq1State) => FRAMES.findIndex((f) => layerMask(s, 0) === f.top && layerMask(s, 12) === f.bottom);

// ---------------------------------------------------------------------------
// Phase 1: shape and parity

/** Slices from each node (shape and parity, `nodeKey`) to a phase 2 frame with the parity phase 2 can solve. */
function buildPhase1(): Map<number, number> {
  const index = new Map<number, number>();
  const reps: Sq1State[] = [];
  const succ: number[][] = [];
  const add = (s: Sq1State) => {
    const key = nodeKey(s);
    let i = index.get(key);
    if (i === undefined) {
      i = reps.length;
      index.set(key, i);
      reps.push(s);
    }
    return i;
  };
  const turned = (s: Sq1State, out: (t: Sq1State) => void) => {
    for (const a of turnsFor(layerMask(s, 0))) for (const b of turnsFor(layerMask(s, 12))) out(sq1ApplyMoves(s, [turn(a, b)]));
  };
  // Every slice-ready turn of solved, then a slice and a turn from each node until no new ones appear.
  turned(sq1Solved(), add);
  for (let i = 0; i < reps.length; i++) {
    const list: number[] = [];
    turned(sq1ApplyMoves(reps[i], SLICE), (t) => list.push(add(t)));
    succ.push(list);
  }
  const preds: number[][] = reps.map(() => []);
  succ.forEach((list, i) => list.forEach((j) => preds[j].push(i)));

  const dist = new Int8Array(reps.length).fill(-1);
  let frontier = FRAMES.map((f) => index.get(nodeKey(f.ref))!);
  for (const i of frontier) dist[i] = 0;
  for (let d = 0; frontier.length; d++) {
    const next: number[] = [];
    for (const j of frontier)
      for (const i of preds[j])
        if (dist[i] < 0) {
          dist[i] = d + 1;
          next.push(i);
        }
    frontier = next;
  }
  const out = new Map<number, number>();
  for (const [key, i] of index) if (dist[i] >= 0) out.set(key, dist[i]);
  return out;
}

// ---------------------------------------------------------------------------
// Search

let tables: { p1: Map<number, number>; p2: Phase2 } | null = null;
const getTables = () => (tables ??= { p1: buildPhase1(), p2: buildPhase2() });

/** Build the tables now rather than on the first scramble. */
export const warmSq1Solver = () => void getTables();

function solve(start: Sq1State, budgetMs = 30): Sq1Move[] {
  const { p1, p2 } = getTables();
  const path: Sq1Move[] = [];
  const pruned = (c: number, e: number, m: number, f: number) => Math.max(p2.cPrune[(c * 2 + m) * 2 + f], p2.ePrune[(e * 2 + m) * 2 + f]);

  const phase2 = (c: number, e: number, m: number, f: number, left: number, first: boolean): boolean => {
    if (pruned(c, e, m, f) > left) return false;
    if (m === 0)
      for (const mv of p2.final[f])
        if (mv.c[c] === 0 && mv.e[e] === 0) {
          path.push(mv.move);
          return true;
        }
    if (left === 0) return false;
    for (const mv of p2.mid[f]) {
      // A slice right after a slice would undo it.
      if (!first && mv.to === f && mv.move !== "/" && !mv.move.top && !mv.move.bottom) continue;
      const c2 = p2.cSlice[mv.to][mv.c[c]];
      const e2 = p2.eSlice[mv.to][mv.e[e]];
      if (pruned(c2, e2, m ^ 1, mv.to) > left - 1) continue;
      path.push(mv.move, "/");
      if (phase2(c2, e2, m ^ 1, mv.to, left - 1, false)) return true;
      path.length -= 2;
    }
    return false;
  };

  let best: Sq1Move[] | null = null;
  let bestSlices = Infinity;
  const deadline = performance.now() + budgetMs;

  // Phase 2 from the end of a phase 1 path, as short as it goes and shorter than the best so far.
  const finish = (t: Sq1State, used: number) => {
    const c = corners(t);
    const e = edges(t);
    const f = frameOf(t);
    const base = path.length;
    for (let left = 0; left <= 20 && used + left < bestSlices; left++) {
      if (phase2(c, e, t[MIDDLE], f, left, true)) {
        best = path.slice();
        bestSlices = used + left;
        path.length = base;
        return;
      }
      path.length = base;
    }
  };

  // `s` is slice-ready or just sliced; try each turn that makes it slice-ready. Phase 1
  // paths use exactly `left` more slices, so each length is tried once.
  const phase1 = (s: Sq1State, left: number, used: number): boolean => {
    const first = path.length === 0;
    for (const a of turnsFor(layerMask(s, 0)))
      for (const b of turnsFor(layerMask(s, 12))) {
        if (!first && a === 0 && b === 0) continue;
        const t = sq1ApplyMoves(s, [turn(a, b)]);
        const d = p1.get(nodeKey(t));
        if (d === undefined || d > left) continue;
        // Arriving early means a shorter phase 1 path, already tried.
        if (d === 0 && left > 0) continue;
        path.push(turn(a, b));
        if (left === 0) finish(t, used);
        else {
          path.push("/");
          const stop = phase1(sq1ApplyMoves(t, SLICE), left - 1, used + 1);
          path.pop();
          if (stop) {
            path.pop();
            return true;
          }
        }
        path.pop();
        // Out of time once there's an answer.
        if (best && performance.now() > deadline) return true;
      }
    return false;
  };

  for (let length = 0; length < bestSlices; length++) {
    path.length = 0;
    if (phase1(start, length, 0)) break;
  }
  if (best) return best;
  throw new Error("Square-1 position has no solution");
}

// ---------------------------------------------------------------------------
// Random positions

/** Slice-ready layer masks: no two corners overlapping, none across the cut. */
const READY_MASKS = Array.from({ length: 4096 }, (_, m) => m).filter((m) => sliceReady(m) && (m & rotate(m, 1)) === 0);
const popcount = (m: number) => {
  let c = 0;
  for (; m; m &= m - 1) c++;
  return c;
};
/** Pairs of top and bottom masks that hold eight corners between them. */
const SHAPE_PAIRS = READY_MASKS.flatMap((t) => READY_MASKS.filter((b) => popcount(t) + popcount(b) === 8).map((b) => [t, b] as const));

function shuffled(n: number, offset: number, random: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i + offset);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A position picked uniformly from all slice-ready ones: every shape pair
 * holds the same number of piece orders, so pick the shape, then the pieces.
 */
export function randomSq1State(random: () => number = Math.random): Sq1State {
  const [top, bottom] = SHAPE_PAIRS[Math.floor(random() * SHAPE_PAIRS.length)];
  const cs = shuffled(8, 0, random);
  const es = shuffled(8, 8, random);
  const s = new Uint8Array(SQ1_LENGTH);
  [top, bottom].forEach((mask, layer) => {
    const base = layer * 12;
    for (let i = 0; i < 12; ) {
      if (mask & (1 << i)) {
        const p = cs.pop()!;
        // A corner on its own layer reads half 0 first clockwise; on the other layer it's flipped.
        const flipped = p < 4 !== (layer === 0) ? 1 : 0;
        s[base + i] = p * 2 + flipped;
        s[base + i + 1] = p * 2 + (flipped ^ 1);
        i += 2;
      } else {
        s[base + i] = es.pop()! * 2;
        i++;
      }
    }
  });
  s[MIDDLE] = random() < 0.5 ? 1 : 0;
  return s;
}

/** Moves that solve a Square-1 position (as few slices as the two-phase search finds first). */
export function solveSq1(state: Sq1State): string {
  return formatSq1(solve(state));
}

/** A random-state Square-1 scramble in WCA notation. */
export function sq1RandomStateScramble(random: () => number = Math.random): string {
  const moves = solve(randomSq1State(random))
    .reverse()
    .map((m) => (m === "/" ? m : { top: -m.top, bottom: -m.bottom }));
  return formatSq1(moves);
}
