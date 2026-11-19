import { describe, expect, test } from "bun:test";
import type { Solve } from "../solves";
import { buildTimeline, clockAt } from "./timeline";

const solve = (extra: Partial<Solve> = {}): Solve => ({ id: "s", ms: 10000, penalty: "none", scramble: "R U", at: 0, session: "main", ...extra });

describe("buildTimeline", () => {
  test("hold, solve and tail without inspection", () => {
    const tl = buildTimeline(solve(), 11000, 14000);
    expect(tl.clockStart).toBe(1000);
    expect(tl.inspectStart).toBeNull();
    expect(tl.segments.map((s) => [s.kind, s.from, s.to])).toEqual([
      ["ready", 0, 1000],
      ["solve", 1000, 11000],
      ["after", 11000, 14000],
    ]);
  });

  test("inspection sits before the clock starts", () => {
    const tl = buildTimeline(solve({ inspectionMs: 8000 }), 18200, 21200);
    expect(tl.inspectStart).toBe(200);
    expect(tl.segments.map((s) => s.kind)).toEqual(["ready", "inspection", "solve", "after"]);
  });

  test("without a stop offset, the tail is assumed", () => {
    const tl = buildTimeline(solve(), null, 15000, 3000);
    expect(tl.stop).toBe(12000);
    expect(tl.clockStart).toBe(2000);
  });

  test("smart cube solves split into steps", () => {
    // Sexy move scramble undone: R U, then U' R' solves it.
    const s = solve({ ms: 600, scramble: "R U", moves: "U'/0 R'/600" });
    const tl = buildTimeline(s, 1600, 2600);
    const steps = tl.segments.filter((x) => ["cross", "f2l", "oll", "pll"].includes(x.kind));
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.at(-1)!.to).toBe(1600);
    for (const st of steps) expect(st.recogTo! >= st.from && st.recogTo! <= st.to).toBe(true);
  });
});

describe("clockAt", () => {
  const s = solve({ inspectionMs: 16000, penalty: "+2" });
  const tl = buildTimeline(s, 26000, 29000);
  test("counts inspection down, then runs, then holds the result", () => {
    expect(clockAt(tl, s, 0).text).toBe("15");
    expect(clockAt(tl, s, 9000).tone).toBe("inspect-late");
    expect(clockAt(tl, s, 15500)).toMatchObject({ text: "+2", tone: "inspect-over" });
    expect(clockAt(tl, s, 16000 + 1234)).toMatchObject({ text: "1.23", tone: "running" });
    expect(clockAt(tl, s, 27000)).toMatchObject({ text: "12.00+", tone: "done" });
  });
});
