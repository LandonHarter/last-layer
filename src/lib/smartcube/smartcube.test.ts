import { describe, expect, test } from "bun:test";
import { ALGS } from "@/data/algs";
import { applyAlg, normalizeOrientation, solvedCube } from "../cube";
import { CaseAttempt, EXTRA_TURNS, PAUSE_MS, reportedTurns } from "./matcher";
import { decodeMoves, encodeMoves, fitTimes, htm, mergeQuarterTurns } from "./moves";
import { ScrambleGuide } from "./guide";
import { computeSplits, identifyCases } from "./splits";
import { fromFacelets, gripMap, reportsFor, SOLVED_FACELETS, toFacelets, toGrip } from "./state";

describe("facelets", () => {
  test("solved and after F R match the Kociemba strings", () => {
    expect(SOLVED_FACELETS).toBe("UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB");
    expect(toFacelets(applyAlg(solvedCube(), "F R"))).toBe("UUFUUFLLFUUURRRRRRFFRFFDFFDRRBDDBDDBLLDLLDLLDLBBUBBUBB");
  });
  test("round trip", () => {
    const f = toFacelets(applyAlg(solvedCube(), "R U R' F' L2 D B'"));
    expect(toFacelets(fromFacelets(f))).toBe(f);
    expect(toFacelets(applyAlg(fromFacelets(f), "B D' L2 F R U' R'"))).toBe(SOLVED_FACELETS);
  });
});

describe("moves", () => {
  test("encode and decode", () => {
    const m = [{ move: "R", t: 0 }, { move: "U'", t: 112 }, { move: "F2", t: 240.4 }];
    expect(encodeMoves(m)).toBe("R/0 U'/112 F2/240");
    expect(decodeMoves("R/0 U'/112 F2/240")).toEqual([{ move: "R", t: 0 }, { move: "U'", t: 112 }, { move: "F2", t: 240 }]);
  });
  test("quarter turns close together merge into a half turn", () => {
    expect(mergeQuarterTurns([{ move: "R", t: 0 }, { move: "R", t: 80 }, { move: "U", t: 200 }]).map((m) => m.move)).toEqual(["R2", "U"]);
    expect(mergeQuarterTurns([{ move: "R", t: 0 }, { move: "R", t: 900 }]).map((m) => m.move)).toEqual(["R", "R"]);
  });
  test("htm", () => {
    expect(htm(["R", "R", "U", "R'"])).toBe(3);
  });
  test("fitTimes falls back to host times without cube clock", () => {
    expect(fitTimes([{ move: "R", local: 10, cube: null }, { move: "U", local: 20, cube: null }])).toEqual([10, 20]);
    const fit = fitTimes([{ move: "R", local: 100, cube: 0 }, { move: "U", local: 205, cube: 100 }, { move: "F", local: 300, cube: 200 }]);
    expect(fit[2] - fit[0]).toBeCloseTo(200, 0);
  });
});

describe("reports", () => {
  test("slices and wide moves become outer turns with the same effect", () => {
    for (const alg of ["M2 U M2 U2 M2 U M2", "r U R' U' r' F R F'", "R U R' y R U R' y'", "x R' U R' D2 R U' R' D2 R2 x'", "S R S'", "M' U2 M U2"]) {
      const physical = normalizeOrientation(applyAlg(solvedCube(), alg));
      expect(toFacelets(applyAlg(solvedCube(), reportsFor(alg).join(" ")))).toBe(toFacelets(physical));
    }
  });
  test("grip map: yellow up, green front", () => {
    const map = gripMap("D", "F");
    expect(map).toMatchObject({ U: "D", D: "U", F: "F", B: "B", R: "L", L: "R" });
    expect(toGrip("R'", map)).toBe("L'");
  });
});

describe("matcher", () => {
  const cases = ALGS.filter((a) => a.set === "OLL" || a.set === "PLL" || (a.set === "F2L" && !a.slot));
  test("every main alg, done on the cube in any hold, solves its case", () => {
    const grip = gripMap("D", "F");
    for (const c of cases) {
      const attempt = new CaseAttempt(c, c.algs[0], 0);
      let result = null;
      // The user holds yellow up; the cube names turns by its centres; the app maps them back.
      for (const [i, r] of reportsFor(c.algs[0], "D", "F").entries()) result = attempt.turn(toGrip(r, grip), 1000 + i * 100) ?? result;
      expect({ id: c.id, ok: result?.ok }).toEqual({ id: c.id, ok: true });
    }
  });
  test("a wrong alg misses after the extra turns", () => {
    const t = ALGS.find((a) => a.id === "pll-t")!;
    const attempt = new CaseAttempt(t, t.algs[0], 0);
    let result = null;
    for (let i = 0; i < reportedTurns(t.algs[0]) + EXTRA_TURNS && !result; i++) result = attempt.turn(i % 2 ? "U" : "R", 1000 + i * 50);
    expect(result?.ok).toBe(false);
  });
  test("a pause misses", () => {
    const t = ALGS.find((a) => a.id === "pll-t")!;
    const attempt = new CaseAttempt(t, t.algs[0], 0);
    attempt.turn("R", 1000);
    expect(attempt.tick(1000 + PAUSE_MS - 1)).toBeNull();
    expect(attempt.tick(1000 + PAUSE_MS + 1)?.ok).toBe(false);
  });
  test("recognition and execution times", () => {
    const t = ALGS.find((a) => a.id === "pll-t")!;
    const attempt = new CaseAttempt(t, t.algs[0], 0);
    let result = null;
    for (const [i, r] of reportsFor(t.algs[0]).entries()) result = attempt.turn(r, 1500 + i * 100) ?? result;
    expect(result).toMatchObject({ ok: true, recogMs: 1500 });
    expect(result!.execMs).toBe((reportsFor(t.algs[0]).length - 1) * 100);
  });
});

describe("splits", () => {
  // A scramble and a CFOP solution on a white cross (cross on U in the cube's frame, solved upside down).
  const oll = ALGS.find((a) => a.id === "oll-27")!.algs[0];
  const pll = ALGS.find((a) => a.id === "pll-t")!.algs[0];
  const pair = "R U R'";
  test("finds cross, pairs, OLL and PLL with recognition and execution", () => {
    // Held yellow up (white cross down): cross fix, one pair, OLL 45, Ja perm.
    const solution = "F2 U R U' R' F R U R' U' F' " + ALGS.find((a) => a.id === "pll-ja")!.algs[0];
    const reported = reportsFor(solution, "D", "F");
    const scramble = reported.slice().reverse().map((m) => (m.endsWith("'") ? m[0] : `${m}'`)).join(" ");
    // A pause of 1 s before each step's first turn.
    const starts = new Set([2, 6, 12]);
    let t = 0;
    const timed = reported.map((move, i) => ({ move, t: i === 0 ? 0 : (t += starts.has(i) ? 1000 : 100) }));
    const splits = computeSplits(scramble, timed)!;
    expect(splits.cross).toBe("U");
    expect(splits.steps.map((s) => [s.name, s.moves])).toEqual([["cross", 2], ["f2l", 4], ["oll", 6], ["pll", reported.length - 12]]);
    expect(splits.steps[2]).toMatchObject({ recogMs: 1000, execMs: 500 });
    expect(splits.pairs.map((p) => p.skipped)).toEqual([true, true, true, false]);
    expect(identifyCases(scramble, timed, splits)).toEqual({ oll: "oll-45", pll: "pll-ja" });
  });
  test("identifies the OLL and PLL a solve went through, on any cross colour", () => {
    for (const [top, front] of [["U", "F"], ["D", "F"], ["R", "U"], ["B", "L"]] as const) {
      const ollCase = ALGS.find((a) => a.id === "oll-45")!;
      const pllCase = ALGS.find((a) => a.id === "pll-ja")!;
      // Holding `top` up: the scramble undoes PLL then OLL on the last layer.
      const solution = `${ollCase.algs[0]} ${pllCase.algs[0]}`;
      const reported = reportsFor(solution, top, front);
      // Scramble = inverse of the reported solution, in the cube's frame.
      const scramble = reported.slice().reverse().map((m) => (m.endsWith("'") ? m[0] : `${m}'`)).join(" ");
      const timed = reported.map((move, i) => ({ move, t: i * 150 }));
      const { oll, pll } = identifyCases(scramble, timed);
      expect({ top, oll, pll }).toEqual({ top, oll: "oll-45", pll: "pll-ja" });
    }
  });
});

describe("scramble guide", () => {
  const scramble = "R U2 F' D";
  test("follows the scramble, half turns either way", () => {
    let state = solvedCube();
    const guide = new ScrambleGuide(scramble, state);
    const turn = (m: string) => guide.turn(m, (state = applyAlg(state, m)));
    expect(guide.current).toEqual({ kind: "on", done: 0, half: false });
    expect(turn("R")).toEqual({ kind: "on", done: 1, half: false });
    expect(turn("U'")).toEqual({ kind: "on", done: 1, half: true });
    expect(turn("U'")).toEqual({ kind: "on", done: 2, half: false });
    expect(turn("F")).toEqual({ kind: "off", done: 2, fix: "F'" });
    expect(turn("F")).toEqual({ kind: "off", done: 2, fix: "F2" });
    expect(turn("F2")).toEqual({ kind: "on", done: 2, half: false });
    turn("F'");
    expect(turn("D")).toEqual({ kind: "scrambled" });
  });
  test("lost when the cube isn't solved or on the way", () => {
    expect(new ScrambleGuide(scramble, applyAlg(solvedCube(), "B")).current).toEqual({ kind: "lost" });
  });
});
