import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { caseSvg } from "../../scripts/case-svg";
import { ALGS } from "@/data/algs";
import { caseState, caseStickers, engineFor, fitAlg, setupWorks, stepDone } from "./cases";
import { megaF2LSolved } from "./megaminx";
import { belowTopSolved, faceStickers } from "./nxn";
import { CUBE_SIZE, notationOf, setsOf } from "./puzzles";
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
import { faceTurnsOnly, invertAlg, mirrorAlg, parseAlg, simplifyAlg } from "./notation";
import { makeSetup } from "./setup";

const cases = ALGS.map((a) => [a.id, a] as const);
const cube3 = cases.filter(([, a]) => a.puzzle === "3x3");
const others = cases.filter(([, a]) => a.puzzle !== "3x3");
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

  test("megaminx turns are fifths", () => {
    expect(invertAlg("R2 U2' R'", "megaminx")).toBe("R U2 R2'");
    expect(simplifyAlg("U2 U2", "megaminx")).toBe("U'");
    expect(simplifyAlg("U2 U", "megaminx")).toBe("U2'");
    expect(simplifyAlg("R2 R2'", "megaminx")).toBe("");
    expect(mirrorAlg("R U BR'", "M", "megaminx")).toBe("L' U' BL");
  });

  test("big-cube moves keep their layers", () => {
    expect(invertAlg("3Rw U2 2R' Lw2")).toBe("Lw2 2R U2 3Rw'");
    expect(mirrorAlg("3Rw 2R' U", "M")).toBe("3Lw' 2L U'");
  });

  test.each(cases)("%s parses and round-trips", (_id, a) => {
    const nt = notationOf(a.set);
    for (const alg of a.algs) {
      expect(() => parseAlg(alg, nt)).not.toThrow();
      expect(invertAlg(invertAlg(alg, nt), nt)).toBe(simplifyAlg(alg, nt));
    }
  });
});

describe("algorithm data", () => {
  test("ids are unique and counts match", () => {
    expect(new Set(ALGS.map((a) => a.id)).size).toBe(ALGS.length);
    expect(ALGS.filter((a) => a.set === "F2L")).toHaveLength(41);
    expect(ALGS.filter((a) => a.set === "OLL")).toHaveLength(57);
    expect(ALGS.filter((a) => a.set === "PLL")).toHaveLength(21);
    expect(ALGS.filter((a) => a.set === "2x2-OLL")).toHaveLength(7);
    expect(ALGS.filter((a) => a.set === "2x2-PBL")).toHaveLength(8);
    // Megaminx cases up to turns of the top: edge flips with an even count, corner
    // twists summing to a whole turn, and the even permutations of five pieces.
    expect(ALGS.filter((a) => a.set === "mega-EO")).toHaveLength(3);
    expect(ALGS.filter((a) => a.set === "mega-CO")).toHaveLength(16);
    expect(ALGS.filter((a) => a.set === "mega-EP")).toHaveLength(3);
    expect(ALGS.filter((a) => a.set === "mega-CP")).toHaveLength(15);
  });

  test("every case belongs to its puzzle's sets", () => {
    for (const a of ALGS) expect(setsOf(a.puzzle)).toContain(a.set);
  });

  test.each(cube3)("%s: setup then alg solves", (_id, a) => {
    const state = applyAlg(caseStickers(a.algs[0]), a.algs[0]);
    expect(isSolved(normalizeOrientation(state))).toBe(true);
  });

  test.each(others)("%s: the case needs its step, and only touches what the step solves", (_id, a) => {
    const engine = engineFor(a);
    const state = caseState(a);
    expect(stepDone(a, state)).toBe(false);
    expect(stepDone(a, engine.apply(state, a.algs[0]))).toBe(true);
    const n = CUBE_SIZE[a.puzzle];
    if (a.puzzle === "megaminx") expect(megaF2LSolved(state as Uint8Array)).toBe(true);
    else if (a.set === "2x2-OLL") expect(faceStickers(state as Uint8Array, 2, "D").every((c) => c === 1)).toBe(true);
    else if (n && n > 3 && a.group !== "No parity") expect(belowTopSolved(state as Uint8Array, n)).toBe(true);
  });

  test.each(cube3)("%s: only touches its step", (_id, a) => {
    const state = normalizeOrientation(caseStickers(a.algs[0]));
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
    const engine = engineFor(a);
    for (const alg of a.algs) expect(engine.keepsOrientation(alg)).toBe(true);
    if (a.puzzle === "3x3") for (const alg of a.algs) expect(keepsOrientation(alg)).toBe(true);
  });

  test("no two cases are the same", () => {
    for (const set of new Set(ALGS.map((a) => a.set))) {
      const inSet = ALGS.filter((a) => a.set === set);
      for (const a of inSet)
        for (const b of inSet) if (a !== b && a.group === b.group) expect(fitAlg(a, b.algs[0])).toBeNull();
    }
  });

  test.each(alternatives)("%s: alternative %s solves the case as pictured", (_id, alt, a) => {
    const state = engineFor(a).apply(caseState(a), alt);
    expect(stepDone(a, state)).toBe(true);
  });

  test.each(cases)("%s: has a case image, drawn from the current data", (id, a) => {
    const file = `public/cases/${id}.svg`;
    expect(existsSync(file)).toBe(true);
    const drawn = caseSvg(a);
    if (drawn) expect(readFileSync(file, "utf8")).toBe(drawn);
  });

  test.each(cases)("%s: no duplicate algorithms", (_id, a) => {
    expect(new Set(a.algs).size).toBe(a.algs.length);
  });
});

describe("face turns only", () => {
  const all = ALGS.filter((a) => a.puzzle === "3x3").flatMap((a) => a.algs.map((alg) => [a.id, alg] as const));
  test.each(all)("%s: %s gives the same cube with face turns", (_id, alg) => {
    const faces = faceTurnsOnly(alg);
    expect(parseAlg(faces).every((m) => /^[RLUDFB]$/.test(m.base))).toBe(true);
    expect(applyAlg(solvedCube(), faces)).toEqual(normalizeOrientation(applyAlg(solvedCube(), alg)));
  });

  test("rewrites wide, slice and rotation moves", () => {
    expect(faceTurnsOnly("r U r'")).toBe("L F L'");
    expect(faceTurnsOnly("M2 U M2")).toBe("R2 L2 D R2 L2");
    expect(faceTurnsOnly("R L R'")).toBe("L");
  });
});

describe("drill setups", () => {
  test.each(cases)("%s: setups work with every algorithm", (_id, a) => {
    for (const main of a.algs.slice(0, 4)) {
      const setup = makeSetup(a, main);
      expect(setupWorks(a, setup, main)).toBe(true);
      const moves = parseAlg(setup, notationOf(a.set));
      if (a.puzzle === "3x3" || a.puzzle === "2x2") expect(moves.every((m) => /^[RLUDFB]$/.test(m.base))).toBe(true);
      else expect(moves.every((m) => !/^[xyz]$/.test(m.base))).toBe(true);
    }
  });

  test("setups are not the plain inverse of the main", () => {
    for (const a of ALGS) {
      if (a.algs.length < 2) continue;
      if (a.puzzle !== "3x3") continue;
      expect(makeSetup(a, a.algs[0])).not.toBe(faceTurnsOnly(invertAlg(a.algs[0])));
    }
  });
});

describe("custom algorithms", () => {
  test("accepts a valid alg at any angle and rejects others", () => {
    const sune = ALGS.find((a) => a.id === "oll-27")!;
    expect(fitAlg(sune, "U R U R' U R U2 R'")).not.toBeNull();
    expect(fitAlg(sune, "R U R' U'")).toBeNull();
    const t = ALGS.find((a) => a.id === "pll-t")!;
    expect(fitAlg(t, "U2 R U R' U' R' F R2 U' R' U' R U R' F' U2")).not.toBeNull();
    const parity = ALGS.find((a) => a.id === "4x4-oll-parity")!;
    expect(fitAlg(parity, "U Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'")).not.toBeNull();
    expect(fitAlg(parity, "R U R' U'")).toBeNull();
    const megaSune = ALGS.find((a) => a.id === "mega-co-5")!;
    expect(fitAlg(megaSune, "U R U R' U R U2' R'")).not.toBeNull();
    expect(fitAlg(megaSune, "R U R' U R U2 R'")).toBeNull();
  });
});
