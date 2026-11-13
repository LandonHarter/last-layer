import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { ALGS, ALGS_BY_ID, F2L_SLOT_ALGS, slotSiblings } from "@/data/algs";
import { caseState, engineFor, fitAlg, setupWorks, stepDone } from "./cases";
import { applyAlg, f2lSolved, normalizeOrientation, solvedCube } from "./cube";
import { f2lToSlot, parseSlotId, slotCaseId } from "./f2l-slot";
import { parseAlg } from "./notation";
import { makeSetup } from "./setup";

const slotCases = F2L_SLOT_ALGS.map((a) => [a.id, a] as const);

describe("F2L slot cases", () => {
  test("three more slots for each of the 41 cases", () => {
    expect(F2L_SLOT_ALGS).toHaveLength(123);
    expect(ALGS.filter((a) => a.set === "F2L")).toHaveLength(41);
    expect(slotSiblings(ALGS_BY_ID.get("f2l-5-bl")!).map((a) => a.id)).toEqual(["f2l-5", "f2l-5-fl", "f2l-5-br", "f2l-5-bl"]);
  });

  test("ids round-trip", () => {
    expect(slotCaseId("f2l-5", "FR")).toBe("f2l-5");
    expect(slotCaseId("f2l-5", "BL")).toBe("f2l-5-bl");
    expect(parseSlotId("f2l-5-bl")).toEqual({ baseId: "f2l-5", slot: "BL" });
    expect(parseSlotId("f2l-5")).toEqual({ baseId: "f2l-5", slot: "FR" });
    expect(parseSlotId("oll-5")).toBeNull();
  });

  test("front-left relabels faces: R becomes F", () => {
    expect(f2lToSlot("R U R'", "FL")).toBe("F U F'");
  });

  test.each(slotCases)("%s: the reference is face turns only and puts the pair in its own slot", (_id, a) => {
    expect(parseAlg(a.algs[0]).every((m) => /^[RLUDFB]$/.test(m.base))).toBe(true);
    // Same pieces as the front-right case, so its slot is the only one unsolved.
    expect(f2lSolved(applyAlg(solvedCube(), a.algs[0]))).toBe(false);
  });

  test.each(slotCases)("%s: every algorithm solves the case as pictured", (_id, a) => {
    const start = caseState(a);
    for (const alg of a.algs) {
      expect(stepDone(a, engineFor(a).apply(start, alg))).toBe(true);
      expect(fitAlg(a, alg)).toBe(alg);
    }
  });

  test.each(slotCases)("%s: has a case image", (id) => {
    expect(existsSync(`public/cases/${id}.svg`)).toBe(true);
  });

  test("regrip algs may end with the cube turned, but the U centre must stay up", () => {
    const br = ALGS_BY_ID.get("f2l-1-br")!;
    const regrip = br.algs.find((a) => a.startsWith("y "))!;
    expect(regrip).toBeDefined();
    expect(fitAlg(br, regrip)).toBe(regrip);
    expect(fitAlg(br, `x ${regrip}`)).toBeNull();
    expect(normalizeOrientation(applyAlg(solvedCube(), "y")).length).toBe(54);
  });

  test.each(slotCases)("%s: drill setups are face turns that work with each main", (_id, a) => {
    for (const main of [a.algs[0], a.algs.at(-1)!]) {
      const setup = makeSetup(a, main);
      expect(parseAlg(setup).every((m) => /^[RLUDFB]$/.test(m.base))).toBe(true);
      expect(setupWorks(a, setup, main)).toBe(true);
    }
  });
});
