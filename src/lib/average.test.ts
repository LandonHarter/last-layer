import { expect, test } from "bun:test";
import { averageAll, lastSolve, parseTimes } from "./average";

test("parses typed times", () => {
  expect(parseTimes("12.34, 1:02.5 DNF (9.99) 10+ x")).toEqual({ times: [12340, 62500, Infinity, 9990, 12000], bad: ["x"] });
});

test("averages like the WCA", () => {
  expect(averageAll([10000, 11000, 12000])).toBe(11000);
  expect(averageAll([10000, 11000, 12000, 13000, 30000])).toBe(12000);
  expect(averageAll([10000, Infinity, Infinity, 13000, 30000])).toBe(Infinity);
});

test("works out the time needed on the last solve", () => {
  // 10, 11, 12, 13: the last solve counts unless it's the best or worst.
  const r = lastSolve([10000, 11000, 12000, 13000], 11500)!;
  expect(r.best).toBe(11000);
  expect(r.worst).toBe(12000);
  expect(r.needed).toBe(11500);
  expect(lastSolve([10000, 11000, 12000, 13000], 12500)!.needed).toBe(Infinity);
  expect(lastSolve([10000, 11000, 12000, 13000], 10000)!.needed).toBeNull();
});
