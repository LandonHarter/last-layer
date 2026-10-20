import { describe, expect, test } from "bun:test";
import type { DrillAttempt, Solve } from "./solves";
import { DRILL_KEY, TIMER_KEY, cleanDrillAttempt, cleanSolve, diffKey, isDataKey, isEmptyOps, type SyncOps } from "./user-data";

const solve = (id: string, ms = 10000): Solve => ({ id, ms, penalty: "none", scramble: "R U", at: 1_700_000_000_000, session: "main" });
const attempt = (id: string, at: number): DrillAttempt => ({ id, ok: true, ms: 900, revealed: false, at });
const diff = (key: string, prev: unknown, cur: unknown) => {
  const ops: SyncOps = { docs: {} };
  diffKey(ops, key, prev, cur);
  return ops;
};

describe("diffKey", () => {
  test("documents are sent whole, and not at all when unchanged", () => {
    const v = { a: 1 };
    expect(isEmptyOps(diff("last-layer:progress:v1", v, v))).toBe(true);
    expect(diff("last-layer:progress:v1", v, { a: 2 }).docs).toEqual({ "last-layer:progress:v1": { a: 2 } });
  });

  test("timer sends only added, changed and removed solves", () => {
    const a = solve("a");
    const b = solve("b");
    const sessions = [{ id: "main", name: "Main" }];
    const prev = { solves: [a, b], sessions, current: "main" };
    const c = solve("c");
    const ops = diff(TIMER_KEY, prev, { solves: [{ ...a, penalty: "+2" }, c], sessions, current: "main" });
    expect(ops.docs).toEqual({});
    expect(ops.solves?.upsert.map((s) => s.id)).toEqual(["a", "c"]);
    expect(ops.solves?.remove).toEqual(["b"]);
  });

  test("timer sends sessions when they change, without solves", () => {
    const solves = [solve("a")];
    const ops = diff(TIMER_KEY, { solves, sessions: [], current: "main" }, { solves, sessions: [{ id: "x", name: "X" }], current: "x" });
    expect(ops.docs[TIMER_KEY]).toEqual({ sessions: [{ id: "x", name: "X" }], current: "x" });
    expect(ops.solves).toBeUndefined();
  });

  test("drill log appends when it grew, replaces when it didn't", () => {
    const one = attempt("pll-t", 1);
    const two = attempt("pll-y", 2);
    expect(diff(DRILL_KEY, [one], [one, two]).drill).toEqual({ clear: false, append: [two] });
    expect(diff(DRILL_KEY, undefined, [one]).drill).toEqual({ clear: false, append: [one] });
    expect(diff(DRILL_KEY, [one, two], []).drill).toEqual({ clear: true, append: [] });
  });
});

describe("checking input", () => {
  test("keys", () => {
    expect(isDataKey("last-layer:progress:v1")).toBe(true);
    expect(isDataKey("theme")).toBe(true);
    expect(isDataKey("last-layer:../x")).toBe(false);
    expect(isDataKey("other")).toBe(false);
  });

  test("solves and drill answers", () => {
    expect(cleanSolve({ ...solve("a"), penalty: "bogus", oll: "" })).toEqual({ ...solve("a"), inspectionMs: undefined, oll: undefined, pll: undefined });
    expect(cleanSolve({ id: "a", ms: -1, at: 1, session: "main" })).toBeNull();
    expect(cleanDrillAttempt({ id: "pll-t", ok: "yes", ms: 1, at: 1 })).toBeNull();
    expect(cleanDrillAttempt(attempt("pll-t", 5))?.id).toBe("pll-t");
  });
});
