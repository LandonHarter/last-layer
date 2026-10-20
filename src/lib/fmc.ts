import { applyAlg, isSolved, normalizeOrientation, solvedCube } from "./cube";
import { parseAlg, tokens } from "./notation";

/** WCA fewest moves scrambles start and end with R' U' F, so no solution starts by undoing the scramble. */
export const FMC_PADDING = "R' U' F";

const AXIS: Record<string, number> = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };

/** Wrap a random-state scramble in the padding, or null if a turn would merge across it. */
export function padScramble(inner: string): string | null {
  const moves = tokens(inner);
  if (!moves.length) return null;
  if (AXIS[moves[0][0]] === AXIS.F || AXIS[moves.at(-1)![0]] === AXIS.R) return null;
  return `${FMC_PADDING} ${inner} ${FMC_PADDING}`;
}

export type Counts = { htm: number; qtm: number; stm: number; etm: number };

/**
 * Move counts in the usual metrics. HTM (what FMC uses): any turn of a face or
 * a wide pair is 1, a slice is 2, rotations are free. QTM counts quarter turns.
 * STM counts a slice as 1. ETM counts everything, rotations too.
 */
export function countMoves(alg: string): Counts {
  const counts = { htm: 0, qtm: 0, stm: 0, etm: 0 };
  for (const { base, turns } of parseAlg(alg)) {
    counts.etm++;
    if (/^[xyz]$/.test(base)) continue;
    const slice = /^[MES]$/.test(base);
    const quarters = turns === 2 ? 2 : 1;
    counts.htm += slice ? 2 : 1;
    counts.qtm += quarters * (slice ? 2 : 1);
    counts.stm += 1;
  }
  return counts;
}

export type Check = { ok: true; solved: boolean; moves: number; slices: boolean } | { ok: false; error: string };

/** Whether `solution` solves `scramble` (rotations allowed), and its HTM length. */
export function checkSolution(scramble: string, solution: string): Check {
  try {
    const moves = countMoves(solution).htm;
    const state = applyAlg(applyAlg(solvedCube(), scramble), solution);
    let solved = false;
    try {
      solved = isSolved(normalizeOrientation(state));
    } catch {
      solved = false;
    }
    return { ok: true, solved, moves, slices: parseAlg(solution).some((m) => /^[MES]$/.test(m.base)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
