import { applyAlg, colorOf, solvedCube, stickerAt, type Face, type Vec } from "./cube";

const FACES = ["U", "D", "R", "L", "F", "B"] as const;
const AXIS: Record<string, number> = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
const SUFFIXES = ["", "'", "2"];

/**
 * A random-move 3x3 scramble. It never turns the same face twice in a row and
 * never does three turns on one axis in a row (R L R), so no moves cancel.
 */
export function randomScramble(length = 20, random: () => number = Math.random): string {
  const moves: string[] = [];
  const faces: string[] = [];
  while (moves.length < length) {
    const face = FACES[Math.floor(random() * FACES.length)];
    const last = faces.at(-1);
    const beforeLast = faces.at(-2);
    if (face === last) continue;
    if (last && beforeLast && AXIS[face] === AXIS[last] && face === beforeLast) continue;
    faces.push(face);
    moves.push(face + SUFFIXES[Math.floor(random() * SUFFIXES.length)]);
  }
  return moves.join(" ");
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
  const state = applyAlg(solvedCube(), scramble);
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
