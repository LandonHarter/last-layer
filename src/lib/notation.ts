import { formatSq1, invertSq1, looksSq1, mirrorSq1, parseSq1, simplifySq1, sliceCount, sq1Tokens } from "./sq1";

export type Move = {
  /** Face, slice, wide or rotation letter: R, r, Rw, 3Rw, 2R, M, x, BR (megaminx), … */
  base: string;
  /** Turns clockwise: 1 to 3 on a cube (3 = prime), 1 to 4 on a megaminx (4 = prime). */
  turns: number;
};

/**
 * The megaminx is the one puzzle whose faces turn in fifths, so its moves
 * parse differently. The Square-1 writes (a,b) for turns of its two layers and
 * / for the slice; as moves, (a,b) is U by a twelfths then D by b, and / is "/".
 */
export type Notation = "cube" | "megaminx" | "sq1";

// Cubes: outer, wide (Rw, 3Rw, r), inner slice (2R), slice and rotation moves.
const CUBE_RE = /^(\d?[RLUDFBrludfb]w|\d?[RLUDFB]|[rludfbMESxyz])(2|')?$/;
// Megaminx: R2 is two fifths clockwise and R2' two fifths back, so "2'" is its own suffix.
const MEGA_RE = /^(DBR|DBL|BR|BL|DR|DL|[URFLDB]|y)(2'|2|')?$/;

const ORDER: Record<Notation, number> = { cube: 4, megaminx: 5, sq1: 12 };

/** Moves as written, one per token, with brackets dropped. */
export function tokens(alg: string): string[] {
  return alg.replace(/[()[\]]/g, " ").replace(/’/g, "'").split(/\s+/).filter(Boolean);
}

export function parseAlg(alg: string, notation: Notation = "cube"): Move[] {
  if (notation === "sq1") {
    return parseSq1(alg).flatMap((m) =>
      m === "/" ? [{ base: "/", turns: 1 }] : [{ base: "U", turns: ((m.top % 12) + 12) % 12 }, { base: "D", turns: ((m.bottom % 12) + 12) % 12 }],
    );
  }
  const order = ORDER[notation];
  return tokens(alg).map((token) => {
    // Tolerate "2'" and "'2" which some sources use for a cube half turn.
    const normalized = notation === "cube" ? token.replace(/2'|'2/, "2") : token;
    const match = (notation === "cube" ? CUBE_RE : MEGA_RE).exec(normalized);
    if (!match) throw new Error(`Unknown move "${token}" in "${alg}"`);
    const suffix = match[2] ?? "";
    const turns = suffix === "2" ? 2 : suffix === "2'" ? order - 2 : suffix === "'" ? order - 1 : 1;
    return { base: match[1], turns };
  });
}

export function formatMove({ base, turns }: Move, notation: Notation = "cube"): string {
  const order = ORDER[notation];
  if (turns === 1) return base;
  if (turns === 2) return `${base}2`;
  if (turns === order - 1) return `${base}'`;
  return `${base}2'`;
}

export function formatAlg(moves: Move[], notation: Notation = "cube"): string {
  if (notation === "sq1") {
    return formatSq1(moves.map((m) => (m.base === "/" ? "/" : m.base === "U" ? { top: m.turns, bottom: 0 } : { top: 0, bottom: m.turns })));
  }
  return moves.map((m) => formatMove(m, notation)).join(" ");
}

export function invertAlg(alg: string, notation: Notation = "cube"): string {
  if (notation === "sq1") return invertSq1(alg);
  const order = ORDER[notation];
  return formatAlg(
    parseAlg(alg, notation)
      .reverse()
      .map((m) => ({ base: m.base, turns: order - m.turns })),
    notation,
  );
}

/** The moves of an algorithm, one string each, the way they're written. A Square-1 alg splits into (a,b) and /. */
export function splitMoves(alg: string): string[] {
  return looksSq1(alg) ? sq1Tokens(alg) : tokens(alg);
}

/** Merge neighbouring turns of the same layer: "U U2" → "U'", "R R'" → "". */
export function simplifyAlg(alg: string, notation: Notation = "cube"): string {
  if (notation === "sq1") return simplifySq1(alg);
  const order = ORDER[notation];
  const out: Move[] = [];
  for (const move of parseAlg(alg, notation)) {
    const last = out.at(-1);
    if (last && last.base === move.base) {
      const turns = (last.turns + move.turns) % order;
      if (turns === 0) out.pop();
      else last.turns = turns;
    } else {
      out.push({ ...move });
    }
  }
  return formatAlg(out, notation);
}

/** Number of turns, not counting whole-puzzle rotations. A Square-1 alg counts its slices. */
export function moveCount(alg: string): number {
  if (looksSq1(alg)) return sliceCount(alg);
  return tokens(alg).filter((m) => !/^[xyz]/.test(m)).length;
}

/**
 * Mirror tables: each move maps to [new base, whether its direction flips].
 * "M" reflects left↔right, so an OLL or PLL alg becomes the alg for the
 * mirrored case. "FR" reflects through the front-right edge, so an F2L alg for
 * the front-right slot becomes the mirrored case in the same slot.
 */
const MIRRORS: Record<"M" | "FR", Record<string, [string, boolean]>> = {
  M: {
    R: ["L", true], L: ["R", true], r: ["l", true], l: ["r", true],
    U: ["U", true], D: ["D", true], F: ["F", true], B: ["B", true],
    u: ["u", true], d: ["d", true], f: ["f", true], b: ["b", true],
    M: ["M", false], E: ["E", true], S: ["S", true],
    x: ["x", false], y: ["y", true], z: ["z", true],
  },
  FR: {
    R: ["F", true], F: ["R", true], L: ["B", true], B: ["L", true],
    r: ["f", true], f: ["r", true], l: ["b", true], b: ["l", true],
    U: ["U", true], D: ["D", true], u: ["u", true], d: ["d", true],
    M: ["S", false], S: ["M", false], E: ["E", true],
    x: ["z", true], z: ["x", true], y: ["y", true],
  },
};

// Megaminx: left for right, every turn reversed.
const MEGA_MIRROR: Record<string, string> = {
  U: "U", F: "F", D: "D", B: "B", R: "L", L: "R", BR: "BL", BL: "BR", DR: "DL", DL: "DR", DBR: "DBL", DBL: "DBR", y: "y",
};

export function mirrorAlg(alg: string, plane: "M" | "FR", notation: Notation = "cube"): string {
  if (notation === "sq1") return mirrorSq1(alg);
  if (notation === "megaminx") {
    return formatAlg(parseAlg(alg, notation).map(({ base, turns }) => ({ base: MEGA_MIRROR[base], turns: 5 - turns })), notation);
  }
  return formatAlg(
    parseAlg(alg).map(({ base, turns }) => {
      const [, layers = "", letter, wide = ""] = /^(\d?)([A-Za-z])(w?)$/.exec(base)!;
      const [next, flip] = MIRRORS[plane][letter];
      return { base: layers + next + wide, turns: flip ? 4 - turns : turns };
    }),
  );
}

// A wide, slice or rotation move as face turns plus a whole-cube rotation:
// r = L x, M = R L' x', and so on. Face turns are listed for one clockwise turn.
const AS_FACES: Record<string, { faces: [string, 1 | 3][]; rotation?: string }> = {
  r: { faces: [["L", 1]], rotation: "x" },
  l: { faces: [["R", 1]], rotation: "x'" },
  u: { faces: [["D", 1]], rotation: "y" },
  d: { faces: [["U", 1]], rotation: "y'" },
  f: { faces: [["B", 1]], rotation: "z" },
  b: { faces: [["F", 1]], rotation: "z'" },
  M: { faces: [["R", 1], ["L", 3]], rotation: "x'" },
  E: { faces: [["U", 1], ["D", 3]], rotation: "y'" },
  S: { faces: [["F", 3], ["B", 1]], rotation: "z" },
  x: { faces: [], rotation: "x" },
  y: { faces: [], rotation: "y" },
  z: { faces: [], rotation: "z" },
};

// After one clockwise rotation, the face that moves into each position.
const ROTATION_FROM: Record<"x" | "y" | "z", Record<string, string>> = {
  x: { U: "F", F: "D", D: "B", B: "U", R: "R", L: "L" },
  y: { F: "R", R: "B", B: "L", L: "F", U: "U", D: "D" },
  z: { U: "L", R: "U", D: "R", L: "D", F: "F", B: "B" },
};

const OPPOSITE: Record<string, string> = { R: "L", L: "R", U: "D", D: "U", F: "B", B: "F" };

/**
 * The same alg with only outer face turns (R U F …), for someone holding the
 * cube still: wide and slice moves and rotations become face turns on the
 * faces they now point at. Turns that cancel are merged, including across a
 * turn of the opposite face (R L R' → L).
 */
export function faceTurnsOnly(alg: string): string {
  // Where each face of the held cube has gone after the rotations so far.
  let frame: Record<string, string> = { R: "R", L: "L", U: "U", D: "D", F: "F", B: "B" };
  const out: Move[] = [];
  const push = (base: string, turns: number) => {
    turns = ((turns % 4) + 4) % 4;
    if (!turns) return;
    let i = out.length - 1;
    if (i >= 0 && out[i].base !== base && out[i].base === OPPOSITE[base]) i--;
    if (i >= 0 && out[i].base === base) {
      const sum = (out[i].turns + turns) % 4;
      if (sum === 0) out.splice(i, 1);
      else out[i].turns = sum;
    } else {
      out.push({ base, turns });
    }
  };
  for (const { base, turns } of parseAlg(alg)) {
    const key = base.endsWith("w") ? base[0].toLowerCase() : base;
    const def = AS_FACES[key];
    if (!def) {
      push(frame[key], turns);
      continue;
    }
    for (const [face, dir] of def.faces) push(frame[face], dir * turns);
    if (!def.rotation) continue;
    const axis = def.rotation[0] as "x" | "y" | "z";
    const quarters = ((def.rotation.endsWith("'") ? 3 : 1) * turns) % 4;
    for (let q = 0; q < quarters; q++) {
      const from = ROTATION_FROM[axis];
      frame = Object.fromEntries(Object.keys(frame).map((f) => [f, frame[from[f]]]));
    }
  }
  return formatAlg(out);
}

/**
 * Any cube's alg with the rotations (x, y, z) taken out: the moves after one
 * are renamed to the faces they now point at. Wide and slice moves stay as
 * they are, so this works on a 4x4 where `faceTurnsOnly` would not.
 */
export function withoutRotations(alg: string): string {
  let frame: Record<string, string> = { R: "R", L: "L", U: "U", D: "D", F: "F", B: "B" };
  const out: Move[] = [];
  for (const { base, turns } of parseAlg(alg)) {
    if (/^[xyz]$/.test(base)) {
      for (let q = 0; q < turns; q++) {
        const from = ROTATION_FROM[base as "x" | "y" | "z"];
        frame = Object.fromEntries(Object.keys(frame).map((f) => [f, frame[from[f]]]));
      }
      continue;
    }
    if (/^[MES]$/.test(base)) throw new Error("Slice moves need a rotation-aware rewrite");
    const m = /^(\d?)([A-Za-z])(w?)$/.exec(base)!;
    const lower = m[2] !== m[2].toUpperCase();
    const face = frame[m[2].toUpperCase()];
    out.push({ base: m[1] + (lower ? face.toLowerCase() : face) + m[3], turns });
  }
  return formatAlg(out);
}

/** What `moveCount` counts, for labels: "moves", or "slices" on a Square-1. */
export const countUnit = (alg: string, n: number) => (looksSq1(alg) ? (n === 1 ? "slice" : "slices") : n === 1 ? "move" : "moves");
