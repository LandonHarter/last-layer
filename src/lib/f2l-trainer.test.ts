import { expect, test } from "bun:test";
import { applyAlg, f2lSolved, normalizeOrientation, solvedCube } from "./cube";
import { invertAlg, simplifyAlg } from "./notation";
import {
  F2L_CASES, F2L_SLOTS, checkF2LSolution, describeF2LSolution, f2lComparisons, f2lCrossSolved,
  f2lSlotSolved, f2lToSlot, f2lVariantKey, f2lVariants, makeF2LExercise, pickF2LVariant, recordF2LResult,
} from "./f2l-trainer";

test("every case, slot, mirror and U position has a valid goal and verified alternatives", () => {
  const variants = f2lVariants(F2L_CASES.map((c) => c.id), F2L_SLOTS, true);
  expect(variants).toHaveLength(41 * 4 * 2 * 4);
  for (const variant of variants) {
    const exercise = makeF2LExercise(variant, () => 0.37);
    const start = applyAlg(solvedCube(), exercise.setup);
    expect(f2lCrossSolved(start)).toBe(true);
    expect(f2lSlotSolved(start, variant.slot)).toBe(false);
    for (const slot of exercise.protectedSlots) expect(f2lSlotSolved(start, slot)).toBe(true);
    const reference = F2L_CASES.find((c) => c.id === variant.caseId)!.algs[0];
    const solution = simplifyAlg(`${invertAlg(variant.auf)} ${f2lToSlot(reference, variant.slot, variant.mirrored)}`);
    expect(checkF2LSolution(exercise, solution)).toMatchObject({ ok: true, solved: true });
    const comparisons = f2lComparisons(exercise);
    expect(comparisons.length).toBeGreaterThan(0);
    for (const candidate of comparisons) expect(checkF2LSolution(exercise, candidate.alg)).toMatchObject({ solved: true });
  }
}, 30000);

const exercise = makeF2LExercise({ caseId: "f2l-4", slot: "FR", mirrored: false, auf: "" }, () => 0);
const solution = "R U R'";

test("goal follows target pieces and accepts a changed hold, without requiring a solved last layer", () => {
  const check = checkF2LSolution(exercise, `${solution} x y z`);
  expect(check).toMatchObject({ ok: true, solved: true, htm: 3, rotations: 3 });
  expect(checkF2LSolution(exercise, "U")).toMatchObject({ ok: true, targetSolved: false, solved: false });
});

test("cross and protected slots are checked independently; an open slot may remain unsolved", () => {
  const breakFL = "L' U' L";
  expect(checkF2LSolution(exercise, `${solution} ${breakFL}`)).toMatchObject({ targetSolved: true, crossSolved: true, brokenSlots: ["FL"], solved: false });
  const open = { ...exercise, protectedSlots: [] };
  expect(checkF2LSolution(open, `${solution} ${breakFL}`)).toMatchObject({ solved: true });
  const final = normalizeOrientation(applyAlg(applyAlg(solvedCube(), exercise.setup), `${solution} ${breakFL}`));
  expect(f2lSolved(final)).toBe(false);
  expect(checkF2LSolution(exercise, `${solution} D`)).toMatchObject({ targetSolved: false, crossSolved: false, solved: false });
});

test("submitted costs include wasted moves and rotations, and invalid 3x3 moves give useful errors", () => {
  expect(checkF2LSolution(exercise, `${solution} U U' y y'`)).toMatchObject({ solved: true, htm: 5, rotations: 2 });
  expect(describeF2LSolution("Rw U2 M' y")).toMatchObject({ htm: 4, rotations: 1 });
  for (const alg of ["", "Q", "3Rw", "2R", "9F", "R ".repeat(1001)]) expect(checkF2LSolution(exercise, alg).ok).toBe(false);
});

test("back-slot comparisons include both rotation-free and changed-hold solutions", () => {
  const back = makeF2LExercise({ caseId: "f2l-4", slot: "BR", mirrored: true, auf: "U2" }, () => 0.7);
  const comparisons = f2lComparisons(back);
  expect(comparisons.some((c) => c.rotations === 0)).toBe(true);
  expect(comparisons.some((c) => c.rotations === 1)).toBe(true);
  expect(f2lComparisons(back, "R").some((c) => c.alg === "R")).toBe(false);
});

test("progress separates efficient, merely correct and assisted attempts", () => {
  const target = { alg: solution, htm: 3, rotations: 0 };
  const good = checkF2LSolution(exercise, solution);
  const slow = checkF2LSolution(exercise, `${solution} U U'`);
  const first = recordF2LResult(undefined, good, target, false, 100);
  expect(first).toMatchObject({ attempts: 1, solved: 1, efficient: 1, streak: 1, lastSeen: 100, best: target });
  const second = recordF2LResult(first, slow, target, false, 200);
  expect(second).toMatchObject({ attempts: 2, solved: 2, efficient: 1, streak: 0, best: target });
  expect(recordF2LResult(first, good, target, true, 300)).toMatchObject({ efficient: 1, streak: 0 });
  expect(recordF2LResult(first, null, target, true, 400)).toMatchObject({ attempts: 2, solved: 1, efficient: 1, streak: 0 });
});

test("scheduler keeps weak variants in practice and avoids exact repeats", () => {
  const variants = f2lVariants(["f2l-4"], ["FR"], false);
  const key = f2lVariantKey(variants[0]);
  const strong = { attempts: 3, solved: 3, efficient: 3, streak: 3, lastSeen: 1 };
  const weak = { attempts: 3, solved: 0, efficient: 0, streak: 0, lastSeen: 1 };
  expect(pickF2LVariant([], {}, undefined)).toBeUndefined();
  expect(pickF2LVariant([variants[0]], {}, key, () => 0)).toEqual(variants[0]);
  expect(pickF2LVariant(variants, {}, key, () => 0)).not.toEqual(variants[0]);
  const secondKey = f2lVariantKey(variants[1]);
  expect(pickF2LVariant(variants.slice(0, 2), { [key]: strong, [secondKey]: weak }, undefined, () => 0.2)).toEqual(variants[1]);
});
