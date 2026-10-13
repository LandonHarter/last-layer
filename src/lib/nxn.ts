import { parseAlg } from "./notation";

/**
 * Sticker-level simulator for any cube from 2x2 to 7x7, used to check the
 * algorithm data and draw case images for every cube but the 3x3 (which has
 * its own simulator in `cube.ts`).
 *
 * A state is the colour on every sticker slot: slot `f * n * n + row * n + col`
 * on face f (in `FACES` order), and the colour is the face that sticker belongs
 * to when solved. Rows and columns follow the net in `scramble.ts`: U has B at
 * its top edge, the side faces have U at their top edge, D has F at its top.
 *
 * Big-cube centres and the two wings of an edge look alike, so states compare
 * by colour, the way a cube looks to you.
 */

export const FACES = ["U", "D", "R", "L", "F", "B"] as const;
export type Face = (typeof FACES)[number];
export type CubeState = Uint8Array;

type Vec = [number, number, number];

const NORMAL: Record<Face, Vec> = { U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1] };

// Cell (row, col) of each face as a position on an n-cube. Cubie coordinates
// run -(n-1) to n-1 in steps of 2; `k` is the coordinate of column/row 0.
function cellPos(face: Face, r: number, c: number, n: number): Vec {
  const a = (i: number) => -(n - 1) + 2 * i; // left/top to right/bottom
  const e = n - 1;
  switch (face) {
    case "U": return [a(c), e, a(r)];
    case "F": return [a(c), -a(r), e];
    case "R": return [e, -a(r), -a(c)];
    case "B": return [-a(c), -a(r), -e];
    case "L": return [-e, -a(r), a(c)];
    case "D": return [a(c), -e, -a(r)];
  }
}

type Axis = 0 | 1 | 2;

function rotate(v: Vec, axis: Axis, sign: 1 | -1): Vec {
  const [x, y, z] = v;
  if (axis === 0) return sign === 1 ? [x, -z, y] : [x, z, -y];
  if (axis === 1) return sign === 1 ? [z, y, -x] : [-z, y, x];
  return sign === 1 ? [-y, x, z] : [y, -x, z];
}

// Each face letter: the axis, which side, and the direction of a clockwise turn.
const FACE_TURN: Record<string, { axis: Axis; side: 1 | -1; sign: 1 | -1 }> = {
  R: { axis: 0, side: 1, sign: -1 },
  L: { axis: 0, side: -1, sign: 1 },
  U: { axis: 1, side: 1, sign: -1 },
  D: { axis: 1, side: -1, sign: 1 },
  F: { axis: 2, side: 1, sign: -1 },
  B: { axis: 2, side: -1, sign: 1 },
};

type Geometry = { n: number; pos: Vec[]; normal: Vec[]; index: Map<string, number> };
const geometries = new Map<number, Geometry>();

function geometry(n: number): Geometry {
  let g = geometries.get(n);
  if (g) return g;
  const pos: Vec[] = [];
  const normal: Vec[] = [];
  const index = new Map<string, number>();
  for (const face of FACES)
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const p = cellPos(face, r, c, n);
        index.set(`${p}|${NORMAL[face]}`, pos.length);
        pos.push(p);
        normal.push(NORMAL[face]);
      }
  g = { n, pos, normal, index };
  geometries.set(n, g);
  return g;
}

/** Which layers a move turns (1 = the outer face), and how. */
function moveSpec(base: string, n: number): { axis: Axis; side: 1 | -1; sign: 1 | -1; layers: number[] } {
  if (/^[xyz]$/.test(base)) {
    const face = { x: "R", y: "U", z: "F" }[base]!;
    return { ...FACE_TURN[face], layers: Array.from({ length: n }, (_, i) => i + 1) };
  }
  if (/^[MES]$/.test(base)) {
    if (n % 2 === 0) throw new Error(`${base} needs a cube with a middle slice`);
    const face = { M: "L", E: "D", S: "F" }[base]!;
    return { ...FACE_TURN[face], layers: [(n + 1) / 2] };
  }
  // r = Rw (two layers), 3Rw = three layers, 2R = the second layer alone.
  const m = /^(\d?)([RLUDFBrludfb])(w?)$/.exec(base);
  if (!m) throw new Error(`Unknown move ${base}`);
  const lower = m[2] === m[2].toLowerCase();
  const face = m[2].toUpperCase();
  const depth = m[1] ? Number(m[1]) : lower || m[3] ? 2 : 1;
  const wide = lower || m[3] === "w";
  if (depth > n) throw new Error(`${base} turns more layers than a ${n}x${n} has`);
  const layers = wide ? Array.from({ length: depth }, (_, i) => i + 1) : [depth];
  return { ...FACE_TURN[face], layers };
}

const perms = new Map<string, Int32Array>();

/** Where each slot's sticker goes after one clockwise turn of `base`. */
function movePerm(base: string, n: number): Int32Array {
  const key = `${n}:${base}`;
  let perm = perms.get(key);
  if (perm) return perm;
  const g = geometry(n);
  const { axis, side, sign, layers } = moveSpec(base, n);
  const coords = new Set(layers.map((l) => side * (n - 1 - 2 * (l - 1))));
  perm = new Int32Array(g.pos.length);
  for (let i = 0; i < g.pos.length; i++) {
    if (!coords.has(g.pos[i][axis])) {
      perm[i] = i;
      continue;
    }
    const p = rotate(g.pos[i], axis, sign);
    const nr = rotate(g.normal[i], axis, sign);
    perm[i] = g.index.get(`${p}|${nr}`)!;
  }
  perms.set(key, perm);
  return perm;
}

export function solvedState(n: number): CubeState {
  const s = new Uint8Array(6 * n * n);
  for (let i = 0; i < s.length; i++) s[i] = Math.floor(i / (n * n));
  return s;
}

/** Slot numbers instead of colours, to follow where each sticker goes. */
export function identityState(n: number): Int32Array {
  return Int32Array.from({ length: 6 * n * n }, (_, i) => i);
}

export function applyMoves<T extends Uint8Array | Int32Array>(state: T, alg: string, n: number): T {
  let cur = state;
  for (const { base, turns } of parseAlg(alg)) {
    const perm = movePerm(base, n);
    for (let t = 0; t < turns; t++) {
      const next = new (cur.constructor as { new (len: number): T })(cur.length);
      for (let i = 0; i < cur.length; i++) next[perm[i]] = cur[i];
      cur = next;
    }
  }
  return cur;
}

export const slot = (n: number, face: Face, r: number, c: number) => FACES.indexOf(face) * n * n + r * n + c;

export const faceStickers = (state: ArrayLike<number>, n: number, face: Face) =>
  Array.from({ length: n * n }, (_, i) => state[FACES.indexOf(face) * n * n + i]);

const ROTATIONS = ["", "y", "y2", "y'"].flatMap((y) => ["", "x", "x2", "x'", "z", "z'"].map((xz) => `${xz} ${y}`.trim()));

/**
 * The state turned whichever way matches solved best. A 2x2 has no centres
 * to say which way is up, so an alg with D or L turns can leave the whole
 * cube turned; this puts yellow back on top for pictures and comparisons.
 */
export function bestOrientation(state: CubeState, n: number): CubeState {
  const solved = solvedState(n);
  let best = state;
  let score = -1;
  for (const rot of ROTATIONS) {
    const s = rot ? applyMoves(state, rot, n) : state;
    let same = 0;
    for (let i = 0; i < s.length; i++) if (s[i] === solved[i]) same++;
    if (same > score) {
      best = s;
      score = same;
    }
  }
  return best;
}

/** Every face shows one colour, whichever way the cube is held. */
export function facesUniform(state: CubeState, n: number): boolean {
  return FACES.every((f) => faceStickers(state, n, f).every((c, _, all) => c === all[0]));
}

export function isSolvedState(state: CubeState): boolean {
  const n = Math.round(Math.sqrt(state.length / 6));
  return state.every((c, i) => c === Math.floor(i / (n * n)));
}

/** Everything below the top layer is solved. */
export function belowTopSolved(state: CubeState, n: number): boolean {
  if (!faceStickers(state, n, "D").every((c) => c === FACES.indexOf("D"))) return false;
  for (const f of ["F", "R", "B", "L"] as const)
    for (let r = 1; r < n; r++)
      for (let c = 0; c < n; c++) if (state[slot(n, f, r, c)] !== FACES.indexOf(f)) return false;
  return true;
}

// The side face along each edge of U, and the U-face cells next to it (in step with the side face's top row).
const U_EDGE: [Exclude<Face, "U" | "D">, (n: number, i: number) => [number, number]][] = [
  ["F", (n, i) => [n - 1, i]],
  ["R", (n, i) => [n - 1 - i, n - 1]],
  ["B", (_n, i) => [0, _n - 1 - i]],
  ["L", (_n, i) => [i, 0]],
];

/**
 * The top layer looks like a 3x3 last layer you can solve: U centres done,
 * each edge's stickers matching along its length, and an even number of
 * edges flipped (an odd number is OLL parity).
 */
export function topReduced(state: CubeState, n: number): boolean {
  const u = FACES.indexOf("U");
  for (let r = 1; r < n - 1; r++) for (let c = 1; c < n - 1; c++) if (state[slot(n, "U", r, c)] !== u) return false;
  let flipped = 0;
  for (const [side, cell] of U_EDGE) {
    const tops: number[] = [];
    const sides: number[] = [];
    for (let i = 1; i < n - 1; i++) {
      tops.push(state[slot(n, "U", ...cell(n, i))]);
      sides.push(state[slot(n, side, 0, i)]);
    }
    if (tops.some((t) => t !== tops[0]) || sides.some((s) => s !== sides[0])) return false;
    if (tops.length && tops[0] !== u) flipped++;
  }
  return flipped % 2 === 0;
}

/**
 * True when the alg ends with the cube held the way it started: every centre
 * is back on its own face. A 2x2 has no centres, so its algs (outer turns
 * only) are checked on a 3x3.
 */
export function keepsOrientationN(alg: string, n: number): boolean {
  const m = n === 2 ? 3 : n;
  const end = applyMoves(solvedState(m), alg, m);
  return FACES.every((f) => {
    for (let r = 1; r < m - 1; r++) for (let c = 1; c < m - 1; c++) if (end[slot(m, f, r, c)] !== FACES.indexOf(f)) return false;
    return true;
  });
}
