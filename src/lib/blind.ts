import { applyAlg, colorOf, solvedCube, type Face, type Sticker, type Vec } from "./cube";

/**
 * Blindfolded memo: which stickers to shoot to, in order, for the edges and
 * corners of a scramble. Each piece sticker has a letter (Speffz by default).
 * From the buffer you shoot its sticker to where it belongs, which brings a
 * new sticker into the buffer; when the buffer holds its own piece you break
 * into the first unsolved piece. Pieces that are flipped or twisted in place
 * come out as a cycle break into them.
 */

const NORMALS: Record<Face, Vec> = { U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1] };

/** Sticker slots in Speffz letter order: the sticker's face first, then the other faces of its piece. */
export const EDGE_SLOTS = ["UB", "UR", "UF", "UL", "LU", "LF", "LD", "LB", "FU", "FR", "FD", "FL", "RU", "RB", "RD", "RF", "BU", "BL", "BD", "BR", "DF", "DR", "DB", "DL"];
export const CORNER_SLOTS = ["UBL", "UBR", "UFR", "UFL", "LUB", "LUF", "LDF", "LDB", "FUL", "FUR", "FDR", "FDL", "RUF", "RUB", "RDB", "RDF", "BUR", "BUL", "BDL", "BDR", "DFL", "DFR", "DBR", "DBL"];

export const SPEFFZ = "ABCDEFGHIJKLMNOPQRSTUVWX";

export type Color = "white" | "yellow" | "green" | "blue" | "red" | "orange";
export const COLORS: Color[] = ["white", "yellow", "green", "blue", "red", "orange"];
/** Scrambles are applied white on top, green in front (WCA), so each colour is the face it starts on. */
export const COLOR_FACE: Record<Color, Face> = { white: "U", yellow: "D", green: "F", blue: "B", red: "R", orange: "L" };
const OPPOSITE: Record<Color, Color> = { white: "yellow", yellow: "white", green: "blue", blue: "green", red: "orange", orange: "red" };
export const canBeFront = (top: Color, front: Color) => front !== top && front !== OPPOSITE[top];

export const EDGE_BUFFERS = [
  { slot: "UF", label: "UF (3-style)" },
  { slot: "DF", label: "DF (M2)" },
  { slot: "UR", label: "UR (Old Pochmann)" },
] as const;
export const CORNER_BUFFERS = [
  { slot: "UFR", label: "UFR (3-style)" },
  { slot: "UBL", label: "UBL (Old Pochmann)" },
] as const;

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

type Kind = "edges" | "corners";
type Slot = { name: string; pos: Vec; normal: Vec };

function slotsOf(names: string[]): Slot[] {
  return names.map((name) => ({
    name,
    pos: [...name].reduce<Vec>((p, f) => add(p, NORMALS[f as Face]), [0, 0, 0]),
    normal: NORMALS[name[0] as Face],
  }));
}

const SLOTS: Record<Kind, Slot[]> = { edges: slotsOf(EDGE_SLOTS), corners: slotsOf(CORNER_SLOTS) };
const key = (pos: Vec, normal: Vec) => `${pos}|${normal}`;
const SLOT_INDEX: Record<Kind, Map<string, number>> = {
  edges: new Map(SLOTS.edges.map((s, i) => [key(s.pos, s.normal), i])),
  corners: new Map(SLOTS.corners.map((s, i) => [key(s.pos, s.normal), i])),
};

/**
 * The stickers of a slot's piece, starting with that slot. Corner stickers go
 * the same way round on every corner, so a swap keeps the twist it should.
 */
function pieceOf(kind: Kind, i: number): number[] {
  const slots = SLOTS[kind];
  const pos = slots[i].pos;
  const same = slots.map((s, j) => j).filter((j) => key(slots[j].pos, [0, 0, 0]) === key(pos, [0, 0, 0]));
  if (kind === "edges") return [i, same.find((j) => j !== i)!];
  const order = [i];
  while (order.length < 3) {
    const cur = slots[order.at(-1)!].normal;
    order.push(same.find((j) => !order.includes(j) && dot(cross(cur, slots[j].normal), pos) < 0)!);
  }
  return order;
}
const PIECES: Record<Kind, number[][]> = {
  edges: SLOTS.edges.map((_, i) => pieceOf("edges", i)),
  corners: SLOTS.corners.map((_, i) => pieceOf("corners", i)),
};

const ROTATIONS = ["", "y", "y2", "y'"].flatMap((y) => ["", "x", "x2", "x'", "z", "z'"].map((xz) => `${xz} ${y}`.trim()));

/** The whole-cube turn that puts `top` on top and `front` in front, from white top, green front. */
export function orientationMoves(top: Color, front: Color): string {
  for (const rot of ROTATIONS) {
    const state = applyAlg(solvedCube(), rot);
    const center = (n: Vec) => colorOf(state.find((s) => key(s.pos, [0, 0, 0]) === key(n, [0, 0, 0]) && key(s.normal, [0, 0, 0]) === key(n, [0, 0, 0]))!);
    if (center(NORMALS.U) === COLOR_FACE[top] && center(NORMALS.F) === COLOR_FACE[front]) return rot;
  }
  throw new Error(`Can't hold ${top} on top with ${front} in front`);
}

/** For each slot, the slot its current sticker belongs in. */
function contents(kind: Kind, state: Sticker[], home: Map<number, number>): number[] {
  const at = new Map(state.map((s) => [key(s.pos, s.normal), s.id]));
  return SLOTS[kind].map((s) => home.get(at.get(key(s.pos, s.normal))!)!);
}

function trace(kind: Kind, start: number[], buffer: number): number[] {
  const c = [...start];
  const bufferPiece = PIECES[kind][buffer];
  const solved = (i: number) => PIECES[kind][i].every((j) => c[j] === j);
  const memo: number[] = [];
  for (let guard = 0; guard < 40; guard++) {
    let target = c[buffer];
    if (bufferPiece.includes(target)) {
      const next = c.findIndex((_, i) => !bufferPiece.includes(i) && !solved(i));
      if (next === -1) break;
      target = next;
    }
    memo.push(target);
    const from = bufferPiece.indexOf(buffer);
    const b = [...bufferPiece.slice(from), ...bufferPiece.slice(0, from)];
    const t = PIECES[kind][target];
    for (let k = 0; k < b.length; k++) [c[b[k]], c[t[k]]] = [c[t[k]], c[b[k]]];
  }
  return memo;
}

export type BlindOptions = {
  top: Color;
  front: Color;
  /** 24 letters each, in `EDGE_SLOTS` / `CORNER_SLOTS` order. */
  edgeLetters: string;
  cornerLetters: string;
  edgeBuffer: string;
  cornerBuffer: string;
};

export const DEFAULT_BLIND: BlindOptions = {
  top: "white",
  front: "green",
  edgeLetters: SPEFFZ,
  cornerLetters: SPEFFZ,
  edgeBuffer: "UF",
  cornerBuffer: "UFR",
};

export type Memo = {
  edges: string[];
  corners: string[];
  /** Odd number of targets on each: one swap is left over (parity). */
  parity: boolean;
  /** The cube as you hold it: scramble, then turned to your top and front. */
  state: Sticker[];
};

export function memoFor(scramble: string, o: BlindOptions): Memo {
  const rot = orientationMoves(o.top, o.front);
  const reference = applyAlg(solvedCube(), rot);
  const state = applyAlg(applyAlg(solvedCube(), scramble), rot);
  const result = {} as Record<Kind, string[]>;
  for (const kind of ["edges", "corners"] as Kind[]) {
    const home = new Map<number, number>();
    for (const s of reference) {
      const i = SLOT_INDEX[kind].get(key(s.pos, s.normal));
      if (i !== undefined) home.set(s.id, i);
    }
    const letters = kind === "edges" ? o.edgeLetters : o.cornerLetters;
    const names = kind === "edges" ? EDGE_SLOTS : CORNER_SLOTS;
    const buffer = Math.max(0, names.indexOf(kind === "edges" ? o.edgeBuffer : o.cornerBuffer));
    result[kind] = trace(kind, contents(kind, state, home), buffer).map((i) => letters[i]?.trim() || "?");
  }
  return { edges: result.edges, corners: result.corners, parity: result.edges.length % 2 === 1, state };
}

/** "ABCDE" as "AB CD E". */
export const pairUp = (letters: string[]) => letters.join("").replace(/(..)(?=.)/g, "$1 ");

/** Letters typed by hand, compared without spaces or case. */
export const normalizeMemo = (s: string) => s.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

/** Where each slot sits on the unfolded net: face, row, column. */
export function netCell(name: string): { face: Face; row: number; col: number } {
  const face = name[0] as Face;
  const pos = SLOTS[name.length === 2 ? "edges" : "corners"].find((s) => s.name === name)!.pos;
  const [x, y, z] = pos;
  // Same layout as `scramble.ts`: U has B at its top edge, sides have U at the top, D has F at the top.
  const cells: Record<Face, [number, number]> = {
    U: [z + 1, x + 1],
    F: [1 - y, x + 1],
    R: [1 - y, 1 - z],
    B: [1 - y, 1 - x],
    L: [1 - y, z + 1],
    D: [1 - z, x + 1],
  };
  const cell = cells[face];
  return { face, row: cell[0], col: cell[1] };
}
