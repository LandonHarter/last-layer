import { expect, test } from "bun:test";
import { applyAlg, isSolved, solvedCube } from "./cube";
import { invertAlg } from "./notation";
import { randomScramble, scrambledNet } from "./scramble";
import {
  averageOf,
  bestAverage,
  DNF,
  linearRegression,
  normalCdf,
  normalQuantile,
  outlierMask,
  shapiroWilk,
  tCdf,
  welchTTest,
} from "./stats";

test("ao5 drops the best and worst", () => {
  expect(averageOf([10, 12, 11, 30, 9], 5)).toBeCloseTo(11, 10);
});

test("one DNF in an ao5 counts as the worst, two make it a DNF", () => {
  expect(averageOf([10, 12, 11, DNF, 9], 5)).toBeCloseTo(11, 10);
  expect(averageOf([10, DNF, 11, DNF, 9], 5)).toBe(DNF);
});

test("ao12 drops one from each end, ao100 drops five", () => {
  const twelve = [5, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 50];
  expect(averageOf(twelve, 12)).toBeCloseTo(10, 10);
  const hundred = [...Array(95).fill(10), 1, 1, 1, 1, 1];
  expect(averageOf(hundred, 100)).toBeCloseTo((90 * 10) / 90, 10);
});

test("mo3 does not trim and any DNF is a DNF", () => {
  expect(averageOf([1, 2, 6], 3)).toBeCloseTo(3, 10);
  expect(averageOf([1, 2, DNF], 3)).toBe(DNF);
});

test("best average finds the lowest window", () => {
  const times = [20, 20, 20, 20, 20, 10, 10, 10, 10, 10, 20];
  // The first window whose trimmed mean is 10 already includes one 20, which gets dropped.
  expect(bestAverage(times, 5)).toEqual({ value: 10, end: 8 });
});

test("normal helpers are consistent", () => {
  expect(normalCdf(0)).toBeCloseTo(0.5, 6);
  expect(normalCdf(1.96)).toBeCloseTo(0.975, 4);
  expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5);
  expect(tCdf(2.228, 10)).toBeCloseTo(0.975, 3);
});

test("Shapiro-Wilk matches R for 1:10", () => {
  const r = shapiroWilk([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])!;
  expect(r.w).toBeCloseTo(0.97016, 4);
  expect(r.p).toBeCloseTo(0.8924, 3);
});

test("regression finds a known slope", () => {
  const xs = [0, 1, 2, 3, 4, 5];
  const r = linearRegression(xs, xs.map((x) => 3 - 0.5 * x + (x % 2 ? 0.01 : -0.01)))!;
  expect(r.slope).toBeCloseTo(-0.5, 2);
  expect(r.p).toBeLessThan(0.001);
});

test("Welch t-test sees a clear difference", () => {
  const r = welchTTest([10, 11, 12, 11, 10, 12], [14, 15, 16, 15, 14, 16])!;
  expect(r.diff).toBeCloseTo(-4, 10);
  expect(r.p).toBeLessThan(0.001);
});

test("IQR filter drops a far outlier", () => {
  const mask = outlierMask([10, 11, 12, 11, 10, 12, 60], { kind: "iqr", k: 1.5 });
  expect(mask).toEqual([true, true, true, true, true, true, false]);
});

test("scrambles never repeat a face or cancel on an axis", () => {
  for (let i = 0; i < 200; i++) {
    const faces = randomScramble().split(" ").map((m) => m[0]);
    expect(faces.length).toBe(20);
    faces.forEach((f, j) => {
      expect(f).not.toBe(faces[j - 1]);
      if (j >= 2) expect(f === faces[j - 2] && "UDRLFB".indexOf(f) >> 1 === "UDRLFB".indexOf(faces[j - 1]) >> 1).toBe(false);
    });
  }
});

test("scramble then its inverse is solved, and the net shows a solved cube for no moves", () => {
  const s = randomScramble();
  expect(isSolved(applyAlg(applyAlg(solvedCube(), s), invertAlg(s)))).toBe(true);
  const net = scrambledNet("");
  for (const face of Object.keys(net) as (keyof typeof net)[]) expect(net[face].every((c) => c === face)).toBe(true);
  // R turns the F face's right column to D's colour.
  expect(scrambledNet("R").F).toEqual(["F", "F", "D", "F", "F", "D", "F", "F", "D"]);
});
