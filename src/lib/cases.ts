import { applyAlg, f2lSolved, isSolved, keepsOrientation, solvedCube, topOriented, type Sticker } from "./cube";
import { invertAlg, parseAlg, simplifyAlg } from "./notation";

export type AlgSet = "F2L" | "OLL" | "PLL";

export const AUFS = ["", "U", "U2", "U'"] as const;

/** The step an algorithm finishes: F2L slot, oriented top, or a solved cube. */
export function stepDone(set: AlgSet, state: Sticker[]): boolean {
  if (set === "F2L") return f2lSolved(state);
  if (set === "OLL") return f2lSolved(state) && topOriented(state);
  return isSolved(state);
}

/** The state a case starts from: undo its reference algorithm on a solved cube. */
export function caseState(reference: string): Sticker[] {
  return applyAlg(solvedCube(), invertAlg(reference));
}

/**
 * If `candidate` solves the case that `reference` solves, return it with any
 * turn of the top needed first (and, for PLL, after) so it solves the case
 * exactly as pictured. Otherwise null.
 */
export function fitAlg(set: AlgSet, reference: string, candidate: string): string | null {
  let clean: string;
  try {
    clean = simplifyAlg(candidate);
  } catch {
    return null;
  }
  if (!clean || !keepsOrientation(clean)) return null;
  const start = caseState(reference);
  for (const before of AUFS) {
    const state = applyAlg(start, `${before} ${clean}`);
    if (set !== "PLL") {
      if (stepDone(set, state)) return simplifyAlg(`${before} ${clean}`);
      continue;
    }
    for (const after of AUFS) {
      if (isSolved(after ? applyAlg(state, after) : state)) return simplifyAlg(`${before} ${clean} ${after}`);
    }
  }
  return null;
}

/** True when doing `setup` then some turn of the top then `alg` finishes the step. */
export function setupWorks(set: AlgSet, setup: string, alg: string): boolean {
  const state = applyAlg(solvedCube(), setup);
  return AUFS.some((before) => {
    const done = applyAlg(state, `${before} ${alg}`);
    if (set !== "PLL") return stepDone(set, done);
    return AUFS.some((after) => isSolved(after ? applyAlg(done, after) : done));
  });
}

/** Cheap check that an alg string parses. */
export function isValidNotation(alg: string): boolean {
  try {
    return parseAlg(alg).length > 0;
  } catch {
    return false;
  }
}
