import { parseAlg } from "./notation";

/**
 * Minimal sticker-level 3x3 simulator. Used to verify algorithm data and to
 * work out which last-layer pieces a PLL moves (for the arrows on case images).
 *
 * Coordinates: x → R, y → U, z → F. Each sticker keeps the id of its solved slot
 * so we can track where pieces travel.
 */

export type Vec = [number, number, number];
export type Sticker = { id: number; pos: Vec; normal: Vec };
export type Face = "U" | "D" | "R" | "L" | "F" | "B";

const FACE_NORMALS: Record<Face, Vec> = {
  U: [0, 1, 0],
  D: [0, -1, 0],
  R: [1, 0, 0],
  L: [-1, 0, 0],
  F: [0, 0, 1],
  B: [0, 0, -1],
};

export function faceOf(normal: Vec): Face {
  const [x, y, z] = normal;
  if (y === 1) return "U";
  if (y === -1) return "D";
  if (x === 1) return "R";
  if (x === -1) return "L";
  if (z === 1) return "F";
  return "B";
}

export function solvedCube(): Sticker[] {
  const stickers: Sticker[] = [];
  for (const normal of Object.values(FACE_NORMALS)) {
    const axis = normal.findIndex((v) => v !== 0);
    for (const a of [-1, 0, 1])
      for (const b of [-1, 0, 1]) {
        const pos = [0, 0, 0] as Vec;
        const others = [0, 1, 2].filter((i) => i !== axis);
        pos[axis] = normal[axis];
        pos[others[0]] = a;
        pos[others[1]] = b;
        stickers.push({ id: stickers.length, pos, normal: [...normal] });
      }
  }
  return stickers;
}

type Axis = 0 | 1 | 2;
// Each move: axis, which layers (by coordinate on that axis), and the direction
// of one clockwise quarter turn as a signed rotation about the positive axis.
const MOVE_DEFS: Record<string, { axis: Axis; layers: number[]; sign: 1 | -1 }> = {
  R: { axis: 0, layers: [1], sign: -1 },
  L: { axis: 0, layers: [-1], sign: 1 },
  U: { axis: 1, layers: [1], sign: -1 },
  D: { axis: 1, layers: [-1], sign: 1 },
  F: { axis: 2, layers: [1], sign: -1 },
  B: { axis: 2, layers: [-1], sign: 1 },
  M: { axis: 0, layers: [0], sign: 1 },
  E: { axis: 1, layers: [0], sign: 1 },
  S: { axis: 2, layers: [0], sign: -1 },
  r: { axis: 0, layers: [0, 1], sign: -1 },
  l: { axis: 0, layers: [-1, 0], sign: 1 },
  u: { axis: 1, layers: [0, 1], sign: -1 },
  d: { axis: 1, layers: [-1, 0], sign: 1 },
  f: { axis: 2, layers: [0, 1], sign: -1 },
  b: { axis: 2, layers: [-1, 0], sign: 1 },
  x: { axis: 0, layers: [-1, 0, 1], sign: -1 },
  y: { axis: 1, layers: [-1, 0, 1], sign: -1 },
  z: { axis: 2, layers: [-1, 0, 1], sign: -1 },
};

function rotate(v: Vec, axis: Axis, sign: 1 | -1): Vec {
  const [x, y, z] = v;
  // Right-handed +90° about the axis when sign = 1.
  if (axis === 0) return sign === 1 ? [x, -z, y] : [x, z, -y];
  if (axis === 1) return sign === 1 ? [z, y, -x] : [-z, y, x];
  return sign === 1 ? [-y, x, z] : [y, -x, z];
}

export function applyAlg(state: Sticker[], alg: string): Sticker[] {
  let next = state;
  for (const move of parseAlg(alg)) {
    const key = move.base.endsWith("w") ? move.base[0].toLowerCase() : move.base;
    const def = MOVE_DEFS[key];
    for (let t = 0; t < move.turns; t++) {
      next = next.map((s) =>
        def.layers.includes(s.pos[def.axis])
          ? { id: s.id, pos: rotate(s.pos, def.axis, def.sign), normal: rotate(s.normal, def.axis, def.sign) }
          : s,
      );
    }
  }
  return next;
}

const SOLVED = solvedCube();

/** Colour of a sticker = the face it sat on when solved. */
export function colorOf(s: Sticker): Face {
  return faceOf(SOLVED[s.id].normal);
}

const eq = (a: Vec, b: Vec) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/** Undo any whole-cube rotation so centres are back in their home faces. */
export function normalizeOrientation(state: Sticker[]): Sticker[] {
  const rotations = ["", "y", "y2", "y'"].flatMap((y) =>
    ["", "x", "x2", "x'", "z", "z'"].map((xz) => `${xz} ${y}`.trim()),
  );
  for (const rot of rotations) {
    const candidate = rot ? applyAlg(state, rot) : state;
    const centersHome = candidate
      .filter((s) => s.pos.filter((v) => v !== 0).length === 1)
      .every((s) => colorOf(s) === faceOf(s.normal));
    if (centersHome) return candidate;
  }
  throw new Error("Could not normalize orientation");
}

export function stickerAt(state: Sticker[], pos: Vec, normal: Vec): Sticker {
  const s = state.find((st) => eq(st.pos, pos) && eq(st.normal, normal));
  if (!s) throw new Error(`No sticker at ${pos} / ${normal}`);
  return s;
}

/** Every sticker below the top layer is where it belongs. */
export function f2lSolved(state: Sticker[]): boolean {
  return state.filter((s) => s.pos[1] < 1).every((s) => colorOf(s) === faceOf(s.normal));
}

export function isSolved(state: Sticker[]): boolean {
  return state.every((s) => colorOf(s) === faceOf(s.normal));
}

/** All top-face stickers show the U colour. */
export function topOriented(state: Sticker[]): boolean {
  return state.filter((s) => s.normal[1] === 1).every((s) => colorOf(s) === "U");
}

/** Index 0–8 of a U-face sticker, row-major from back-left (VisualCube order). */
export function uIndex(pos: Vec): number {
  return (pos[2] + 1) * 3 + (pos[0] + 1);
}

/**
 * For a last-layer algorithm, where each top sticker travels: pairs of
 * VisualCube U-face indices [from, to]. Stationary stickers are skipped.
 */
export function topStickerMoves(alg: string): [number, number][] {
  const start = solvedCube();
  const end = normalizeOrientation(applyAlg(start, alg));
  const moves: [number, number][] = [];
  for (const s of start) {
    if (s.normal[1] !== 1) continue;
    const after = end.find((e) => e.id === s.id)!;
    const from = uIndex(s.pos);
    const to = uIndex(after.pos);
    if (from !== to) moves.push([from, to]);
  }
  return moves;
}

/** True when the alg ends with the cube held the way it started. */
export function keepsOrientation(alg: string): boolean {
  return applyAlg(solvedCube(), alg)
    .filter((s) => s.pos.filter((v) => v !== 0).length === 1)
    .every((s) => colorOf(s) === faceOf(s.normal));
}
