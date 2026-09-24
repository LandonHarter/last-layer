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
