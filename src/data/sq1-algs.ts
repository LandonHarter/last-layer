import type { AlgSet } from "@/lib/puzzles";

/**
 * Square-1 cases, Vandenbergh style: cubeshape, then corner and edge
 * orientation, corner and edge permutation, and parity. Each list starts with
 * the default algorithm, then alternatives. Every one was checked with the
 * Square-1 simulator (`sq1.ts`) and given the turn it needs first.
 *
 * Sources: CO, EO, CP and EP from speedcubedb.com; parity from its Lin
 * parity PLLs (the cases with the corners solved). Cubeshape algorithms from
 * speedcubedb where they matched their case, plus the shortest solutions from
 * a search over every shape (169 cases, all of them). Layer shapes are named
 * the way you see them: the top from above, the bottom from below. Other
 * alternatives are mirrors and inverses of algorithms in the same set.
 *
 * Notation: (a,b) turns the top a twelfths clockwise and the bottom b twelfths
 * clockwise (each seen from its own side); / turns the right half.
 */
export const SQ1_ALGS: { id: string; set: AlgSet; name: string; group: string; algs: string[] }[] = [
  { id: "sq1-cs-kite-kite", set: "sq1-CS", name: "Kite / Kite", group: "1 slice", algs: [
    "/",
  ] },
  { id: "sq1-cs-barrel-barrel", set: "sq1-CS", name: "Barrel / Barrel", group: "2 slices", algs: [
    "/ (3,3) /",
  ] },
  { id: "sq1-cs-left-fist-right-fist", set: "sq1-CS", name: "Left fist / Right fist", group: "2 slices", algs: [
    "/ (3,0) / (-1,1)",
    "(3,3) / (0,-3) /",
  ] },
  { id: "sq1-cs-right-fist-left-fist", set: "sq1-CS", name: "Right fist / Left fist", group: "2 slices", algs: [
    "/ (3,0) /",
    "(3,3) / (0,-3) /",
  ] },
  { id: "sq1-cs-barrel-kite", set: "sq1-CS", name: "Barrel / Kite", group: "3 slices", algs: [
    "/ (-3,0) / (-3,0) /",
    "(3,6) / (0,3) / (3,0) /",
    "(3,6) / (3,6) / (0,-3) /",
  ] },
  { id: "sq1-cs-kite-barrel", set: "sq1-CS", name: "Kite / Barrel", group: "3 slices", algs: [
    "/ (0,3) / (0,3) /",
    "(6,3) / (3,6) / (3,6) /",
  ] },
  { id: "sq1-cs-kite-scallop", set: "sq1-CS", name: "Kite / Scallop", group: "3 slices", algs: [
    "/ (2,1) / (0,3) /",
    "(6,6) / (1,2) / (0,3) /",
    "(6,6) / (4,5) / (3,6) /",
  ] },
  { id: "sq1-cs-left-paw-right-paw", set: "sq1-CS", name: "Left paw / Right paw", group: "3 slices", algs: [
    "/ (-1,4) / (-3,0) /",
    "(6,6) / (1,-4) / (0,3) /",
    "(6,6) / (4,-1) / (3,6) /",
  ] },
  { id: "sq1-cs-muffin-muffin", set: "sq1-CS", name: "Muffin / Muffin", group: "3 slices", algs: [
    "/ (-2,0) / (3,3) /",
    "/ (1,3) / (3,3) /",
  ] },
  { id: "sq1-cs-muffin-square", set: "sq1-CS", name: "Muffin / Square", group: "3 slices", algs: [
    "/ (2,0) / (3,0) /",
    "(5,2) / (1,3) / (3,0) /",
    "(5,2) / (4,6) / (0,-3) /",
  ] },
  { id: "sq1-cs-right-paw-left-paw", set: "sq1-CS", name: "Right paw / Left paw", group: "3 slices", algs: [
    "/ (-4,1) / (3,0) /",
    "(6,6) / (1,-4) / (3,0) /",
    "(6,6) / (4,-1) / (0,-3) /",
  ] },
  { id: "sq1-cs-scallop-kite", set: "sq1-CS", name: "Scallop / Kite", group: "3 slices", algs: [
    "/ (-1,-2) / (-3,0) /",
    "(6,6) / (1,2) / (3,0) /",
    "(6,6) / (4,5) / (0,-3) /",
  ] },
  { id: "sq1-cs-scallop-scallop", set: "sq1-CS", name: "Scallop / Scallop", group: "3 slices", algs: [
    "/ (1,2) / (-3,-3) /",
    "/ (-2,-1) / (3,3) /",
  ] },
  { id: "sq1-cs-shield-shield", set: "sq1-CS", name: "Shield / Shield", group: "3 slices", algs: [
    "/ (1,0) / (-3,-3) /",
    "(-2,-2) / (0,5) / (3,3) /",
  ] },
  { id: "sq1-cs-shield-square", set: "sq1-CS", name: "Shield / Square", group: "3 slices", algs: [
    "/ (-1,0) / (-3,0) /",
    "(6,0) / (0,-1) / (3,6) /",
    "(6,0) / (3,2) / (3,0) /",
  ] },
  { id: "sq1-cs-square-muffin", set: "sq1-CS", name: "Square / Muffin", group: "3 slices", algs: [
    "/ (0,-2) / (0,-3) /",
    "/ (3,1) / (0,3) /",
  ] },
  { id: "sq1-cs-square-shield", set: "sq1-CS", name: "Square / Shield", group: "3 slices", algs: [
    "/ (0,1) / (0,3) /",
    "/ (3,4) / (3,6) /",
  ] },
  { id: "sq1-cs-2-2-2-pair", set: "sq1-CS", name: "2-2-2 / Pair", group: "4 slices", algs: [
    "/ (-2,0) / (0,1) / (3,3) /",
    "(0,-4) / (2,0) / (0,5) / (3,3) /",
  ] },
  { id: "sq1-cs-3-1-2-perpendicular-edges", set: "sq1-CS", name: "3-1-2 / Perpendicular edges", group: "4 slices", algs: [
    "/ (-1,-2) / (0,1) / (0,3) /",
    "(6,6) / (2,0) / (0,-1) / (3,6) /",
    "(6,6) / (2,0) / (3,2) / (3,0) /",
  ] },
  { id: "sq1-cs-3-2-1-perpendicular-edges", set: "sq1-CS", name: "3-2-1 / Perpendicular edges", group: "4 slices", algs: [
    "/ (0,-2) / (0,1) / (0,3) /",
    "/ (0,4) / (1,0) / (0,3) /",
    "/ (0,4) / (4,3) / (3,6) /",
  ] },
  { id: "sq1-cs-3-3-perpendicular-edges", set: "sq1-CS", name: "3-3 / Perpendicular edges", group: "4 slices", algs: [
    "/ (0,-2) / (-1,4) / (-3,0) /",
    "(4,4) / (2,0) / (1,-4) / (0,3) /",
    "(4,4) / (2,0) / (4,-1) / (3,6) /",
  ] },
  { id: "sq1-cs-4-1-1-pair", set: "sq1-CS", name: "4-1-1 / Pair", group: "4 slices", algs: [
    "/ (0,4) / (4,-1) / (-3,0) / (-1,1)",
    "(-2,-2) / (2,6) / (1,-4) / (0,3) /",
    "(-2,-2) / (2,6) / (4,-1) / (3,6) /",
  ] },
  { id: "sq1-cs-4-1-1-perpendicular-edges", set: "sq1-CS", name: "4-1-1 / Perpendicular edges", group: "4 slices", algs: [
    "/ (0,-2) / (2,1) / (0,3) /",
    "(-4,4) / (2,0) / (1,2) / (3,0) /",
    "(-4,4) / (2,0) / (4,5) / (0,-3) /",
  ] },
  { id: "sq1-cs-4-4-star", set: "sq1-CS", name: "4-4 / Star", group: "4 slices", algs: [
    "/ (2,2) / (0,-1) / (3,3) /",
    "(4,0) / (2,2) / (1,2) / (3,3) /",
  ] },
  { id: "sq1-cs-6-pair", set: "sq1-CS", name: "6 / Pair", group: "4 slices", algs: [
    "/ (0,4) / (1,2) / (-3,-3) /",
    "(-2,-2) / (2,6) / (1,2) / (3,3) /",
  ] },
  { id: "sq1-cs-6-2-star", set: "sq1-CS", name: "6-2 / Star", group: "4 slices", algs: [
    "/ (-4,-2) / (-1,4) / (-3,0) /",
    "/ (2,4) / (1,-4) / (0,3) /",
    "/ (2,4) / (4,-1) / (3,6) /",
  ] },
  { id: "sq1-cs-8-star", set: "sq1-CS", name: "8 / Star", group: "4 slices", algs: [
    "/ (2,4) / (-2,-1) / (3,3) /",
    "/ (2,4) / (1,2) / (3,3) /",
  ] },
  { id: "sq1-cs-barrel-scallop", set: "sq1-CS", name: "Barrel / Scallop", group: "4 slices", algs: [
    "/ (0,-4) / (0,1) / (3,3) /",
    "(3,6) / (0,-5) / (0,2) / (3,3) /",
  ] },
  { id: "sq1-cs-left-4-2-pair", set: "sq1-CS", name: "Left 4-2 / Pair", group: "4 slices", algs: [
    "/ (0,4) / (1,0) / (-3,-3) /",
  ] },
  { id: "sq1-cs-left-4-2-parallel-edges", set: "sq1-CS", name: "Left 4-2 / Parallel edges", group: "4 slices", algs: [
    "/ (2,3) / (-2,-1) / (-3,0) / (-1,1)",
    "/ (2,3) / (1,2) / (3,0) /",
    "/ (2,3) / (4,5) / (0,-3) /",
  ] },
  { id: "sq1-cs-left-5-1-pair", set: "sq1-CS", name: "Left 5-1 / Pair", group: "4 slices", algs: [
    "/ (-3,2) / (-2,-1) / (0,-3) / (-1,1)",
    "(6,6) / (2,-3) / (1,2) / (3,0) /",
    "(6,6) / (2,-3) / (4,5) / (0,-3) /",
  ] },
  { id: "sq1-cs-left-5-1-perpendicular-edges", set: "sq1-CS", name: "Left 5-1 / Perpendicular edges", group: "4 slices", algs: [
    "/ (0,4) / (1,2) / (0,3) / (-1,1)",
    "/ (0,4) / (4,5) / (3,6) /",
  ] },
  { id: "sq1-cs-left-fist-right-paw", set: "sq1-CS", name: "Left fist / Right paw", group: "4 slices", algs: [
    "/ (-1,0) / (0,1) / (0,3) /",
    "(6,6) / (-2,0) / (-1,0) / (-3,0) /",
    "(-4,6) / (1,0) / (0,-3) / (3,6) /",
  ] },
  { id: "sq1-cs-left-paw-right-fist", set: "sq1-CS", name: "Left paw / Right fist", group: "4 slices", algs: [
    "/ (0,1) / (-1,0) / (-3,0) /",
    "(6,6) / (0,2) / (0,1) / (0,3) /",
    "(6,4) / (0,2) / (0,3) / (0,3) /",
  ] },
  { id: "sq1-cs-muffin-shield", set: "sq1-CS", name: "Muffin / Shield", group: "4 slices", algs: [
    "/ (3,0) / (-1,-2) / (0,-3) /",
    "(-1,-2) / (0,-3) / (1,2) / (3,0) /",
    "(-1,-2) / (0,-3) / (4,5) / (0,-3) /",
  ] },
  { id: "sq1-cs-pair-2-2-2", set: "sq1-CS", name: "Pair / 2-2-2", group: "4 slices", algs: [
    "/ (0,2) / (-1,0) / (-3,-3) /",
    "(4,0) / (0,-2) / (1,0) / (3,3) /",
  ] },
  { id: "sq1-cs-pair-4-1-1", set: "sq1-CS", name: "Pair / 4-1-1", group: "4 slices", algs: [
    "/ (-4,0) / (4,-1) / (-3,0) / (-1,1)",
    "(6,6) / (0,-4) / (1,-4) / (3,0) /",
    "(6,6) / (0,-4) / (4,-1) / (0,-3) /",
  ] },
  { id: "sq1-cs-pair-6", set: "sq1-CS", name: "Pair / 6", group: "4 slices", algs: [
    "/ (-4,0) / (-2,-1) / (3,3) /",
    "(6,6) / (0,-4) / (1,2) / (3,3) /",
  ] },
  { id: "sq1-cs-pair-left-4-2", set: "sq1-CS", name: "Pair / Left 4-2", group: "4 slices", algs: [
    "/ (-2,0) / (1,2) / (-3,-3) /",
    "(6,6) / (0,-2) / (1,2) / (3,3) /",
  ] },
  { id: "sq1-cs-pair-left-5-1", set: "sq1-CS", name: "Pair / Left 5-1", group: "4 slices", algs: [
    "(4,-4) / (2,-3) / (2,1) / (3,0) /",
    "(4,-4) / (2,-3) / (5,4) / (0,-3) /",
  ] },
  { id: "sq1-cs-pair-right-4-2", set: "sq1-CS", name: "Pair / Right 4-2", group: "4 slices", algs: [
    "/ (0,2) / (2,1) / (3,3) /",
    "(6,6) / (2,0) / (2,1) / (3,3) /",
  ] },
  { id: "sq1-cs-pair-right-5-1", set: "sq1-CS", name: "Pair / Right 5-1", group: "4 slices", algs: [
    "/ (-2,3) / (-2,-1) / (-3,0) / (-1,1)",
    "/ (4,-3) / (2,1) / (3,0) /",
    "/ (4,-3) / (5,4) / (0,-3) /",
  ] },
  { id: "sq1-cs-parallel-edges-left-4-2", set: "sq1-CS", name: "Parallel edges / Left 4-2", group: "4 slices", algs: [
    "/ (3,2) / (-1,-2) / (0,-3) /",
    "/ (3,2) / (2,1) / (0,3) /",
    "/ (3,2) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-parallel-edges-right-4-2", set: "sq1-CS", name: "Parallel edges / Right 4-2", group: "4 slices", algs: [
    "/ (-3,-2) / (1,2) / (0,3) / (-1,1)",
    "/ (3,4) / (2,1) / (0,3) /",
    "/ (3,4) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-perpendicular-edges-3-1-2", set: "sq1-CS", name: "Perpendicular edges / 3-1-2", group: "4 slices", algs: [
    "/ (2,0) / (-1,0) / (-3,0) /",
    "/ (2,0) / (2,3) / (3,0) /",
    "/ (2,0) / (5,6) / (0,-3) /",
  ] },
  { id: "sq1-cs-perpendicular-edges-3-2-1", set: "sq1-CS", name: "Perpendicular edges / 3-2-1", group: "4 slices", algs: [
    "/ (2,1) / (-1,0) / (-3,0) /",
    "(6,6) / (0,4) / (0,1) / (0,3) /",
    "(6,6) / (0,4) / (3,4) / (3,6) /",
  ] },
  { id: "sq1-cs-perpendicular-edges-3-3", set: "sq1-CS", name: "Perpendicular edges / 3-3", group: "4 slices", algs: [
    "/ (-2,0) / (-5,2) / (0,3) / (-1,1)",
    "(6,6) / (0,-2) / (1,-4) / (0,3) /",
    "(6,6) / (0,-2) / (4,-1) / (3,6) /",
  ] },
  { id: "sq1-cs-perpendicular-edges-4-1-1", set: "sq1-CS", name: "Perpendicular edges / 4-1-1", group: "4 slices", algs: [
    "/ (2,0) / (-1,-2) / (-3,0) /",
    "(-4,4) / (0,-2) / (1,2) / (0,3) /",
    "(-4,4) / (0,-2) / (4,5) / (3,6) /",
  ] },
  { id: "sq1-cs-perpendicular-edges-left-5-1", set: "sq1-CS", name: "Perpendicular edges / Left 5-1", group: "4 slices", algs: [
    "/ (4,0) / (-1,-2) / (-3,0) /",
    "/ (4,0) / (2,1) / (3,0) /",
    "/ (4,0) / (5,4) / (0,-3) /",
  ] },
  { id: "sq1-cs-perpendicular-edges-right-5-1", set: "sq1-CS", name: "Perpendicular edges / Right 5-1", group: "4 slices", algs: [
    "/ (-4,0) / (-2,-1) / (-3,0) / (-1,1)",
    "(6,6) / (0,-4) / (1,2) / (0,3) /",
    "(6,6) / (0,-4) / (4,5) / (3,6) /",
  ] },
  { id: "sq1-cs-right-4-2-pair", set: "sq1-CS", name: "Right 4-2 / Pair", group: "4 slices", algs: [
    "/ (2,0) / (-2,-1) / (3,3) /",
    "/ (2,0) / (1,2) / (3,3) /",
  ] },
  { id: "sq1-cs-right-4-2-parallel-edges", set: "sq1-CS", name: "Right 4-2 / Parallel edges", group: "4 slices", algs: [
    "/ (-2,-3) / (-1,-2) / (-3,0) /",
    "(-4,0) / (4,0) / (2,-3) / (-1,-2) / (-3,0) /",
    "(6,6) / (3,4) / (1,2) / (0,3) /",
  ] },
  { id: "sq1-cs-right-5-1-pair", set: "sq1-CS", name: "Right 5-1 / Pair", group: "4 slices", algs: [
    "/ (3,-2) / (-1,-2) / (0,-3) /",
    "/ (3,-2) / (2,1) / (0,3) /",
    "/ (3,-2) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-right-5-1-perpendicular-edges", set: "sq1-CS", name: "Right 5-1 / Perpendicular edges", group: "4 slices", algs: [
    "/ (0,-4) / (2,1) / (0,3) /",
    "(6,6) / (2,6) / (1,2) / (3,0) /",
    "(6,6) / (2,6) / (4,5) / (0,-3) /",
  ] },
  { id: "sq1-cs-right-fist-left-paw", set: "sq1-CS", name: "Right fist / Left paw", group: "4 slices", algs: [
    "/ (0,-4) / (0,1) / (0,3) /",
    "(-3,0) / (0,5) / (0,-2) / (0,-3) /",
    "(-3,0) / (0,5) / (3,1) / (0,3) /",
  ] },
  { id: "sq1-cs-right-paw-left-fist", set: "sq1-CS", name: "Right paw / Left fist", group: "4 slices", algs: [
    "/ (4,0) / (-1,0) / (-3,0) /",
    "/ (0,2) / (1,0) / (3,0) /",
    "/ (0,2) / (4,3) / (0,-3) /",
  ] },
  { id: "sq1-cs-scallop-barrel", set: "sq1-CS", name: "Scallop / Barrel", group: "4 slices", algs: [
    "/ (4,0) / (-1,0) / (-3,-3) /",
    "(0,6) / (0,-4) / (1,0) / (3,3) /",
  ] },
  { id: "sq1-cs-shield-muffin", set: "sq1-CS", name: "Shield / Muffin", group: "4 slices", algs: [
    "/ (0,-3) / (2,1) / (3,0) /",
    "(6,6) / (3,6) / (1,2) / (0,3) /",
    "(6,6) / (3,6) / (4,5) / (3,6) /",
  ] },
  { id: "sq1-cs-star-4-4", set: "sq1-CS", name: "Star / 4-4", group: "4 slices", algs: [
    "/ (-2,-2) / (1,0) / (-3,-3) /",
    "(0,2) / (4,4) / (2,1) / (3,3) /",
  ] },
  { id: "sq1-cs-star-6-2", set: "sq1-CS", name: "Star / 6-2", group: "4 slices", algs: [
    "/ (2,4) / (-4,1) / (0,3) /",
    "(0,6) / (4,2) / (2,-5) / (0,3) /",
    "(0,6) / (4,2) / (5,-2) / (3,6) /",
  ] },
  { id: "sq1-cs-star-8", set: "sq1-CS", name: "Star / 8", group: "4 slices", algs: [
    "/ (-4,-2) / (1,2) / (-3,-3) /",
    "(0,6) / (4,2) / (2,1) / (3,3) /",
  ] },
  { id: "sq1-cs-3-1-2-pair", set: "sq1-CS", name: "3-1-2 / Pair", group: "5 slices", algs: [
    "/ (0,-5) / (-3,4) / (-1,-2) / (0,-3) /",
    "(-3,-2) / (2,0) / (0,2) / (0,1) / (0,3) /",
    "(-3,-2) / (2,0) / (0,2) / (3,4) / (3,6) /",
  ] },
  { id: "sq1-cs-3-1-2-parallel-edges", set: "sq1-CS", name: "3-1-2 / Parallel edges", group: "5 slices", algs: [
    "/ (2,0) / (0,5) / (1,3) / (0,3) / (2,1)",
    "/ (2,0) / (0,5) / (4,6) / (3,6) /",
  ] },
  { id: "sq1-cs-3-2-1-pair", set: "sq1-CS", name: "3-2-1 / Pair", group: "5 slices", algs: [
    "/ (0,5) / (-3,2) / (-1,-2) / (0,-3) /",
    "(3,-2) / (-2,2) / (0,-4) / (2,1) / (0,3) /",
    "(6,6) / (5,0) / (3,-4) / (2,1) / (0,3) /",
  ] },
  { id: "sq1-cs-3-2-1-parallel-edges", set: "sq1-CS", name: "3-2-1 / Parallel edges", group: "5 slices", algs: [
    "(0,6) / (1,6) / (2,6) / (0,5) / (3,3) /",
  ] },
  { id: "sq1-cs-3-3-pair", set: "sq1-CS", name: "3-3 / Pair", group: "5 slices", algs: [
    "/ (0,-2) / (3,0) / (-1,-2) / (0,-3) /",
    "(5,0) / (5,-2) / (3,-4) / (2,1) / (0,3) /",
    "(5,0) / (5,-2) / (3,-4) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-3-3-parallel-edges", set: "sq1-CS", name: "3-3 / Parallel edges", group: "5 slices", algs: [
    "/ (-2,1) / (-2,0) / (1,2) / (-3,-3) /",
    "(4,6) / (1,4) / (2,6) / (0,5) / (3,3) /",
  ] },
  { id: "sq1-cs-4-1-1-parallel-edges", set: "sq1-CS", name: "4-1-1 / Parallel edges", group: "5 slices", algs: [
    "/ (3,-2) / (0,4) / (1,2) / (0,3) / (-1,1)",
    "/ (3,-2) / (0,4) / (4,5) / (3,6) /",
  ] },
  { id: "sq1-cs-6-parallel-edges", set: "sq1-CS", name: "6 / Parallel edges", group: "5 slices", algs: [
    "/ (3,2) / (2,4) / (1,2) / (-3,-3) /",
    "/ (3,0) / (2,4) / (1,2) / (3,3) /",
  ] },
  { id: "sq1-cs-6-perpendicular-edges", set: "sq1-CS", name: "6 / Perpendicular edges", group: "5 slices", algs: [
    "/ (-3,-4) / (-2,3) / (-1,-2) / (-3,0) /",
    "/ (3,2) / (3,-2) / (2,1) / (0,3) /",
    "/ (3,2) / (3,-2) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-barrel-left-paw", set: "sq1-CS", name: "Barrel / Left paw", group: "5 slices", algs: [
    "/ (2,-1) / (3,-4) / (1,2) / (0,3) / (-1,1)",
    "(5,0) / (0,-3) / (3,4) / (2,1) / (0,3) /",
    "(5,0) / (0,-3) / (3,4) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-barrel-right-paw", set: "sq1-CS", name: "Barrel / Right paw", group: "5 slices", algs: [
    "/ (1,-2) / (-3,4) / (1,2) / (0,3) / (-1,1)",
    "(0,6) / (4,-5) / (4,-3) / (2,1) / (3,0) /",
    "(0,6) / (4,-5) / (4,-3) / (5,4) / (0,-3) /",
  ] },
  { id: "sq1-cs-barrel-shield", set: "sq1-CS", name: "Barrel / Shield", group: "5 slices", algs: [
    "/ (0,2) / (0,-2) / (0,1) / (3,3) /",
    "(2,6) / (0,2) / (0,-2) / (1,2) / (3,3) /",
  ] },
  { id: "sq1-cs-kite-left-paw", set: "sq1-CS", name: "Kite / Left paw", group: "5 slices", algs: [
    "/ (1,0) / (-1,-2) / (0,1) / (0,3) /",
    "(0,6) / (0,-3) / (0,-2) / (1,2) / (0,3) /",
    "(0,6) / (0,-3) / (0,-2) / (4,5) / (3,6) /",
  ] },
  { id: "sq1-cs-kite-right-paw", set: "sq1-CS", name: "Kite / Right paw", group: "5 slices", algs: [
    "/ (-1,0) / (0,-2) / (0,1) / (0,3) /",
    "(6,6) / (0,-1) / (0,4) / (0,1) / (0,3) /",
    "(6,6) / (0,-1) / (0,4) / (3,4) / (3,6) /",
  ] },
  { id: "sq1-cs-kite-shield", set: "sq1-CS", name: "Kite / Shield", group: "5 slices", algs: [
    "/ (0,-2) / (-1,-2) / (0,1) / (0,3) /",
    "(6,6) / (4,6) / (2,0) / (2,3) / (3,0) /",
    "(6,6) / (4,6) / (2,0) / (5,6) / (0,-3) /",
  ] },
  { id: "sq1-cs-left-4-2-perpendicular-edges", set: "sq1-CS", name: "Left 4-2 / Perpendicular edges", group: "5 slices", algs: [
    "(0,6) / (3,0) / (3,-2) / (2,1) / (0,3) /",
    "(0,6) / (3,0) / (3,-2) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-left-5-1-parallel-edges", set: "sq1-CS", name: "Left 5-1 / Parallel edges", group: "5 slices", algs: [
    "/ (-3,0) / (0,-4) / (-1,-2) / (0,-3) /",
    "(3,6) / (2,0) / (0,5) / (1,3) / (3,3) /",
  ] },
  { id: "sq1-cs-left-fist-left-paw", set: "sq1-CS", name: "Left fist / Left paw", group: "5 slices", algs: [
    "/ (0,2) / (0,-4) / (5,-2) / (-3,0) /",
    "(-4,0) / (0,-2) / (0,2) / (1,-4) / (3,0) /",
    "(-4,0) / (0,-2) / (0,2) / (4,-1) / (0,-3) /",
  ] },
  { id: "sq1-cs-left-fist-scallop", set: "sq1-CS", name: "Left fist / Scallop", group: "5 slices", algs: [
    "/ (1,0) / (0,-4) / (-1,4) / (0,-3) /",
    "(6,4) / (4,-3) / (2,-3) / (2,1) / (3,0) /",
    "(6,4) / (4,-3) / (2,-3) / (5,4) / (0,-3) /",
  ] },
  { id: "sq1-cs-left-fist-shield", set: "sq1-CS", name: "Left fist / Shield", group: "5 slices", algs: [
    "/ (-1,0) / (0,2) / (-5,2) / (0,3) / (-1,1)",
    "/ (1,2) / (0,-2) / (2,-5) / (3,0) /",
    "/ (1,2) / (0,-2) / (5,-2) / (0,-3) /",
  ] },
  { id: "sq1-cs-left-paw-barrel", set: "sq1-CS", name: "Left paw / Barrel", group: "5 slices", algs: [
    "/ (2,-1) / (-4,3) / (-2,-1) / (-3,0) / (-1,1)",
    "(6,0) / (5,-4) / (3,-4) / (2,1) / (0,3) /",
    "(6,0) / (5,-4) / (3,-4) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-left-paw-kite", set: "sq1-CS", name: "Left paw / Kite", group: "5 slices", algs: [
    "/ (0,1) / (2,0) / (-1,0) / (-3,0) /",
    "(6,-3) / (1,0) / (2,6) / (0,5) / (3,3) /",
  ] },
  { id: "sq1-cs-left-paw-left-fist", set: "sq1-CS", name: "Left paw / Left fist", group: "5 slices", algs: [
    "(0,2) / (0,2) / (2,6) / (1,-4) / (0,3) / (2,1)",
    "(0,2) / (0,2) / (2,6) / (4,-1) / (3,6) /",
  ] },
  { id: "sq1-cs-left-paw-left-paw", set: "sq1-CS", name: "Left paw / Left paw", group: "5 slices", algs: [
    "(0,5) / (2,4) / (0,4) / (1,2) / (0,3) / (2,1)",
    "(0,5) / (2,4) / (0,4) / (4,5) / (3,6) /",
  ] },
  { id: "sq1-cs-left-paw-muffin", set: "sq1-CS", name: "Left paw / Muffin", group: "5 slices", algs: [
    "/ (-1,0) / (2,0) / (-2,-1) / (3,3) /",
    "(0,5) / (1,-2) / (2,6) / (0,5) / (3,3) /",
  ] },
  { id: "sq1-cs-left-paw-scallop", set: "sq1-CS", name: "Left paw / Scallop", group: "5 slices", algs: [
    "/ (3,2) / (-3,2) / (1,2) / (0,3) / (-1,1)",
    "(-2,-2) / (5,4) / (3,-4) / (2,1) / (0,3) /",
    "(-2,-2) / (5,4) / (3,-4) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-left-paw-shield", set: "sq1-CS", name: "Left paw / Shield", group: "5 slices", algs: [
    "/ (0,-1) / (2,-3) / (-1,-2) / (-3,0) /",
    "(6,6) / (5,6) / (3,-4) / (2,1) / (0,3) /",
    "(6,6) / (5,6) / (3,-4) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-left-paw-square", set: "sq1-CS", name: "Left paw / Square", group: "5 slices", algs: [
    "/ (2,-3) / (-2,0) / (-2,-1) / (-3,0) / (-1,1)",
    "(6,0) / (3,-4) / (0,-2) / (2,1) / (0,3) /",
    "(6,0) / (3,-4) / (0,-2) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-muffin-left-paw", set: "sq1-CS", name: "Muffin / Left paw", group: "5 slices", algs: [
    "/ (0,-1) / (0,2) / (-1,-2) / (-3,-3) /",
    "(5,0) / (2,5) / (2,0) / (2,1) / (3,3) /",
  ] },
  { id: "sq1-cs-muffin-right-paw", set: "sq1-CS", name: "Muffin / Right paw", group: "5 slices", algs: [
    "(1,0) / (0,1) / (0,-2) / (1,2) / (3,3) / (2,1)",
  ] },
  { id: "sq1-cs-muffin-scallop", set: "sq1-CS", name: "Muffin / Scallop", group: "5 slices", algs: [
    "/ (0,2) / (-3,4) / (1,2) / (0,3) / (-1,1)",
    "(-1,6) / (4,6) / (4,-3) / (2,1) / (3,0) /",
    "(-1,6) / (4,6) / (4,-3) / (5,4) / (0,-3) /",
  ] },
  { id: "sq1-cs-pair-3-1-2", set: "sq1-CS", name: "Pair / 3-1-2", group: "5 slices", algs: [
    "/ (-5,0) / (-2,3) / (2,1) / (3,0) /",
    "/ (1,6) / (3,-2) / (2,1) / (0,3) /",
    "/ (1,6) / (3,-2) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-pair-3-2-1", set: "sq1-CS", name: "Pair / 3-2-1", group: "5 slices", algs: [
    "(0,6) / (4,-4) / (0,-4) / (2,1) / (0,3) /",
    "(0,6) / (4,-4) / (0,-4) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-pair-3-3", set: "sq1-CS", name: "Pair / 3-3", group: "5 slices", algs: [
    "/ (2,0) / (0,-3) / (2,1) / (3,0) /",
    "(6,0) / (4,6) / (3,2) / (1,2) / (0,3) /",
    "(6,0) / (4,6) / (3,2) / (4,5) / (3,6) /",
  ] },
  { id: "sq1-cs-parallel-edges-3-1-2", set: "sq1-CS", name: "Parallel edges / 3-1-2", group: "5 slices", algs: [
    "(0,3) / (0,2) / (0,1) / (0,2) / (3,0) / (2,1)",
    "(0,3) / (0,2) / (0,1) / (3,5) / (0,-3) /",
  ] },
  { id: "sq1-cs-parallel-edges-3-2-1", set: "sq1-CS", name: "Parallel edges / 3-2-1", group: "5 slices", algs: [
    "/ (0,-2) / (0,2) / (0,-2) / (3,6) / (2,1)",
    "/ (0,-2) / (0,2) / (3,1) / (3,0) /",
  ] },
  { id: "sq1-cs-parallel-edges-3-3", set: "sq1-CS", name: "Parallel edges / 3-3", group: "5 slices", algs: [
    "/ (1,-2) / (0,-2) / (-1,-2) / (-3,-3) /",
    "(0,-2) / (1,4) / (0,-4) / (2,3) / (3,3) /",
  ] },
  { id: "sq1-cs-parallel-edges-4-1-1", set: "sq1-CS", name: "Parallel edges / 4-1-1", group: "5 slices", algs: [
    "/ (-2,3) / (4,0) / (-1,-2) / (-3,0) /",
    "(6,4) / (3,-4) / (0,-4) / (2,1) / (0,3) /",
    "(6,4) / (3,-4) / (0,-4) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-parallel-edges-6", set: "sq1-CS", name: "Parallel edges / 6", group: "5 slices", algs: [
    "(0,4) / (0,4) / (3,-2) / (2,1) / (0,3) /",
    "(0,4) / (0,4) / (3,-2) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-parallel-edges-left-5-1", set: "sq1-CS", name: "Parallel edges / Left 5-1", group: "5 slices", algs: [
    "/ (-4,1) / (0,-4) / (0,-1) / (3,3) /",
    "(6,-1) / (0,2) / (0,-5) / (0,2) / (3,3) /",
  ] },
  { id: "sq1-cs-parallel-edges-right-5-1", set: "sq1-CS", name: "Parallel edges / Right 5-1", group: "5 slices", algs: [
    "/ (0,3) / (4,0) / (-1,-2) / (-3,0) /",
    "(6,2) / (1,6) / (0,-2) / (2,1) / (3,3) /",
  ] },
  { id: "sq1-cs-perpendicular-edges-6", set: "sq1-CS", name: "Perpendicular edges / 6", group: "5 slices", algs: [
    "/ (-3,-2) / (2,-3) / (-2,-1) / (-3,0) / (-1,1)",
    "/ (3,4) / (3,-4) / (2,1) / (0,3) /",
    "/ (3,4) / (3,-4) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-perpendicular-edges-left-4-2", set: "sq1-CS", name: "Perpendicular edges / Left 4-2", group: "5 slices", algs: [
    "/ (-4,3) / (-3,2) / (-1,-2) / (0,-3) /",
    "(6,6) / (3,-4) / (3,-4) / (2,1) / (0,3) /",
    "(6,6) / (3,-4) / (3,-4) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-perpendicular-edges-right-4-2", set: "sq1-CS", name: "Perpendicular edges / Right 4-2", group: "5 slices", algs: [
    "/ (0,-3) / (-4,3) / (-2,-1) / (-3,0) / (-1,1)",
    "(6,3) / (0,-4) / (0,5) / (0,-2) / (0,-3) /",
    "(6,3) / (0,-4) / (0,5) / (3,1) / (0,3) /",
  ] },
  { id: "sq1-cs-right-4-2-perpendicular-edges", set: "sq1-CS", name: "Right 4-2 / Perpendicular edges", group: "5 slices", algs: [
    "/ (-3,4) / (-2,3) / (-1,-2) / (-3,0) /",
    "/ (3,-2) / (3,-2) / (2,1) / (0,3) /",
    "/ (3,-2) / (3,-2) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-right-5-1-parallel-edges", set: "sq1-CS", name: "Right 5-1 / Parallel edges", group: "5 slices", algs: [
    "/ (3,0) / (0,4) / (1,2) / (0,3) / (-1,1)",
    "/ (3,0) / (0,4) / (4,5) / (3,6) /",
  ] },
  { id: "sq1-cs-right-fist-right-paw", set: "sq1-CS", name: "Right fist / Right paw", group: "5 slices", algs: [
    "(2,0) / (0,-2) / (0,2) / (2,-5) / (0,3) /",
    "(2,0) / (0,-2) / (0,2) / (5,-2) / (3,6) /",
  ] },
  { id: "sq1-cs-right-fist-scallop", set: "sq1-CS", name: "Right fist / Scallop", group: "5 slices", algs: [
    "/ (-1,0) / (0,4) / (1,-4) / (0,3) / (-1,1)",
    "(-1,6) / (0,3) / (0,-4) / (1,2) / (0,3) /",
    "(-1,6) / (0,3) / (0,-4) / (4,5) / (3,6) /",
  ] },
  { id: "sq1-cs-right-fist-shield", set: "sq1-CS", name: "Right fist / Shield", group: "5 slices", algs: [
    "/ (-1,-2) / (0,2) / (-5,2) / (0,3) / (-1,1)",
    "(6,6) / (0,1) / (0,-2) / (1,-4) / (0,3) /",
    "(6,6) / (0,1) / (0,-2) / (4,-1) / (3,6) /",
  ] },
  { id: "sq1-cs-right-paw-barrel", set: "sq1-CS", name: "Right paw / Barrel", group: "5 slices", algs: [
    "/ (1,-2) / (4,-3) / (-2,-1) / (-3,0) / (-1,1)",
    "(6,6) / (4,-5) / (3,-2) / (1,2) / (0,3) /",
    "(6,6) / (4,-5) / (3,-2) / (4,5) / (3,6) /",
  ] },
  { id: "sq1-cs-right-paw-kite", set: "sq1-CS", name: "Right paw / Kite", group: "5 slices", algs: [
    "/ (0,-1) / (2,1) / (-1,0) / (-3,0) /",
    "(0,6) / (0,3) / (2,0) / (2,1) / (3,0) /",
    "(0,6) / (0,3) / (2,0) / (5,4) / (0,-3) /",
  ] },
  { id: "sq1-cs-right-paw-muffin", set: "sq1-CS", name: "Right paw / Muffin", group: "5 slices", algs: [
    "/ (1,0) / (-2,0) / (2,1) / (3,3) /",
    "(6,1) / (2,-1) / (2,-2) / (2,3) / (3,3) /",
  ] },
  { id: "sq1-cs-right-paw-right-fist", set: "sq1-CS", name: "Right paw / Right fist", group: "5 slices", algs: [
    "/ (-2,0) / (4,0) / (2,-5) / (0,3) /",
    "(0,4) / (0,-2) / (2,0) / (2,-5) / (3,0) /",
    "(0,4) / (0,-2) / (2,0) / (5,-2) / (0,-3) /",
  ] },
  { id: "sq1-cs-right-paw-right-paw", set: "sq1-CS", name: "Right paw / Right paw", group: "5 slices", algs: [
    "/ (-1,2) / (2,2) / (0,-1) / (3,3) /",
    "/ (1,0) / (-2,-2) / (-1,-2) / (-3,-3) /",
    "(4,0) / (4,2) / (0,-4) / (2,1) / (0,3) /",
  ] },
  { id: "sq1-cs-right-paw-scallop", set: "sq1-CS", name: "Right paw / Scallop", group: "5 slices", algs: [
    "/ (-3,-2) / (3,-2) / (-1,-2) / (0,-3) /",
    "(6,4) / (0,3) / (0,-4) / (1,-4) / (3,0) /",
    "(6,4) / (0,3) / (0,-4) / (4,-1) / (0,-3) /",
  ] },
  { id: "sq1-cs-right-paw-shield", set: "sq1-CS", name: "Right paw / Shield", group: "5 slices", algs: [
    "/ (1,0) / (-2,3) / (-1,-2) / (-3,0) /",
    "(6,6) / (0,1) / (4,-3) / (2,1) / (3,0) /",
    "(6,6) / (0,1) / (4,-3) / (5,4) / (0,-3) /",
  ] },
  { id: "sq1-cs-right-paw-square", set: "sq1-CS", name: "Right paw / Square", group: "5 slices", algs: [
    "(0,-1) / (1,0) / (-2,0) / (-1,-2) / (-3,0) /",
    "(6,0) / (2,-1) / (2,1) / (2,3) / (3,0) /",
    "(6,0) / (2,-1) / (2,1) / (5,6) / (0,-3) /",
  ] },
  { id: "sq1-cs-scallop-left-fist", set: "sq1-CS", name: "Scallop / Left fist", group: "5 slices", algs: [
    "/ (0,1) / (-4,0) / (4,-1) / (-3,0) / (-1,1)",
    "(6,4) / (3,6) / (3,-2) / (2,1) / (0,3) /",
    "(6,4) / (3,6) / (3,-2) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-scallop-left-paw", set: "sq1-CS", name: "Scallop / Left paw", group: "5 slices", algs: [
    "/ (2,3) / (2,-3) / (2,1) / (3,0) /",
    "(-4,6) / (1,4) / (2,6) / (1,-4) / (0,3) /",
    "(-4,6) / (1,4) / (2,6) / (4,-1) / (3,6) /",
  ] },
  { id: "sq1-cs-scallop-muffin", set: "sq1-CS", name: "Scallop / Muffin", group: "5 slices", algs: [
    "/ (-2,0) / (-4,3) / (-2,-1) / (-3,0) / (-1,1)",
    "(6,6) / (0,-2) / (2,-3) / (1,2) / (3,0) /",
    "(6,6) / (0,-2) / (2,-3) / (4,5) / (0,-3) /",
  ] },
  { id: "sq1-cs-scallop-right-fist", set: "sq1-CS", name: "Scallop / Right fist", group: "5 slices", algs: [
    "/ (0,-1) / (4,0) / (-4,1) / (3,0) /",
    "(-4,6) / (3,-4) / (3,-2) / (2,1) / (0,3) /",
    "(-4,6) / (3,-4) / (3,-2) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-scallop-right-paw", set: "sq1-CS", name: "Scallop / Right paw", group: "5 slices", algs: [
    "/ (-2,-3) / (-2,3) / (-2,-1) / (-3,0) / (-1,1)",
    "(6,6) / (3,4) / (3,-2) / (2,1) / (0,3) /",
    "(6,6) / (3,4) / (3,-2) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-scallop-shield", set: "sq1-CS", name: "Scallop / Shield", group: "5 slices", algs: [
    "/ (-2,0) / (4,0) / (2,1) / (3,3) /",
    "(-4,-2) / (0,2) / (2,6) / (1,2) / (3,3) /",
  ] },
  { id: "sq1-cs-scallop-square", set: "sq1-CS", name: "Scallop / Square", group: "5 slices", algs: [
    "/ (2,0) / (-4,0) / (1,2) / (3,0) / (-1,1)",
    "(6,0) / (0,2) / (2,6) / (1,2) / (3,0) /",
    "(6,0) / (0,2) / (2,6) / (4,5) / (0,-3) /",
  ] },
  { id: "sq1-cs-shield-barrel", set: "sq1-CS", name: "Shield / Barrel", group: "5 slices", algs: [
    "/ (-2,0) / (2,0) / (-1,0) / (-3,-3) /",
    "(6,4) / (0,2) / (2,6) / (0,5) / (3,3) /",
  ] },
  { id: "sq1-cs-shield-kite", set: "sq1-CS", name: "Shield / Kite", group: "5 slices", algs: [
    "/ (-2,0) / (2,0) / (-1,0) / (-3,0) /",
    "(6,6) / (0,-2) / (2,0) / (0,-1) / (3,6) /",
    "(6,6) / (0,-2) / (2,0) / (3,2) / (3,0) /",
  ] },
  { id: "sq1-cs-shield-left-fist", set: "sq1-CS", name: "Shield / Left fist", group: "5 slices", algs: [
    "(0,-1) / (1,2) / (4,6) / (1,-4) / (3,0) / (2,1)",
    "(0,-1) / (1,2) / (4,6) / (4,-1) / (0,-3) /",
  ] },
  { id: "sq1-cs-shield-left-paw", set: "sq1-CS", name: "Shield / Left paw", group: "5 slices", algs: [
    "/ (0,-1) / (-3,2) / (2,1) / (0,3) /",
    "/ (0,-1) / (3,-4) / (1,2) / (0,3) /",
    "/ (0,-1) / (3,-4) / (4,5) / (3,6) /",
  ] },
  { id: "sq1-cs-shield-right-fist", set: "sq1-CS", name: "Shield / Right fist", group: "5 slices", algs: [
    "/ (0,1) / (-2,0) / (-2,5) / (-3,0) / (-1,1)",
    "(6,6) / (1,0) / (4,6) / (1,-4) / (3,0) /",
    "(6,6) / (1,0) / (4,6) / (4,-1) / (0,-3) /",
  ] },
  { id: "sq1-cs-shield-right-paw", set: "sq1-CS", name: "Shield / Right paw", group: "5 slices", algs: [
    "/ (1,0) / (3,-2) / (2,1) / (0,3) /",
    "/ (1,0) / (3,-2) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-shield-scallop", set: "sq1-CS", name: "Shield / Scallop", group: "5 slices", algs: [
    "/ (0,2) / (0,-4) / (-1,-2) / (-3,-3) /",
    "(4,-4) / (0,-2) / (2,6) / (0,5) / (3,3) /",
  ] },
  { id: "sq1-cs-square-left-paw", set: "sq1-CS", name: "Square / Left paw", group: "5 slices", algs: [
    "(1,0) / (0,-1) / (0,2) / (2,1) / (0,3) /",
    "/ (4,-5) / (2,0) / (2,3) / (3,0) /",
    "/ (4,-5) / (2,0) / (5,6) / (0,-3) /",
  ] },
  { id: "sq1-cs-square-right-paw", set: "sq1-CS", name: "Square / Right paw", group: "5 slices", algs: [
    "/ (3,-2) / (0,2) / (1,2) / (0,3) / (-1,1)",
    "(0,6) / (0,1) / (0,-2) / (1,2) / (0,3) /",
    "(0,6) / (0,1) / (0,-2) / (4,5) / (3,6) /",
  ] },
  { id: "sq1-cs-square-scallop", set: "sq1-CS", name: "Square / Scallop", group: "5 slices", algs: [
    "/ (0,-2) / (0,4) / (-2,-1) / (0,-3) / (-1,1)",
    "(0,6) / (4,6) / (4,0) / (2,1) / (3,0) /",
    "(0,6) / (4,6) / (4,0) / (5,4) / (0,-3) /",
  ] },
  { id: "sq1-cs-2-2-2-parallel-edges", set: "sq1-CS", name: "2-2-2 / Parallel edges", group: "6 slices", algs: [
    "/ (6,-3) / (2,0) / (2,1) / (-1,0) / (-3,0) /",
    "/ (0,3) / (0,2) / (2,1) / (0,-1) / (3,6) /",
    "/ (0,3) / (0,2) / (2,1) / (3,2) / (3,0) /",
  ] },
  { id: "sq1-cs-2-2-2-perpendicular-edges", set: "sq1-CS", name: "2-2-2 / Perpendicular edges", group: "6 slices", algs: [
    "/ (-1,0) / (2,0) / (0,-2) / (0,1) / (0,3) /",
    "(0,6) / (0,3) / (1,2) / (4,6) / (1,-4) / (3,0) /",
    "(0,6) / (0,3) / (1,2) / (4,6) / (4,-1) / (0,-3) /",
  ] },
  { id: "sq1-cs-5-3-star", set: "sq1-CS", name: "5-3 / Star", group: "6 slices", algs: [
    "/ (0,4) / (1,2) / (-2,3) / (-1,-2) / (-3,0) /",
    "(-3,0) / (0,2) / (1,4) / (2,6) / (1,-4) / (0,3) /",
    "(-3,0) / (0,2) / (1,4) / (2,6) / (4,-1) / (3,6) /",
  ] },
  { id: "sq1-cs-7-1-star", set: "sq1-CS", name: "7-1 / Star", group: "6 slices", algs: [
    "(1,0) / (0,-2) / (-1,-2) / (2,-3) / (-2,-1) / (-3,0) / (-1,1)",
    "(-3,0) / (2,0) / (1,-2) / (2,6) / (1,-4) / (0,3) /",
    "(-3,0) / (2,0) / (1,-2) / (2,6) / (4,-1) / (3,6) /",
  ] },
  { id: "sq1-cs-barrel-left-fist", set: "sq1-CS", name: "Barrel / Left fist", group: "6 slices", algs: [
    "/ (0,2) / (0,1) / (0,-2) / (-2,-1) / (3,3) /",
    "(0,3) / (2,6) / (0,1) / (4,-3) / (2,1) / (3,0) /",
    "(0,3) / (2,6) / (0,1) / (4,-3) / (5,4) / (0,-3) /",
  ] },
  { id: "sq1-cs-barrel-muffin", set: "sq1-CS", name: "Barrel / Muffin", group: "6 slices", algs: [
    "/ (-3,-2) / (0,-2) / (0,2) / (0,-1) / (0,-3) / (-1,1)",
    "(2,6) / (2,0) / (4,6) / (3,-2) / (1,2) / (0,3) /",
    "(2,6) / (2,0) / (4,6) / (3,-2) / (4,5) / (3,6) /",
  ] },
  { id: "sq1-cs-barrel-right-fist", set: "sq1-CS", name: "Barrel / Right fist", group: "6 slices", algs: [
    "/ (0,-2) / (0,-1) / (0,2) / (2,1) / (3,3) /",
    "(4,-5) / (0,2) / (0,3) / (0,-4) / (1,-4) / (3,0) /",
    "(4,-5) / (0,2) / (0,3) / (0,-4) / (4,-1) / (0,-3) /",
  ] },
  { id: "sq1-cs-barrel-square", set: "sq1-CS", name: "Barrel / Square", group: "6 slices", algs: [
    "/ (2,2) / (-2,-1) / (2,2) / (-1,0) / (-3,-3) /",
    "/ (0,-4) / (4,2) / (0,-4) / (2,1) / (0,3) /",
    "/ (0,-4) / (4,2) / (0,-4) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-kite-left-fist", set: "sq1-CS", name: "Kite / Left fist", group: "6 slices", algs: [
    "/ (0,2) / (1,0) / (0,-2) / (-1,-2) / (0,-3) /",
    "/ (0,2) / (1,0) / (0,-2) / (2,1) / (0,3) /",
    "/ (0,2) / (1,0) / (0,-2) / (5,4) / (3,6) /",
  ] },
  { id: "sq1-cs-kite-muffin", set: "sq1-CS", name: "Kite / Muffin", group: "6 slices", algs: [
    "/ (3,2) / (0,-2) / (0,2) / (0,-1) / (3,3) /",
    "(-3,0) / (1,-4) / (0,-2) / (0,2) / (2,-5) / (0,3) /",
    "(-3,0) / (1,-4) / (0,-2) / (0,2) / (5,-2) / (3,6) /",
  ] },
  { id: "sq1-cs-kite-right-fist", set: "sq1-CS", name: "Kite / Right fist", group: "6 slices", algs: [
    "(1,6) / (4,0) / (0,-1) / (2,0) / (2,1) / (3,0) /",
    "(1,6) / (4,0) / (0,-1) / (2,0) / (5,4) / (0,-3) /",
  ] },
  { id: "sq1-cs-left-fist-barrel", set: "sq1-CS", name: "Left fist / Barrel", group: "6 slices", algs: [
    "/ (2,0) / (1,0) / (-2,0) / (-1,-2) / (-3,-3) /",
    "(5,2) / (0,4) / (4,5) / (2,-3) / (2,1) / (3,0) /",
    "(5,2) / (0,4) / (4,5) / (2,-3) / (5,4) / (0,-3) /",
  ] },
  { id: "sq1-cs-left-fist-kite", set: "sq1-CS", name: "Left fist / Kite", group: "6 slices", algs: [
    "(0,5) / (2,0) / (0,1) / (4,6) / (2,1) / (3,0) /",
    "(0,5) / (2,0) / (0,1) / (4,6) / (5,4) / (0,-3) /",
  ] },
  { id: "sq1-cs-left-fist-left-fist", set: "sq1-CS", name: "Left fist / Left fist", group: "6 slices", algs: [
    "/ (2,0) / (-2,0) / (2,0) / (-1,0) / (-3,0) /",
    "(0,6) / (2,0) / (4,-2) / (0,2) / (2,3) / (0,3) /",
    "(0,6) / (2,0) / (4,-2) / (0,2) / (5,6) / (3,6) /",
  ] },
  { id: "sq1-cs-left-fist-muffin", set: "sq1-CS", name: "Left fist / Muffin", group: "6 slices", algs: [
    "/ (4,0) / (0,-1) / (2,0) / (-1,4) / (-3,0) /",
    "(2,0) / (2,0) / (0,3) / (2,6) / (2,1) / (3,0) /",
    "(2,0) / (2,0) / (0,3) / (2,6) / (5,4) / (0,-3) /",
  ] },
  { id: "sq1-cs-left-fist-square", set: "sq1-CS", name: "Left fist / Square", group: "6 slices", algs: [
    "/ (-4,0) / (1,2) / (-2,0) / (-1,-2) / (-3,0) /",
    "/ (2,0) / (0,-1) / (2,1) / (2,3) / (3,0) /",
    "/ (2,0) / (0,-1) / (2,1) / (5,6) / (0,-3) /",
  ] },
  { id: "sq1-cs-muffin-barrel", set: "sq1-CS", name: "Muffin / Barrel", group: "6 slices", algs: [
    "/ (2,3) / (2,0) / (-2,0) / (1,0) / (3,0) / (-1,1)",
    "(0,4) / (2,0) / (0,2) / (2,3) / (2,1) / (3,0) /",
    "(0,4) / (2,0) / (0,2) / (2,3) / (5,4) / (0,-3) /",
  ] },
  { id: "sq1-cs-muffin-kite", set: "sq1-CS", name: "Muffin / Kite", group: "6 slices", algs: [
    "/ (2,3) / (-2,0) / (2,0) / (-1,0) / (-3,-3) /",
    "(0,-3) / (2,3) / (2,4) / (2,6) / (2,-5) / (3,0) /",
    "(0,-3) / (2,3) / (2,4) / (2,6) / (5,-2) / (0,-3) /",
  ] },
  { id: "sq1-cs-muffin-left-fist", set: "sq1-CS", name: "Muffin / Left fist", group: "6 slices", algs: [
    "/ (0,-4) / (1,2) / (0,-2) / (-4,1) / (0,3) /",
    "(6,0) / (2,3) / (0,3) / (2,0) / (2,1) / (3,0) /",
    "(6,0) / (2,3) / (0,3) / (2,0) / (5,4) / (0,-3) /",
  ] },
  { id: "sq1-cs-muffin-right-fist", set: "sq1-CS", name: "Muffin / Right fist", group: "6 slices", algs: [
    "/ (0,-4) / (1,0) / (0,-2) / (-4,1) / (0,3) /",
    "(6,-2) / (2,6) / (2,-1) / (2,-2) / (2,3) / (3,3) /",
  ] },
  { id: "sq1-cs-parallel-edges-2-2-2", set: "sq1-CS", name: "Parallel edges / 2-2-2", group: "6 slices", algs: [
    "/ (0,3) / (2,0) / (2,1) / (-1,0) / (-3,0) /",
    "(6,6) / (3,0) / (2,0) / (0,4) / (0,1) / (0,3) /",
    "(6,6) / (3,0) / (2,0) / (0,4) / (3,4) / (3,6) /",
  ] },
  { id: "sq1-cs-perpendicular-edges-2-2-2", set: "sq1-CS", name: "Perpendicular edges / 2-2-2", group: "6 slices", algs: [
    "/ (0,-1) / (0,2) / (2,1) / (-1,0) / (-3,0) /",
    "(-4,0) / (3,6) / (1,0) / (0,-2) / (2,-5) / (3,0) /",
    "(-4,0) / (3,6) / (1,0) / (0,-2) / (5,-2) / (0,-3) /",
  ] },
  { id: "sq1-cs-right-fist-barrel", set: "sq1-CS", name: "Right fist / Barrel", group: "6 slices", algs: [
    "/ (-2,0) / (-1,0) / (2,0) / (1,2) / (-3,-3) /",
    "/ (4,6) / (0,-1) / (2,0) / (2,1) / (3,3) /",
  ] },
  { id: "sq1-cs-right-fist-kite", set: "sq1-CS", name: "Right fist / Kite", group: "6 slices", algs: [
    "/ (-2,0) / (0,-1) / (2,0) / (-1,-2) / (-3,0) /",
    "(6,3) / (0,-2) / (0,-1) / (0,2) / (2,-5) / (0,3) /",
    "(6,3) / (0,-2) / (0,-1) / (0,2) / (5,-2) / (3,6) /",
  ] },
  { id: "sq1-cs-right-fist-muffin", set: "sq1-CS", name: "Right fist / Muffin", group: "6 slices", algs: [
    "/ (4,0) / (-2,-1) / (2,0) / (-1,4) / (-3,0) /",
    "(3,0) / (4,0) / (0,-3) / (4,3) / (2,1) / (3,0) /",
    "(3,0) / (4,0) / (0,-3) / (4,3) / (5,4) / (0,-3) /",
  ] },
  { id: "sq1-cs-right-fist-right-fist", set: "sq1-CS", name: "Right fist / Right fist", group: "6 slices", algs: [
    "/ (0,-2) / (0,2) / (0,-2) / (0,1) / (0,3) /",
    "(-3,6) / (4,3) / (2,-4) / (2,1) / (2,3) / (3,0) /",
    "(-3,6) / (4,3) / (2,-4) / (2,1) / (5,6) / (0,-3) /",
  ] },
  { id: "sq1-cs-right-fist-square", set: "sq1-CS", name: "Right fist / Square", group: "6 slices", algs: [
    "(0,-1) / (0,1) / (4,0) / (-2,-1) / (2,0) / (-1,-2) / (-3,0) /",
    "(1,2) / (0,4) / (3,6) / (4,6) / (1,2) / (3,0) /",
    "(1,2) / (0,4) / (3,6) / (4,6) / (4,5) / (0,-3) /",
  ] },
  { id: "sq1-cs-square-barrel", set: "sq1-CS", name: "Square / Barrel", group: "6 slices", algs: [
    "/ (2,2) / (-1,2) / (2,2) / (0,-1) / (3,3) /",
    "(2,2) / (0,4) / (4,2) / (4,0) / (2,1) / (3,0) /",
    "(2,2) / (0,4) / (4,2) / (4,0) / (5,4) / (0,-3) /",
  ] },
  { id: "sq1-cs-square-left-fist", set: "sq1-CS", name: "Square / Left fist", group: "6 slices", algs: [
    "(1,0) / (-1,0) / (0,-4) / (1,2) / (0,-2) / (2,1) / (0,3) /",
    "(1,5) / (0,2) / (5,6) / (2,1) / (0,-1) / (3,6) /",
    "(1,5) / (0,2) / (5,6) / (2,1) / (3,2) / (3,0) /",
  ] },
  { id: "sq1-cs-square-right-fist", set: "sq1-CS", name: "Square / Right fist", group: "6 slices", algs: [
    "/ (0,4) / (-2,-1) / (0,2) / (2,1) / (0,3) /",
    "/ (0,4) / (0,-3) / (0,-2) / (1,2) / (0,3) /",
    "/ (0,4) / (0,-3) / (0,-2) / (4,5) / (3,6) /",
  ] },
  { id: "sq1-cs-star-5-3", set: "sq1-CS", name: "Star / 5-3", group: "6 slices", algs: [
    "(0,3) / (-4,0) / (-2,-1) / (-3,2) / (2,1) / (0,3) /",
    "(0,-3) / (0,-4) / (4,5) / (3,-4) / (1,2) / (0,3) /",
    "(0,-3) / (0,-4) / (4,5) / (3,-4) / (4,5) / (3,6) /",
  ] },
  { id: "sq1-cs-star-7-1", set: "sq1-CS", name: "Star / 7-1", group: "6 slices", algs: [
    "/ (-2,0) / (-2,-1) / (-3,2) / (-1,-2) / (0,-3) /",
    "(0,-3) / (0,2) / (2,3) / (4,-3) / (2,1) / (3,0) /",
    "(0,-3) / (0,2) / (2,3) / (4,-3) / (5,4) / (0,-3) /",
  ] },
  { id: "sq1-cs-kite-square", set: "sq1-CS", name: "Kite / Square", group: "7 slices", algs: [
    "/ (-1,0) / (2,0) / (-2,0) / (2,0) / (-1,0) / (-3,0) /",
    "/ (0,-4) / (1,2) / (0,2) / (0,-2) / (2,-5) / (3,0) /",
    "/ (0,-4) / (1,2) / (0,2) / (0,-2) / (5,-2) / (0,-3) /",
  ] },
  { id: "sq1-cs-square-kite", set: "sq1-CS", name: "Square / Kite", group: "7 slices", algs: [
    "/ (0,1) / (0,-2) / (0,2) / (0,-2) / (0,1) / (0,3) /",
    "(0,6) / (0,4) / (4,3) / (2,-4) / (2,1) / (2,3) / (3,0) /",
    "(0,6) / (0,4) / (4,3) / (2,-4) / (2,1) / (5,6) / (0,-3) /",
  ] },
  { id: "sq1-co-2-2", set: "sq1-CO", name: "2-2", group: "Corner orientation", algs: [
    "(1,0) / (-1,0)",
    "(0,-1) / (0,1)",
  ] },
  { id: "sq1-co-3-1", set: "sq1-CO", name: "3-1", group: "Corner orientation", algs: [
    "(1,0) / (3,0) / (-1,0)",
    "(-2,-3) / (-3,0) / (-1,0)",
    "(-5,6) / (0,3) / (-1,0)",
    "(4,3) / (0,-3) / (-1,0)",
  ] },
  { id: "sq1-co-opp-opp", set: "sq1-CO", name: "Opp / Opp", group: "Corner orientation", algs: [
    "(1,0) / (3,3) / (-1,0)",
    "(4,3) / (-3,-3) / (-1,0)",
    "(3,2) / (-3,-3) / (0,1)",
    "(0,-1) / (3,3) / (0,1)",
  ] },
  { id: "sq1-co-adj-opp", set: "sq1-CO", name: "Adj / Opp", group: "Corner orientation", algs: [
    "(1,0) / (0,3) / (0,3) / (-1,0)",
    "(1,3) / (0,-3) / (0,-3) / (1,0)",
    "(0,2) / (0,-3) / (0,-3) / (0,1)",
    "(1,3) / (0,-3) / (0,-3) / (-1,0)",
  ] },
  { id: "sq1-co-opp-adj", set: "sq1-CO", name: "Opp / Adj", group: "Corner orientation", algs: [
    "(1,0) / (-3,0) / (-3,0) / (-1,0)",
    "(4,0) / (3,0) / (3,0) / (-1,0)",
    "(3,-1) / (3,0) / (3,0) / (0,1)",
    "(0,-1) / (-3,0) / (-3,0) / (0,1)",
  ] },
  { id: "sq1-co-1-3", set: "sq1-CO", name: "1-3", group: "Corner orientation", algs: [
    "(1,0) / (3,6) / (-1,0)",
    "(4,3) / (-3,6) / (-1,0)",
    "(3,2) / (-3,6) / (0,1)",
    "(0,-1) / (3,6) / (0,1)",
  ] },
  { id: "sq1-co-0-4", set: "sq1-CO", name: "0-4", group: "Corner orientation", algs: [
    "/ (6,6) / (-1,1)",
    "(1,-1) / (6,6) /",
  ] },
  { id: "sq1-eo-1-1", set: "sq1-EO", name: "1-1", group: "Edge orientation", algs: [
    "(1,0) / (3,0) / (3,0) / (-1,-1) / (-2,1) / (-3,0) / (-1,0)",
    "(0,5) / (-3,0) / (-3,0) / (1,1) / (2,-1) / (3,0) / (0,1)",
    "(1,0) / (3,0) / (2,-1) / (1,1) / (-3,0) / (-3,0) / (-1,0)",
  ] },
  { id: "sq1-eo-i-i", set: "sq1-EO", name: "I-I", group: "Edge orientation", algs: [
    "(1,0) / (-1,-1) / (0,1)",
    "(0,-1) / (1,1) / (-1,0)",
  ] },
  { id: "sq1-eo-l-l", set: "sq1-EO", name: "L-L", group: "Edge orientation", algs: [
    "(1,0) / (-4,-1) / (1,1) / (3,0) / (-1,0)",
    "(-3,-4) / (4,1) / (-1,-1) / (-3,0) / (0,1)",
    "(1,0) / (-3,0) / (-1,-1) / (4,1) / (-1,0)",
    "(3,-1) / (-3,0) / (3,0) / (1,1) / (-3,0) / (3,0) / (-1,0)",
  ] },
  { id: "sq1-eo-l-i", set: "sq1-EO", name: "L-I", group: "Edge orientation", algs: [
    "(1,0) / (3,0) / (3,0) / (-1,-1) / (-2,1) / (-4,-1) / (0,1)",
    "(-3,-1) / (-3,0) / (-3,0) / (1,1) / (2,-1) / (4,1) / (-1,0)",
    "(3,-1) / (4,1) / (2,-1) / (1,1) / (-3,0) / (-3,0) / (-1,0)",
  ] },
  { id: "sq1-eo-3-3", set: "sq1-EO", name: "3-3", group: "Edge orientation", algs: [
    "(1,0) / (3,0) / (3,0) / (-1,-1) / (-3,0) / (-3,0) / (0,1)",
    "(-3,-1) / (3,0) / (3,0) / (1,1) / (-3,0) / (-3,0) / (-1,0)",
    "(6,-1) / (-3,0) / (-3,0) / (1,1) / (3,0) / (3,0) / (-1,0)",
    "(-2,0) / (-3,0) / (-3,0) / (-1,-1) / (3,0) / (3,0) / (0,1)",
  ] },
  { id: "sq1-eo-4-4", set: "sq1-EO", name: "4-4", group: "Edge orientation", algs: [
    "(1,0) / (-1,-1) / (3,3) / (1,1) / (-1,0)",
    "(1,0) / (-1,-1) / (-2,4) / (-1,-1) / (1,0)",
    "(0,-1) / (1,1) / (-3,-3) / (-1,-1) / (0,1)",
    "(1,0) / (-1,-1) / (-3,-3) / (1,1) / (-1,0)",
  ] },
  { id: "sq1-eo-i-l", set: "sq1-EO", name: "I-L", group: "Edge orientation", algs: [
    "(1,0) / (-3,0) / (3,0) / (-1,-1) / (-3,0) / (3,0) / (0,1)",
    "(0,-4) / (3,0) / (-3,0) / (1,1) / (3,0) / (-3,0) / (-1,0)",
  ] },
  { id: "sq1-cp-adj-solved", set: "sq1-CP", name: "Adj / Solved", group: "One layer", algs: [
    "/ (-3,3) / (3,0) / (0,-3) / (0,3) / (0,-3) /",
    "(6,0) / (3,-3) / (-3,0) / (0,3) / (0,-3) / (0,3) /",
    "(-5,-1) / (3,-3) / (-3,0) / (0,3) / (0,-3) / (0,3) / (-1,1)",
    "(-3,0) / (0,3) / (0,-3) / (0,3) / (-3,0) / (3,-3) /",
  ] },
  { id: "sq1-cp-opp-solved", set: "sq1-CP", name: "Opp / Solved", group: "One layer", algs: [
    "/ (3,3) / (-3,0) / (3,3) / (-3,0) / (3,3) /",
    "/ (-3,-3) / (3,0) / (-3,-3) / (3,0) / (-3,-3) /",
    "/ (-3,-3) / (-3,0) / (-3,-3) / (-3,0) / (-3,-3) /",
    "(1,-1) / (-3,-3) / (3,0) / (-3,-3) / (3,0) / (-3,-3) / (-1,1)",
  ] },
  { id: "sq1-cp-solved-adj", set: "sq1-CP", name: "Solved / Adj", group: "One layer", algs: [
    "/ (-3,3) / (0,-3) / (3,0) / (-3,0) / (3,0) /",
    "(0,6) / (3,-3) / (0,3) / (-3,0) / (3,0) / (-3,0) /",
    "(1,5) / (3,-3) / (0,3) / (-3,0) / (3,0) / (-3,0) / (-1,1)",
    "(0,3) / (-3,0) / (3,0) / (-3,0) / (0,3) / (3,-3) /",
  ] },
  { id: "sq1-cp-solved-opp", set: "sq1-CP", name: "Solved / Opp", group: "One layer", algs: [
    "/ (3,3) / (0,3) / (3,3) / (0,3) / (3,3) /",
    "/ (-3,-3) / (0,-3) / (-3,-3) / (0,-3) / (-3,-3) /",
    "/ (3,3) / (0,-3) / (3,3) / (0,-3) / (3,3) /",
    "/ (-3,-3) / (0,3) / (-3,-3) / (0,3) / (-3,-3) /",
  ] },
  { id: "sq1-cp-adj-adj", set: "sq1-CP", name: "Adj / Adj", group: "Both layers", algs: [
    "/ (-3,0) / (3,3) / (0,-3) /",
    "(6,6) / (0,-3) / (3,3) / (-3,0) /",
    "(-5,5) / (3,0) / (-3,-3) / (0,3) / (-1,1)",
    "/ (0,3) / (-3,-3) / (3,0) /",
  ] },
  { id: "sq1-cp-opp-adj", set: "sq1-CP", name: "Opp / Adj", group: "Both layers", algs: [
    "/ (3,0) / (-3,0) / (3,0) / (-3,0) /",
    "/ (-3,0) / (3,0) / (-3,0) / (3,0) /",
    "(1,-1) / (-3,0) / (3,0) / (-3,0) / (3,0) / (-1,1)",
    "(1,-1) / (3,0) / (-3,0) / (3,0) / (-3,0) / (-1,1)",
  ] },
  { id: "sq1-cp-adj-opp", set: "sq1-CP", name: "Adj / Opp", group: "Both layers", algs: [
    "/ (0,-3) / (0,3) / (0,-3) / (0,3) /",
    "/ (0,3) / (0,-3) / (0,3) / (0,-3) /",
    "(1,-1) / (0,3) / (0,-3) / (0,3) / (0,-3) / (-1,1)",
    "(1,-1) / (0,-3) / (0,3) / (0,-3) / (0,3) / (-1,1)",
  ] },
  { id: "sq1-cp-opp-opp", set: "sq1-CP", name: "Opp / Opp", group: "Both layers", algs: [
    "/ (-3,3) / (3,-3) /",
    "/ (3,-3) / (-3,3) /",
    "(1,-1) / (3,-3) / (-3,3) / (-1,1)",
    "(1,-1) / (-3,3) / (3,-3) / (-1,1)",
  ] },
  { id: "sq1-ep-adj-adj", set: "sq1-EP", name: "Adj / Adj", group: "Both layers, a swap on each", algs: [
    "(-2,0) / (0,3) / (-1,-1) / (1,-2) / (2,0)",
    "(4,6) / (3,0) / (-1,-1) / (-2,1) / (-1,0)",
    "(6,-4) / (0,-3) / (1,1) / (-1,2) / (-3,1)",
    "(-2,0) / (-1,2) / (1,1) / (0,-3) / (2,0)",
  ] },
  { id: "sq1-ep-adj-oplus", set: "sq1-EP", name: "Adj / O+", group: "Both layers, a swap on each", algs: [
    "(0,-1) / (3,0) / (-3,0) / (1,-2) / (-4,-1) / (1,-2) / (-1,2) / (3,3) / (0,1)",
    "(1,0) / (3,3) / (-1,2) / (1,-2) / (-4,-1) / (1,-2) / (-3,0) / (3,0) / (-1,0)",
  ] },
  { id: "sq1-ep-adj-ominus", set: "sq1-EP", name: "Adj / O-", group: "Both layers, a swap on each", algs: [
    "(1,0) / (-3,0) / (3,0) / (-1,2) / (4,1) / (-1,2) / (1,-2) / (-3,-3) / (-1,0)",
    "(0,-1) / (-3,-3) / (1,-2) / (-1,2) / (4,1) / (-1,2) / (3,0) / (-3,0) / (0,1)",
  ] },
  { id: "sq1-ep-adj-opp", set: "sq1-EP", name: "Adj / Opp", group: "Both layers, a swap on each", algs: [
    "(1,0) / (-1,0) / (-3,0) / (0,-1) / (6,0) / (1,0) / (3,0) / (0,1) / (5,0)",
    "(-3,-1) / (1,0) / (3,0) / (0,1) / (6,0) / (-1,0) / (-3,0) / (0,-1) / (6,1)",
    "(-5,0) / (0,-1) / (-3,0) / (-1,0) / (6,0) / (0,1) / (3,0) / (1,0) / (-1,0)",
  ] },
  { id: "sq1-ep-adj-w", set: "sq1-EP", name: "Adj / W", group: "Both layers, a swap on each", algs: [
    "(1,0) / (0,3) / (-1,-1) / (0,3) / (0,-3) / (1,1) / (0,-3) / (-1,0)",
    "(3,2) / (0,-3) / (1,1) / (0,-3) / (0,3) / (-1,-1) / (0,3) / (0,1)",
  ] },
  { id: "sq1-ep-h-h", set: "sq1-EP", name: "H / H", group: "Both layers", algs: [
    "(1,0) / (5,-1) / (-2,-2) / (-1,-1) / (-2,4) / (-1,0)",
    "(0,-1) / (-5,1) / (2,2) / (1,1) / (2,-4) / (0,1)",
    "(1,0) / (2,-4) / (1,1) / (2,2) / (-5,1) / (-1,0)",
  ] },
  { id: "sq1-ep-h-solved", set: "sq1-EP", name: "H / Solved", group: "One layer", algs: [
    "/ (3,-3) / (3,-3) / (0,1) / (-3,3) / (-3,3) / (-1,0)",
    "(1,-1) / (-3,3) / (-3,3) / (0,-1) / (3,-3) / (3,-3) / (0,1)",
    "(1,0) / (3,-3) / (3,-3) / (0,-1) / (-3,3) / (-3,3) /",
  ] },
  { id: "sq1-ep-h-ua", set: "sq1-EP", name: "H / Ua", group: "Both layers", algs: [
    "(0,-1) / (0,-3) / (4,1) / (-1,-4) / (-5,1) / (-1,-4) / (4,1) / (0,-3) / (-1,0)",
  ] },
  { id: "sq1-ep-h-ub", set: "sq1-EP", name: "H / Ub", group: "Both layers", algs: [
    "(1,0) / (0,3) / (-4,-1) / (1,4) / (5,-1) / (1,4) / (-4,-1) / (0,3) / (0,1)",
  ] },
  { id: "sq1-ep-h-z", set: "sq1-EP", name: "H / Z", group: "Both layers", algs: [
    "(1,0) / (-1,-1) / (0,3) / (1,1) / (0,3) / (3,-3) / (-1,-1) / (-3,3) / (0,1)",
    "(0,2) / (1,1) / (0,-3) / (-1,-1) / (0,-3) / (-3,3) / (1,1) / (3,-3) / (-1,0)",
    "(0,-1) / (3,-3) / (1,1) / (-3,3) / (0,-3) / (-1,-1) / (0,-3) / (1,1) / (-1,0)",
  ] },
  { id: "sq1-ep-oplus-adj", set: "sq1-EP", name: "O+ / Adj", group: "Both layers, a swap on each", algs: [
    "(0,-1) / (-3,0) / (1,1) / (2,-1) / (1,4) / (5,-1) / (-2,1) / (-1,-1) / (-2,1) / (-1,0)",
    "(0,5) / (0,-3) / (1,1) / (-1,2) / (0,-3) / (-2,1) / (-1,-1) / (-2,1) / (5,-1) / (0,1)",
    "(1,6) / (5,-1) / (-2,1) / (-1,-1) / (-2,1) / (0,-3) / (-1,2) / (1,1) / (0,-3) / (-1,0)",
  ] },
  { id: "sq1-ep-oplus-oplus", set: "sq1-EP", name: "O+ / O+", group: "Both layers, a swap on each", algs: [
    "(1,0) / (5,-1) / (-3,0) / (1,1) / (-4,2) / (1,1) / (0,-3) / (-1,0)",
    "(0,-1) / (0,-3) / (1,1) / (-4,2) / (1,1) / (-3,0) / (5,-1) / (0,1)",
  ] },
  { id: "sq1-ep-oplus-ominus", set: "sq1-EP", name: "O+ / O-", group: "Both layers, a swap on each", algs: [
    "(1,0) / (-1,-1) / (-3,0) / (1,1) / (-3,-3) / (-1,-1) / (1,4) / (-1,-1) / (0,1)",
    "(0,-1) / (1,1) / (-3,0) / (-1,-1) / (-3,-3) / (1,1) / (-1,2) / (1,1) / (-1,0)",
    "(0,-1) / (1,1) / (-1,2) / (1,1) / (-3,-3) / (-1,-1) / (-3,0) / (1,1) / (-1,0)",
  ] },
  { id: "sq1-ep-oplus-opp", set: "sq1-EP", name: "O+ / Opp", group: "Both layers, a swap on each", algs: [
    "(1,0) / (-1,-1) / (-3,0) / (1,1) / (-3,0) / (-1,-1) / (0,1)",
    "(0,-1) / (1,1) / (-3,0) / (-1,-1) / (-3,0) / (1,1) / (-1,0)",
  ] },
  { id: "sq1-ep-oplus-w", set: "sq1-EP", name: "O+ / W", group: "Both layers, a swap on each", algs: [
    "(1,0) / (2,-4) / (0,3) / (1,4) / (0,3) / (3,-3) / (-4,-1) / (-2,1) / (-1,0)",
  ] },
  { id: "sq1-ep-ominus-adj", set: "sq1-EP", name: "O- / Adj", group: "Both layers, a swap on each", algs: [
    "(1,0) / (0,3) / (-1,-1) / (1,-2) / (0,3) / (2,-1) / (1,1) / (2,-1) / (-5,1) / (-1,0)",
    "(1,6) / (3,0) / (-1,-1) / (-2,1) / (-1,-4) / (-5,1) / (2,-1) / (1,1) / (2,-1) / (0,1)",
    "(1,0) / (2,-1) / (1,1) / (2,-1) / (-5,1) / (-1,-4) / (-2,1) / (-1,-1) / (3,0) / (0,1)",
  ] },
  { id: "sq1-ep-ominus-oplus", set: "sq1-EP", name: "O- / O+", group: "Both layers, a swap on each", algs: [
    "(1,0) / (-1,-1) / (3,0) / (1,1) / (3,3) / (-1,-1) / (1,-2) / (-1,-1) / (0,1)",
    "(0,-1) / (1,1) / (3,0) / (-1,-1) / (3,3) / (1,1) / (-1,-4) / (1,1) / (-1,0)",
    "(0,-1) / (1,1) / (-1,-4) / (1,1) / (3,3) / (-1,-1) / (3,0) / (1,1) / (-1,0)",
  ] },
  { id: "sq1-ep-ominus-ominus", set: "sq1-EP", name: "O- / O-", group: "Both layers, a swap on each", algs: [
    "(1,0) / (0,3) / (-1,-1) / (4,-2) / (-1,-1) / (3,0) / (-5,1) / (-1,0)",
    "(0,-1) / (-5,1) / (3,0) / (-1,-1) / (4,-2) / (-1,-1) / (0,3) / (0,1)",
  ] },
  { id: "sq1-ep-ominus-opp", set: "sq1-EP", name: "O- / Opp", group: "Both layers, a swap on each", algs: [
    "(1,0) / (-1,-1) / (3,0) / (1,1) / (3,0) / (-1,-1) / (0,1)",
    "(0,-1) / (1,1) / (3,0) / (-1,-1) / (3,0) / (1,1) / (-1,0)",
  ] },
  { id: "sq1-ep-ominus-w", set: "sq1-EP", name: "O- / W", group: "Both layers, a swap on each", algs: [
    "(1,-3) / (0,3) / (-1,-1) / (1,-2) / (3,0) / (5,-1) / (-2,1) / (-1,-1) / (-2,1) / (-1,0)",
  ] },
  { id: "sq1-ep-opp-adj", set: "sq1-EP", name: "Opp / Adj", group: "Both layers, a swap on each", algs: [
    "(0,-1) / (0,-3) / (0,3) / (1,-2) / (-1,-1) / (0,3) / (0,-3) / (0,3) / (0,1)",
    "(1,-3) / (0,3) / (0,-3) / (-1,2) / (1,1) / (0,-3) / (0,3) / (0,-3) / (-1,0)",
    "(0,-1) / (0,-3) / (0,3) / (0,-3) / (1,1) / (-1,2) / (0,-3) / (0,3) / (0,1)",
  ] },
  { id: "sq1-ep-opp-oplus", set: "sq1-EP", name: "Opp / O+", group: "Both layers, a swap on each", algs: [
    "(1,0) / (-1,-1) / (1,-2) / (-1,-1) / (1,-2) / (-1,-1) / (0,1)",
    "(0,-1) / (1,1) / (-1,-4) / (1,1) / (-1,-4) / (1,1) / (-1,0)",
  ] },
  { id: "sq1-ep-opp-ominus", set: "sq1-EP", name: "Opp / O-", group: "Both layers, a swap on each", algs: [
    "(1,0) / (-1,-1) / (1,4) / (-1,-1) / (1,4) / (-1,-1) / (0,1)",
    "(0,-1) / (1,1) / (-1,2) / (1,1) / (-1,2) / (1,1) / (-1,0)",
  ] },
  { id: "sq1-ep-opp-opp", set: "sq1-EP", name: "Opp / Opp", group: "Both layers, a swap on each", algs: [
    "(1,0) / (-1,-1) / (-5,1) / (-1,-1) / (0,1)",
    "(0,-1) / (1,1) / (5,-1) / (1,1) / (-1,0)",
  ] },
  { id: "sq1-ep-opp-w", set: "sq1-EP", name: "Opp / W", group: "Both layers, a swap on each", algs: [
    "(1,0) / (-1,2) / (-5,1) / (3,0) / (0,-3) / (-4,-1) / (0,3) / (-5,1) / (-1,0)",
    "(0,2) / (1,-2) / (5,-1) / (-3,0) / (0,3) / (4,1) / (0,-3) / (5,-1) / (0,1)",
    "(1,-3) / (5,-1) / (0,-3) / (4,1) / (0,3) / (-3,0) / (5,-1) / (1,-2) / (-1,0)",
  ] },
  { id: "sq1-ep-solved-h", set: "sq1-EP", name: "Solved / H", group: "One layer", algs: [
    "/ (3,-3) / (3,-3) / (-1,0) / (-3,3) / (-3,3) / (0,1)",
    "(1,-1) / (-3,3) / (-3,3) / (1,0) / (3,-3) / (3,-3) / (-1,0)",
    "(0,-1) / (3,-3) / (3,-3) / (1,0) / (-3,3) / (-3,3) /",
  ] },
  { id: "sq1-ep-solved-ua", set: "sq1-EP", name: "Solved / Ua", group: "One layer", algs: [
    "(0,-1) / (3,0) / (0,1) / (0,-3) / (0,-1) / (-3,0) / (0,1) / (0,3) /",
    "(1,5) / (0,3) / (0,1) / (-3,0) / (0,-1) / (0,-3) / (0,1) / (3,0) / (-1,0)",
  ] },
  { id: "sq1-ep-solved-ub", set: "sq1-EP", name: "Solved / Ub", group: "One layer", algs: [
    "/ (0,-3) / (0,-1) / (3,0) / (0,1) / (0,3) / (0,-1) / (-3,0) / (0,1)",
    "(1,6) / (-3,0) / (0,-1) / (0,3) / (0,1) / (3,0) / (0,-1) / (0,-3) / (-1,1)",
  ] },
  { id: "sq1-ep-solved-z", set: "sq1-EP", name: "Solved / Z", group: "One layer", algs: [
    "(0,-1) / (1,1) / (0,3) / (-1,-1) / (0,-3) / (1,1) / (-1,0)",
    "(1,3) / (-1,-1) / (0,-3) / (1,1) / (0,3) / (-1,-1) / (0,1)",
    "(1,0) / (-1,-1) / (0,3) / (1,1) / (0,-3) / (-1,-1) / (0,1)",
  ] },
  { id: "sq1-ep-ua-h", set: "sq1-EP", name: "Ua / H", group: "Both layers", algs: [
    "(1,0) / (0,3) / (-1,-4) / (1,4) / (5,-1) / (4,1) / (-1,-4) / (3,0) / (0,1)",
    "(-5,0) / (3,0) / (-1,-4) / (4,1) / (5,-1) / (1,4) / (-1,-4) / (0,3) / (0,1)",
  ] },
  { id: "sq1-ep-ua-solved", set: "sq1-EP", name: "Ua / Solved", group: "One layer", algs: [
    "(1,0) / (-3,0) / (-1,0) / (0,3) / (1,0) / (3,0) / (-1,0) / (0,-3) /",
    "(-5,-1) / (0,-3) / (-1,0) / (3,0) / (1,0) / (0,3) / (-1,0) / (-3,0) / (0,1)",
  ] },
  { id: "sq1-ep-ua-ua", set: "sq1-EP", name: "Ua / Ua", group: "Both layers", algs: [
    "(1,0) / (3,0) / (-1,-1) / (3,0) / (-5,1) / (-1,0)",
    "(6,-1) / (-5,1) / (2,-1) / (1,1) / (2,-1) / (0,1)",
    "(1,0) / (2,-1) / (1,1) / (2,-1) / (-5,1) / (-1,0)",
  ] },
  { id: "sq1-ep-ua-ub", set: "sq1-EP", name: "Ua / Ub", group: "Both layers", algs: [
    "(1,0) / (5,-1) / (-5,1) / (3,0) / (0,3) / (-1,-1) / (1,-2) / (-1,0)",
  ] },
  { id: "sq1-ep-ua-z", set: "sq1-EP", name: "Ua / Z", group: "Both layers", algs: [
    "(1,0) / (0,3) / (-1,-1) / (1,-2) / (3,0) / (3,0) / (-1,-1) / (-2,1) / (-1,0)",
    "(-3,2) / (0,-3) / (1,1) / (-1,2) / (3,0) / (-3,0) / (1,1) / (2,-1) / (0,1)",
    "(-5,0) / (2,-1) / (1,1) / (-3,0) / (3,0) / (-1,2) / (1,1) / (0,-3) / (-1,0)",
  ] },
  { id: "sq1-ep-ub-h", set: "sq1-EP", name: "Ub / H", group: "Both layers", algs: [
    "(0,-1) / (-3,0) / (1,4) / (-4,-1) / (-5,1) / (-1,-4) / (1,4) / (0,-3) / (-1,0)",
    "(6,-1) / (0,-3) / (1,4) / (-1,-4) / (-5,1) / (-4,-1) / (1,4) / (-3,0) / (-1,0)",
  ] },
  { id: "sq1-ep-ub-solved", set: "sq1-EP", name: "Ub / Solved", group: "One layer", algs: [
    "/ (0,3) / (1,0) / (-3,0) / (-1,0) / (0,-3) / (1,0) / (3,0) / (-1,0)",
    "(6,-1) / (3,0) / (1,0) / (0,-3) / (-1,0) / (-3,0) / (1,0) / (0,3) / (-1,1)",
  ] },
  { id: "sq1-ep-ub-ua", set: "sq1-EP", name: "Ub / Ua", group: "Both layers", algs: [
    "(-2,0) / (3,0) / (-1,-1) / (3,0) / (-2,1) / (-1,-1) / (3,0) / (-5,1) / (-1,0)",
  ] },
  { id: "sq1-ep-ub-ub", set: "sq1-EP", name: "Ub / Ub", group: "Both layers", algs: [
    "(1,0) / (5,-1) / (-2,1) / (-1,-1) / (-2,1) / (-1,0)",
    "(6,-1) / (-3,0) / (1,1) / (-3,0) / (5,-1) / (0,1)",
    "(1,0) / (5,-1) / (-3,0) / (1,1) / (-3,0) / (-1,0)",
  ] },
  { id: "sq1-ep-ub-z", set: "sq1-EP", name: "Ub / Z", group: "Both layers", algs: [
    "(1,0) / (0,3) / (-1,-1) / (1,-2) / (-3,0) / (3,0) / (-1,-1) / (-2,1) / (-1,0)",
    "(-3,2) / (0,-3) / (1,1) / (-1,2) / (-3,0) / (-3,0) / (1,1) / (2,-1) / (0,1)",
    "(-5,0) / (2,-1) / (1,1) / (-3,0) / (-3,0) / (-1,2) / (1,1) / (0,-3) / (-1,0)",
  ] },
  { id: "sq1-ep-w-adj", set: "sq1-EP", name: "W / Adj", group: "Both layers, a swap on each", algs: [
    "(1,0) / (2,-1) / (1,1) / (2,-1) / (-2,1) / (-1,-1) / (-2,1) / (-1,0)",
    "(3,2) / (-2,1) / (-1,-1) / (-2,1) / (2,-1) / (1,1) / (2,-1) / (0,1)",
  ] },
  { id: "sq1-ep-w-oplus", set: "sq1-EP", name: "W / O+", group: "Both layers, a swap on each", algs: [
    "(1,0) / (2,-4) / (0,3) / (4,1) / (0,3) / (3,-3) / (-1,-4) / (1,-2) / (-1,0)",
    "(-3,-1) / (1,-2) / (-1,-4) / (3,-3) / (0,3) / (4,1) / (0,3) / (2,-4) / (0,1)",
  ] },
  { id: "sq1-ep-w-ominus", set: "sq1-EP", name: "W / O-", group: "Both layers, a swap on each", algs: [
    "(0,-1) / (-2,4) / (0,-3) / (-4,-1) / (0,-3) / (-3,3) / (1,4) / (-1,2) / (0,1)",
    "(4,0) / (-1,2) / (1,4) / (-3,3) / (0,-3) / (-4,-1) / (0,-3) / (-2,4) / (-1,0)",
  ] },
  { id: "sq1-ep-w-opp", set: "sq1-EP", name: "W / Opp", group: "Both layers, a swap on each", algs: [
    "(1,0) / (5,-1) / (-3,0) / (4,1) / (3,0) / (-3,0) / (5,-1) / (-2,1) / (-1,0)",
    "(-3,-1) / (-5,1) / (3,0) / (-4,-1) / (-3,0) / (3,0) / (-5,1) / (2,-1) / (0,1)",
    "(-2,0) / (2,-1) / (-5,1) / (3,0) / (-3,0) / (-4,-1) / (3,0) / (-5,1) / (-1,0)",
  ] },
  { id: "sq1-ep-w-w", set: "sq1-EP", name: "W / W", group: "Both layers, a swap on each", algs: [
    "(1,0) / (5,-1) / (-3,0) / (1,1) / (0,-3) / (-1,-1) / (-2,4) / (-1,0)",
    "(3,2) / (-5,1) / (3,0) / (-1,-1) / (0,3) / (1,1) / (2,-4) / (0,1)",
    "(1,6) / (2,-4) / (1,1) / (0,3) / (-1,-1) / (3,0) / (-5,1) / (-1,0)",
  ] },
  { id: "sq1-ep-z-h", set: "sq1-EP", name: "Z / H", group: "Both layers", algs: [
    "(1,0) / (3,3) / (2,-1) / (-3,3) / (4,-2) / (3,0) / (-3,-3) / (-1,0)",
    "(3,-1) / (-3,-3) / (-2,1) / (3,-3) / (-4,2) / (-3,0) / (3,3) / (0,1)",
    "(1,0) / (3,3) / (-3,0) / (-4,2) / (3,-3) / (-2,1) / (-3,-3) / (-1,0)",
  ] },
  { id: "sq1-ep-z-solved", set: "sq1-EP", name: "Z / Solved", group: "One layer", algs: [
    "(1,0) / (-1,-1) / (-3,0) / (1,1) / (3,0) / (-1,-1) / (0,1)",
    "(3,-1) / (1,1) / (3,0) / (-1,-1) / (-3,0) / (1,1) / (-1,0)",
    "(0,-1) / (1,1) / (-3,0) / (-1,-1) / (3,0) / (1,1) / (-1,0)",
  ] },
  { id: "sq1-ep-z-ua", set: "sq1-EP", name: "Z / Ua", group: "Both layers", algs: [
    "(1,0) / (0,3) / (-1,-1) / (1,-2) / (0,3) / (3,0) / (-1,-1) / (-2,1) / (-1,0)",
    "(3,-4) / (0,-3) / (1,1) / (-1,2) / (0,3) / (-3,0) / (1,1) / (2,-1) / (0,1)",
    "(1,6) / (2,-1) / (1,1) / (-3,0) / (0,3) / (-1,2) / (1,1) / (0,-3) / (-1,0)",
  ] },
  { id: "sq1-ep-z-ub", set: "sq1-EP", name: "Z / Ub", group: "Both layers", algs: [
    "(1,0) / (0,3) / (-1,-1) / (1,-2) / (0,-3) / (3,0) / (-1,-1) / (-2,1) / (-1,0)",
    "(3,-4) / (0,-3) / (1,1) / (-1,2) / (0,-3) / (-3,0) / (1,1) / (2,-1) / (0,1)",
    "(1,6) / (2,-1) / (1,1) / (-3,0) / (0,-3) / (-1,2) / (1,1) / (0,-3) / (-1,0)",
  ] },
  { id: "sq1-ep-z-z", set: "sq1-EP", name: "Z / Z", group: "Both layers", algs: [
    "(-2,0) / (0,3) / (-1,-1) / (4,-2) / (-1,-1) / (-2,1) / (-1,0)",
    "(6,2) / (0,-3) / (1,1) / (-4,2) / (1,1) / (2,-1) / (0,1)",
    "(4,0) / (2,-1) / (1,1) / (-4,2) / (1,1) / (0,-3) / (2,0)",
  ] },
  { id: "sq1-parity-adj", set: "sq1-parity", name: "Adj / Solved", group: "Parity", algs: [
    "/ (-3,0) / (0,3) / (0,-3) / (0,3) / (2,0) / (0,2) / (-2,0) / (4,0) / (0,-2) / (0,2) / (-1,4) / (0,-3) /",
    "(-2,-1) / (3,0) / (0,-3) / (0,3) / (0,-3) / (-2,0) / (0,-2) / (2,0) / (-4,0) / (0,2) / (0,-2) / (1,-4) / (0,3) / (-1,1)",
    "/ (0,3) / (1,-4) / (0,-2) / (0,2) / (-4,0) / (2,0) / (0,-2) / (-2,0) / (0,-3) / (0,3) / (0,-3) / (3,0) /",
  ] },
  { id: "sq1-parity-opp", set: "sq1-parity", name: "Opp / Solved", group: "Parity", algs: [
    "/ (3,3) / (-1,0) / (2,-4) / (4,-2) / (0,-2) / (-4,2) / (1,-5) / (3,0) / (3,3) / (3,0)",
    "(1,-1) / (-3,-3) / (1,0) / (-2,4) / (-4,2) / (0,2) / (4,-2) / (-1,5) / (-3,0) / (-3,-3) / (-4,1)",
    "(-3,0) / (-3,-3) / (-3,0) / (-1,5) / (4,-2) / (0,2) / (-4,2) / (-2,4) / (1,0) / (-3,-3) /",
  ] },
  { id: "sq1-parity-oa", set: "sq1-parity", name: "O+ / Solved", group: "Parity", algs: [
    "/ (3,3) / (1,0) / (-2,-2) / (-2,0) / (2,2) / (-1,0) / (-3,-3) / (1,0) / (2,2) / (0,1)",
    "(1,-1) / (-3,-3) / (-1,0) / (2,2) / (-2,0) / (-2,-2) / (1,0) / (3,3) / (0,-2) / (2,2) / (0,1)",
    "(1,0) / (2,2) / (0,-2) / (3,3) / (1,0) / (-2,-2) / (-2,0) / (2,2) / (-1,0) / (-3,-3) /",
  ] },
  { id: "sq1-parity-ob", set: "sq1-parity", name: "O- / Solved", group: "Parity", algs: [
    "/ (3,3) / (1,0) / (-2,-2) / (2,0) / (2,2) / (-1,0) / (-3,-3) / (0,2) / (-2,-2) / (-1,0)",
    "(1,-1) / (-3,-3) / (-1,0) / (2,2) / (2,0) / (-2,-2) / (1,0) / (3,3) / (-1,0) / (-2,-2) / (-1,0)",
    "(0,-1) / (-2,-2) / (-1,0) / (3,3) / (1,0) / (-2,-2) / (2,0) / (2,2) / (-1,0) / (-3,-3) /",
  ] },
  { id: "sq1-parity-w", set: "sq1-parity", name: "W / Solved", group: "Parity", algs: [
    "(0,-1) / (1,-2) / (-4,0) / (0,3) / (1,0) / (3,-2) / (-4,0) / (-4,0) / (-2,2) / (-1,0) / (0,-3) /",
    "(-2,0) / (-1,2) / (4,0) / (0,-3) / (-1,0) / (-3,2) / (4,0) / (4,0) / (2,-2) / (1,0) / (0,3) / (-1,1)",
    "(-3,0) / (0,3) / (1,0) / (2,-2) / (4,0) / (4,0) / (-3,2) / (-1,0) / (0,-3) / (4,0) / (-1,2) / (0,1)",
  ] },
];
