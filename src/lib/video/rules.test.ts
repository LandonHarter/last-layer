import { describe, expect, test } from "bun:test";
import type { Penalty, Solve } from "../solves";
import { autoSave } from "./rules";

const solve = (id: string, ms: number, penalty: Penalty = "none"): Solve => ({ id, ms, penalty, scramble: "", at: 0, session: "main" });
const rule = (videoSave: "none" | "all" | "under" | "top" | "pb", extra = {}) => ({ videoSave, videoUnderMs: 10000, videoTopN: 2, ...extra });

describe("autoSave", () => {
  const old = [solve("a", 9000), solve("b", 11000), solve("c", 12000)];

  test("none and all", () => {
    const s = solve("n", 20000, "dnf");
    expect(autoSave(rule("none"), solve("n", 1000), [...old, solve("n", 1000)])).toBe(false);
    expect(autoSave(rule("all"), s, [...old, s])).toBe(true);
  });

  test("under counts the penalty", () => {
    const fast = solve("n", 9500);
    const plus2 = solve("n", 9500, "+2");
    expect(autoSave(rule("under"), fast, [...old, fast])).toBe(true);
    expect(autoSave(rule("under"), plus2, [...old, plus2])).toBe(false);
  });

  test("top N in the session", () => {
    const second = solve("n", 10000);
    const third = solve("n", 11500);
    const tie = solve("n", 11000);
    expect(autoSave(rule("top"), second, [...old, second])).toBe(true);
    expect(autoSave(rule("top"), third, [...old, third])).toBe(false);
    expect(autoSave(rule("top"), tie, [...old, tie])).toBe(true);
    expect(autoSave(rule("top"), second, [second])).toBe(true);
  });

  test("pb must beat every other solve", () => {
    const pb = solve("n", 8999);
    const tie = solve("n", 9000);
    expect(autoSave(rule("pb"), pb, [...old, pb])).toBe(true);
    expect(autoSave(rule("pb"), tie, [...old, tie])).toBe(false);
    expect(autoSave(rule("pb"), pb, [pb])).toBe(true);
  });

  test("a DNF is never saved by a rule", () => {
    const dnf = solve("n", 5000, "dnf");
    for (const r of ["under", "top", "pb"] as const) expect(autoSave(rule(r), dnf, [dnf])).toBe(false);
  });
});
