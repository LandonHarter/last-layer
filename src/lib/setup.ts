import { ALGS, type Alg } from "@/data/algs";
import { engineFor, setupWorks } from "./cases";
import { CFOP_SETS, isCfopSet } from "./cfop-sets";
import { megaWithoutRotations } from "./megaminx";
import { faceTurnsOnly, invertAlg, moveCount, parseAlg, simplifyAlg, withoutRotations } from "./notation";
import { CUBE_SIZE, setsOf, type AlgSet } from "./puzzles";

type Random = () => number;

const pick = <T>(list: readonly T[], random: Random): T => list[Math.floor(random() * list.length)];

const banks = new Map<AlgSet, string[]>();
const bank = (set: AlgSet) => {
  if (!banks.has(set)) banks.set(set, ALGS.filter((a) => a.set === set).flatMap((a) => a.algs));
  return banks.get(set)!;
};
const epll = ALGS.filter((a) => ["pll-ua", "pll-ub", "pll-h", "pll-z"].includes(a.id)).flatMap((a) => a.algs);

/** Undoing an alternative, not the one you drill with, so the setup doesn't spell out the answer. */
function otherAlg(target: Alg, main: string, random: Random): string {
  const others = target.algs.filter((a) => a !== main);
  return pick(others.length ? others : target.algs, random);
}

/** The setup as it's shown: 3x3 and 2x2 in outer face turns only, other puzzles with the rotations taken out. */
function clean(target: Alg, raw: string): string {
  if (target.puzzle === "3x3" || target.puzzle === "2x2") return faceTurnsOnly(raw);
  if (target.puzzle === "megaminx") return simplifyAlg(megaWithoutRotations(raw), "megaminx");
  if (target.puzzle === "sq1") return simplifyAlg(raw, "sq1");
  return simplifyAlg(withoutRotations(raw));
}

// 3x3: outer face turns only, no wide or slice moves, no rotations.
const faceOnly = (alg: string) => parseAlg(alg).every((m) => /^[RLUDFB]$/.test(m.base));

/** The last step on its puzzle, ending solved, so nothing from a later step can hide in the setup. */
function endsSolved(target: Alg): boolean {
  const sets = setsOf(target.puzzle);
  const engine = engineFor(target);
  return !!engine.endsSolved || (target.puzzle !== "3x3" && engine.after.length > 1 && sets.indexOf(target.set) === sets.length - 1);
}

/**
 * Algorithms that scramble what's left after this step but keep what it
 * solves: the later steps on the same puzzle, and for big cubes the 3x3
 * last-layer algorithms in outer turns.
 */
function noiseFor(target: Alg): string[] {
  if (target.set === "F2L") return [...bank("OLL"), ...bank("PLL")];
  if (target.set === "OLL") return bank("PLL");
  if (isCfopSet(target.set)) {
    switch (CFOP_SETS[target.set].goal) {
      case "corners": return epll;
      case "orientation": return bank("PLL");
      case "edges": return [...bank("OLL"), ...bank("PLL")];
      case "solved": return [];
    }
  }
  const sets = setsOf(target.puzzle);
  const later = sets.slice(sets.indexOf(target.set) + 1).flatMap(bank);
  if (target.puzzle === "3x3" || target.puzzle === "2x2" || target.puzzle === "megaminx" || target.puzzle === "sq1") return later;
  return [...later, ...[...bank("OLL"), ...bank("PLL")].map(faceTurnsOnly)];
}

/** Pieces for a two-alg setup: other cases in the set, and for big-cube PLL parity the 3x3 PLLs. */
function pairPieces(target: Alg): string[][] {
  const others = ALGS.filter((a) => a.set === target.set && a.id !== target.id).map((a) => a.algs);
  // Square-1 parity: one parity case and one EP case make another parity case.
  if (target.set === "sq1-parity") others.push(...ALGS.filter((a) => a.set === "sq1-EP").map((a) => a.algs));
  if (CUBE_SIZE[target.puzzle]! > 3 && target.group === "PLL parity") {
    others.push(...ALGS.filter((a) => a.set === "PLL").map((a) => a.algs.map(faceTurnsOnly)));
  }
  return others;
}

/**
 * For a step that ends solved: find two other cases that together make this
 * one, so the setup has nothing to do with any algorithm for it.
 */
function fromPair(target: Alg, main: string, random: Random): string | null {
  const engine = engineFor(target);
  const fingerprint = (state: unknown) => Array.from(state as ArrayLike<number | object>, (x) => (typeof x === "object" ? JSON.stringify(x) : x)).join("|");
  // Setups that work are exactly: a turn of the top, the main undone, a turn of the top.
  const undo = invertAlg(main, engine.notation);
  // A step that ends solved without turns after (the Square-1's) still allows any of its turns at the end.
  const ends = engine.after.length > 1 ? engine.after : engine.before;
  const goals = new Set(engine.before.flatMap((a) => ends.map((b) => fingerprint(engine.start(`${b} ${undo} ${a}`)))));
  const others = pairPieces(target);
  if (!others.length) return null;
  const hits: string[] = [];
  for (let i = 0; i < 600 && hits.length < 4; i++) {
    const first = invertAlg(pick(pick(others, random), random), engine.notation);
    const second = invertAlg(pick(pick(others, random), random), engine.notation);
    const auf = () => pick(engine.before, random);
    const setup = `${auf()} ${first} ${auf()} ${second} ${auf()}`;
    if (goals.has(fingerprint(engine.start(setup)))) hits.push(clean(target, setup));
  }
  // Keep the shortest of the few found.
  return hits.sort((a, b) => moveCount(a) - moveCount(b))[0] ?? null;
}

/**
 * Moves that set up `target` from a solved puzzle, for someone who solves it
 * with `main`. Every one is checked with the simulator.
 *
 * - A step that leaves work for later (F2L, OLL, EO …): an algorithm from a
 *   later step scrambles what's left, then an alternative for the case is undone.
 * - A step that ends solved (PLL, PBL, CP …): two other cases that combine
 *   into this one, else an undone alternative.
 */
export function makeSetup(target: Alg, main: string, random: Random = Math.random): string {
  const engine = engineFor(target);
  const auf = () => pick(engine.before, random);
  const undoOther = () => invertAlg(otherAlg(target, main, random), engine.notation);
  const attempts: (() => string | null)[] = [];
  if (endsSolved(target)) {
    attempts.push(() => fromPair(target, main, random));
  } else {
    const noise = noiseFor(target);
    if (noise.length) attempts.push(() => `${auf()} ${pick(noise, random)} ${auf()} ${undoOther()} ${auf()}`);
  }
  attempts.push(() => `${auf()} ${undoOther()} ${auf()}`);

  for (const attempt of attempts) {
    for (let i = 0; i < 5; i++) {
      const raw = attempt();
      if (!raw) break;
      const setup = clean(target, raw);
      if (setup && (target.puzzle !== "3x3" || faceOnly(setup)) && setupWorks(target, setup, main)) return setup;
    }
  }
  // The main undone, after whichever turn lets it start (a Square-1 alg can end at another angle, so undoing it may need one).
  for (const before of engine.before) {
    const setup = clean(target, `${before} ${invertAlg(main, engine.notation)}`);
    if (setupWorks(target, setup, main)) return setup;
  }
  return clean(target, invertAlg(main, engine.notation));
}
