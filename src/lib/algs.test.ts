import { describe, expect, test } from "bun:test";
import { ALGS } from "@/data/algs";
import { caseState, fitAlg, setupWorks, stepDone } from "./cases";
import {
  applyAlg,
  f2lSolved,
  isSolved,
  keepsOrientation,
  normalizeOrientation,
  solvedCube,
  topOriented,
  topStickerMoves,
} from "./cube";
import { invertAlg, mirrorAlg, parseAlg, simplifyAlg } from "./notation";
import { makeSetup } from "./setup";

const cases = ALGS.map((a) => [a.id, a] as const);
const alternatives = ALGS.flatMap((a) => a.algs.slice(1).map((alt) => [a.id, alt, a] as const));

describe("notation", () => {
  test("inverts turns and order", () => {
    expect(invertAlg("R U2 r' (x y')")).toBe("y x' r U2 R'");
    expect(invertAlg("Rw U R2'")).toBe("R2 U' Rw'");
  });

  test("merges neighbouring turns", () => {
    expect(simplifyAlg("U U2 R R' F")).toBe("U' F");
    expect(simplifyAlg("R U U' R'")).toBe("");
  });

  test("mirrors left to right", () => {
    expect(mirrorAlg("R U R' U'", "M")).toBe("L' U' L U");
    expect(mirrorAlg("R U R'", "FR")).toBe("F' U' F");
  });

  test.each(cases)("%s parses and round-trips", (_id, a) => {
    for (const alg of a.algs) {
      expect(() => parseAlg(alg)).not.toThrow();
      expect(invertAlg(invertAlg(alg))).toBe(simplifyAlg(alg));
    }
  });
});

describe("algorithm data", () => {
  test("ids are unique and counts match", () => {
    expect(new Set(ALGS.map((a) => a.id)).size).toBe(ALGS.length);
    expect(ALGS.filter((a) => a.set === "F2L")).toHaveLength(41);
    expect(ALGS.filter((a) => a.set === "OLL")).toHaveLength(57);
    expect(ALGS.filter((a) => a.set === "PLL")).toHaveLength(21);
  });

  test.each(cases)("%s: setup then alg solves", (_id, a) => {
    const state = applyAlg(caseState(a.algs[0]), a.algs[0]);
    expect(isSolved(normalizeOrientation(state))).toBe(true);
  });

  test.each(cases)("%s: only touches its step", (_id, a) => {
    const state = normalizeOrientation(caseState(a.algs[0]));
    if (a.set === "F2L") {
      expect(f2lSolved(state)).toBe(false);
      // The other three slots and the cross stay put.
      const others = state.filter((s) => s.pos[1] < 1 && !(s.pos[0] === 1 && s.pos[2] === 1));
      const home = solvedCube();
      expect(others.every((s) => `${home[s.id].pos}${home[s.id].normal}` === `${s.pos}${s.normal}`)).toBe(true);
      return;
    }
    expect(f2lSolved(state)).toBe(true);
    if (a.set === "OLL") {
      expect(topOriented(state)).toBe(false);
    } else {
      expect(topOriented(state)).toBe(true);
      expect(topStickerMoves(a.algs[0]).length).toBeGreaterThan(0);
    }
  });

  test.each(cases)("%s: ends in starting orientation", (_id, a) => {
    for (const alg of a.algs) expect(keepsOrientation(alg)).toBe(true);
  });

  test("no two cases are the same", () => {
    for (const set of ["F2L", "OLL", "PLL"] as const) {
      const inSet = ALGS.filter((a) => a.set === set);
      for (const a of inSet)
        for (const b of inSet) if (a !== b) expect(fitAlg(set, a.algs[0], b.algs[0])).toBeNull();
    }
  });

  test.each(alternatives)("%s: alternative %s solves the case as pictured", (_id, alt, a) => {
    const state = applyAlg(caseState(a.algs[0]), alt);
    expect(stepDone(a.set, state)).toBe(true);
  });

  test.each(cases)("%s: no duplicate algorithms", (_id, a) => {
    expect(new Set(a.algs).size).toBe(a.algs.length);
  });
});

describe("drill setups", () => {
  test.each(cases)("%s: setups work with every algorithm", (_id, a) => {
    for (const main of a.algs.slice(0, 4)) {
      const setup = makeSetup(a, main);
      expect(setupWorks(a.set, setup, main)).toBe(true);
    }
  });

  test("setups are not the plain inverse of the main", () => {
    for (const a of ALGS) {
      if (a.algs.length < 2) continue;
      expect(makeSetup(a, a.algs[0])).not.toBe(simplifyAlg(invertAlg(a.algs[0])));
    }
  });
});

describe("custom algorithms", () => {
  test("accepts a valid alg at any angle and rejects others", () => {
    const sune = ALGS.find((a) => a.id === "oll-27")!;
    expect(fitAlg("OLL", sune.algs[0], "U R U R' U R U2 R'")).not.toBeNull();
    expect(fitAlg("OLL", sune.algs[0], "R U R' U'")).toBeNull();
    const t = ALGS.find((a) => a.id === "pll-t")!;
    expect(fitAlg("PLL", t.algs[0], "U2 R U R' U' R' F R2 U' R' U' R U R' F' U2")).not.toBeNull();
  });
});
