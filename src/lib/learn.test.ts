import { describe, expect, test } from "bun:test";
import { ALGS, SETS } from "@/data/algs";
import { nextTask, planBatches, planCases, SOLID, type LearnData } from "./learn";
import { chunkAlg, memoryTips } from "./triggers";
import { splitMoves } from "./notation";

describe("learn plan", () => {
  test.each(SETS.map((s) => [s]))("%s: every case is planned exactly once", (set) => {
    const ids = planCases(set).map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(ALGS.filter((a) => a.set === set).map((a) => a.id).sort());
  });

  test.each(SETS.flatMap((s) => [3, 4, 5, 6].map((n) => [s, n] as const)))("%s in batches of %d", (set, size) => {
    const batches = planBatches(set, size);
    expect(batches.flatMap((b) => b.ids).length).toBe(planCases(set).length);
    for (const b of batches) {
      expect(b.ids.length).toBeGreaterThan(0);
      expect(b.ids.length).toBeLessThanOrEqual(size);
      expect(b.why.length).toBeGreaterThan(0);
    }
  });

  test("skips learned cases", () => {
    const ids = planBatches("PLL", 4, (id) => id === "pll-t").flatMap((b) => b.ids);
    expect(ids).not.toContain("pll-t");
    expect(ids.length).toBe(20);
  });
});

describe("chunks", () => {
  test.each(ALGS.flatMap((a) => a.algs.map((alg) => [a.id, alg] as const)))("%s: %s chunks back to itself", (_id, alg) => {
    const chunks = chunkAlg(alg);
    expect(chunks.flatMap((c) => c.moves)).toEqual(splitMoves(alg));
    for (const c of chunks) expect(c.moves.length).toBeGreaterThan(0);
  });

  test("finds named triggers", () => {
    expect(chunkAlg("R U R' U' R' F R F'").map((c) => c.name)).toEqual(["Sexy move", "Sledgehammer"]);
    expect(chunkAlg("R U R' U R U2 R'")[0].name).toBe("Sune");
    expect(chunkAlg("L' U' L U")[0].name).toBe("Left sexy move");
  });

  test("Antisune is Sune's inverse and Na/Nb are mirrors", () => {
    const main = (a: (typeof ALGS)[number]) => a.algs[0];
    const oll26 = ALGS.find((a) => a.id === "oll-26")!;
    expect(memoryTips(oll26, oll26.algs[0], main, new Set(["oll-27"])).some((t) => t.caseId === "oll-27")).toBe(true);
    const na = ALGS.find((a) => a.id === "pll-na")!;
    expect(memoryTips(na, na.algs[0], main, new Set()).some((t) => t.caseId === "pll-nb")).toBe(true);
  });
});

describe("next task", () => {
  const base: LearnData = { set: "PLL", size: 3, batch: {}, cases: {} };
  const batch = ["a", "b", "c"];
  const with_ = (cases: LearnData["cases"]): LearnData => ({ ...base, cases });

  test("starts by learning the first case", () => {
    expect(nextTask(batch, base, null)).toEqual({ kind: "learn", id: "a" });
  });

  test("practices a new case before learning another", () => {
    expect(nextTask(batch, with_({ a: { stage: "recall", streak: 0 } }), "a")).toEqual({ kind: "recall", id: "a" });
    expect(nextTask(batch, with_({ a: { stage: "recall", streak: 1 } }), "a")).toEqual({ kind: "learn", id: "b" });
  });

  test("holds new cases back while two are shaky", () => {
    const d = with_({ a: { stage: "recall", streak: 1 }, b: { stage: "recall", streak: 2 } });
    expect(nextTask(batch, d, "b", () => 0.9)).toEqual({ kind: "recall", id: "a" });
  });

  test("done when all are solid", () => {
    const solid = { stage: "recall" as const, streak: SOLID };
    expect(nextTask(batch, with_({ a: solid, b: solid, c: solid }), null)).toEqual({ kind: "done" });
  });
});
