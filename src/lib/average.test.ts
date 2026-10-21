import { expect, test } from "bun:test";
import { averageAll, lastSolve, parseTimes, parseTypedTime } from "./average";

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

test("parses one time typed into the timer", () => {
  expect(parseTypedTime("12.34")).toEqual({ ms: 12340, penalty: "none" });
  expect(parseTypedTime(" 11:02.5 ")).toEqual({ ms: 662500, penalty: "none" });
  expect(parseTypedTime("1234")).toEqual({ ms: 12340, penalty: "none" });
  expect(parseTypedTime("110234")).toEqual({ ms: 662340, penalty: "none" });
  expect(parseTypedTime("95")).toEqual({ ms: 950, penalty: "none" });
  expect(parseTypedTime("12.34+")).toEqual({ ms: 12340, penalty: "+2" });
  expect(parseTypedTime("dnf")).toEqual({ ms: 0, penalty: "dnf" });
  expect(parseTypedTime("DNF(1:02.34)")).toEqual({ ms: 62340, penalty: "dnf" });
  for (const bad of ["", "0", "abc", "1:75", "17500", "1:2:3", "DNF(x)"]) expect(parseTypedTime(bad)).toBeNull();
});
