import { applyAlg, colorOf, solvedCube, stickerAt, type Face, type Sticker, type Vec } from "./cube";
import { applyMoves, faceStickers, FACES as NXN_FACES, solvedState } from "./nxn";
import { canSlice, sq1Apply, sq1Solved, wcaTurn } from "./sq1";

const AXIS: Record<string, number> = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
const SUFFIXES = ["", "'", "2"];

/** Puzzles the timer can scramble. */
export type TimerPuzzle = "2x2" | "3x3" | "4x4" | "5x5" | "6x6" | "7x7" | "megaminx" | "pyraminx" | "skewb" | "sq1";

export const TIMER_PUZZLES: TimerPuzzle[] = ["3x3", "2x2", "4x4", "5x5", "6x6", "7x7", "megaminx", "pyraminx", "skewb", "sq1"];

export const TIMER_PUZZLE_NAMES: Record<TimerPuzzle, string> = {
  "2x2": "2x2",
  "3x3": "3x3",
  "4x4": "4x4",
  "5x5": "5x5",
  "6x6": "6x6",
  "7x7": "7x7",
  megaminx: "Megaminx",
  pyraminx: "Pyraminx",
  skewb: "Skewb",
  sq1: "Square-1",
};

export const isTimerPuzzle = (v: unknown): v is TimerPuzzle => TIMER_PUZZLES.includes(v as TimerPuzzle);

const CUBE_N: Partial<Record<TimerPuzzle, number>> = { "2x2": 2, "3x3": 3, "4x4": 4, "5x5": 5, "6x6": 6, "7x7": 7 };
export const cubeSize = (puzzle: TimerPuzzle): number | undefined => CUBE_N[puzzle];

// Each cube size: the turns a scramble draws from (face plus how many layers) and its length.
type Turn = { face: string; depth: number };
const outer = (faces: string) => [...faces].map((face) => ({ face, depth: 1 }));
const wide = (faces: string, depth: number) => [...faces].map((face) => ({ face, depth }));
const CUBE_SCRAMBLE: Record<number, { turns: Turn[]; length: number }> = {
  // 2x2: the cube has no centres, so R U F reach every state.
  2: { turns: outer("RUF"), length: 11 },
  3: { turns: outer("UDRLFB"), length: 20 },
  4: { turns: [...outer("UDRLFB"), ...wide("RUF", 2)], length: 40 },
  5: { turns: [...outer("UDRLFB"), ...wide("UDRLFB", 2)], length: 60 },
  6: { turns: [...outer("UDRLFB"), ...wide("UDRLFB", 2), ...wide("RUF", 3)], length: 80 },
  7: { turns: [...outer("UDRLFB"), ...wide("UDRLFB", 2), ...wide("UDRLFB", 3)], length: 100 },
};

const turnName = ({ face, depth }: Turn) => (depth === 1 ? face : depth === 2 ? `${face}w` : `${depth}${face}w`);

/**
 * A random-move cube scramble. Turns on one axis commute, so within a run of
 * same-axis turns no layer set is turned twice (no R R, no R L R, no Rw R Rw).
 */
export function cubeScramble(n: number, random: () => number = Math.random, length = CUBE_SCRAMBLE[n].length): string {
  const { turns } = CUBE_SCRAMBLE[n];
  const moves: string[] = [];
  let run: Turn[] = [];
  while (moves.length < length) {
    const turn = turns[Math.floor(random() * turns.length)];
    const sameAxis = run.length > 0 && AXIS[run[0].face] === AXIS[turn.face];
    if (sameAxis && run.some((t) => t.face === turn.face && t.depth === turn.depth)) continue;
    run = sameAxis ? [...run, turn] : [turn];
    moves.push(turnName(turn) + SUFFIXES[Math.floor(random() * SUFFIXES.length)]);
  }
  return moves.join(" ");
}

/** A random-move 3x3 scramble (see `cubeScramble`). */
export function randomScramble(length = 20, random: () => number = Math.random): string {
  return cubeScramble(3, random, length);
}

const pick = <T,>(xs: readonly T[], random: () => number) => xs[Math.floor(random() * xs.length)];

// Corner puzzles: never the same face twice in a row.
function cornerScramble(faces: string[], length: number, random: () => number): string[] {
  const moves: string[] = [];
  let last = "";
  while (moves.length < length) {
    const face = pick(faces, random);
    if (face === last) continue;
    last = face;
    moves.push(face + pick(["", "'"], random));
  }
  return moves;
}

/** WCA-style megaminx scramble: seven lines of R++/D-- turns, each ending in U or U'. */
function megaminxScramble(random: () => number): string {
  const lines: string[] = [];
  for (let line = 0; line < 7; line++) {
    const moves: string[] = [];
    for (let i = 0; i < 10; i++) moves.push((i % 2 ? "D" : "R") + pick(["++", "--"], random));
    moves.push(pick(["U", "U'"], random));
    lines.push(moves.join(" "));
  }
  return lines.join(" ");
}

/**
 * A random-move Square-1 scramble in WCA notation: before each slice, a turn
 * of the two layers drawn from those that let the slice turn. Twenty slices
 * mix the shape and pieces well.
 */
export function sq1Scramble(random: () => number = Math.random, slices = 20): string {
  let state = sq1Solved();
  const moves: string[] = [];
  for (let i = 0; i < slices; i++) {
    const options: string[] = [];
    for (let a = -5; a <= 6; a++)
      for (let b = -5; b <= 6; b++) {
        // Turning nothing between two slices would undo the last one.
        if (i > 0 && a === 0 && b === 0) continue;
        if (canSlice(sq1Apply(state, `(${a},${b})`))) options.push(`(${a},${b})`);
      }
    const turn = pick(options, random);
    state = sq1Apply(state, `${turn} /`);
    moves.push(turn === "(0,0)" ? "/" : `${turn} /`);
  }
  // End with a turn of the layers, as WCA scrambles often do.
  const a = wcaTurn(Math.floor(random() * 12));
  const b = wcaTurn(Math.floor(random() * 12));
  if (a || b) moves.push(`(${a},${b})`);
  return moves.join(" ");
}

export function scrambleFor(puzzle: TimerPuzzle, random: () => number = Math.random): string {
  const n = CUBE_N[puzzle];
  if (n) return cubeScramble(n, random);
  if (puzzle === "megaminx") return megaminxScramble(random);
  if (puzzle === "sq1") return sq1Scramble(random);
  if (puzzle === "skewb") return cornerScramble(["R", "U", "L", "B"], 11, random).join(" ");
  // Pyraminx: the big corners, then each tip turned (or not) on its own.
  const tips = ["u", "l", "r", "b"].flatMap((tip) => {
    const turn = pick(["", "'", null], random);
    return turn === null ? [] : [tip + turn];
  });
  return [...cornerScramble(["U", "L", "R", "B"], 10, random), ...tips].join(" ");
}

// Cell (row, col) of each face in an unfolded net, as a position on the cube.
// Faces are viewed from outside; the U face has B at its top edge, D has F at its top.
const NET_CELL: Record<Face, (row: number, col: number) => { pos: Vec; normal: Vec }> = {
  U: (r, c) => ({ pos: [c - 1, 1, r - 1], normal: [0, 1, 0] }),
  F: (r, c) => ({ pos: [c - 1, 1 - r, 1], normal: [0, 0, 1] }),
  R: (r, c) => ({ pos: [1, 1 - r, 1 - c], normal: [1, 0, 0] }),
  B: (r, c) => ({ pos: [1 - c, 1 - r, -1], normal: [0, 0, -1] }),
  L: (r, c) => ({ pos: [-1, 1 - r, c - 1], normal: [-1, 0, 0] }),
  D: (r, c) => ({ pos: [c - 1, -1, 1 - r], normal: [0, -1, 0] }),
};

/** The sticker colors of each face after a scramble, row-major, as the face each sticker belongs to. */
export function scrambledNet(scramble: string): Record<Face, Face[]> {
  return netOf(applyAlg(solvedCube(), scramble));
}

/** A 3x3 state's sticker colors as an unfolded net (see `scrambledNet`). */
export function netOf(state: Sticker[]): Record<Face, Face[]> {
  const net = {} as Record<Face, Face[]>;
  for (const face of Object.keys(NET_CELL) as Face[]) {
    net[face] = [];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        const { pos, normal } = NET_CELL[face](r, c);
        net[face].push(colorOf(stickerAt(state, pos, normal)));
      }
  }
  return net;
}

/** The same net for any cube size, or null when the scramble doesn't parse. */
export function scrambledNetN(scramble: string, n: number): Record<Face, Face[]> | null {
  try {
    if (n === 3) return scrambledNet(scramble);
    const state = applyMoves(solvedState(n), scramble, n);
    const net = {} as Record<Face, Face[]>;
    for (const face of NXN_FACES) net[face] = faceStickers(state, n, face).map((c) => NXN_FACES[c]);
    return net;
  } catch {
    return null;
  }
}
