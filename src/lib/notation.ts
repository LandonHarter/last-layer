export type Move = {
  /** Face, slice, wide or rotation letter: R, r, Rw, M, x, … */
  base: string;
  /** Quarter turns clockwise: 1, 2 or 3 (3 = prime). */
  turns: 1 | 2 | 3;
};

const MOVE_RE = /^([RLUDFBrludfbMESxyz]w?)(2|')?$/;

export function parseAlg(alg: string): Move[] {
  return alg
    .replace(/[()[\]]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      // Tolerate "2'" and "'2" which some sources use for a half turn.
      const normalized = token.replace(/2'|'2/, "2").replace("’", "'");
      const match = MOVE_RE.exec(normalized);
      if (!match) throw new Error(`Unknown move "${token}" in "${alg}"`);
      const turns = match[2] === "2" ? 2 : match[2] === "'" ? 3 : 1;
      return { base: match[1], turns };
    });
}

export function formatMove({ base, turns }: Move): string {
  return base + (turns === 2 ? "2" : turns === 3 ? "'" : "");
}

export function formatAlg(moves: Move[]): string {
  return moves.map(formatMove).join(" ");
}

export function invertAlg(alg: string): string {
  return formatAlg(
    parseAlg(alg)
      .reverse()
      .map((m) => ({ base: m.base, turns: (4 - m.turns) as 1 | 2 | 3 })),
  );
}

export function splitMoves(alg: string): string[] {
  return formatAlg(parseAlg(alg)).split(" ");
}

/** Merge neighbouring turns of the same layer: "U U2" → "U'", "R R'" → "". */
export function simplifyAlg(alg: string): string {
  const out: Move[] = [];
  for (const move of parseAlg(alg)) {
    const last = out.at(-1);
    if (last && last.base === move.base) {
      const turns = (last.turns + move.turns) % 4;
      if (turns === 0) out.pop();
      else last.turns = turns as 1 | 2 | 3;
    } else {
      out.push({ ...move });
    }
  }
  return formatAlg(out);
}

/** Number of turns, not counting whole-cube rotations. */
export function moveCount(alg: string): number {
  return parseAlg(alg).filter((m) => !/^[xyz]/.test(m.base)).length;
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

export function mirrorAlg(alg: string, plane: "M" | "FR"): string {
  return formatAlg(
    parseAlg(alg).map(({ base, turns }) => {
      const wide = base.endsWith("w");
      const [next, flip] = MIRRORS[plane][base[0]];
      return { base: next + (wide ? "w" : ""), turns: flip ? ((4 - turns) as 1 | 2 | 3) : turns };
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
    turns %= 4;
    if (!turns) return;
    let i = out.length - 1;
    if (i >= 0 && out[i].base !== base && out[i].base === OPPOSITE[base]) i--;
    if (i >= 0 && out[i].base === base) {
      const sum = (out[i].turns + turns) % 4;
      if (sum === 0) out.splice(i, 1);
      else out[i].turns = sum as 1 | 2 | 3;
    } else {
      out.push({ base, turns: turns as 1 | 2 | 3 });
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
