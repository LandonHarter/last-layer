import { describe, expect, test } from "bun:test";
import { dayStart } from "./daily";
import { formatDuration, GAP_MS, practiceDays, practiceStretches, practiceSummary } from "./practice";

const MIN = 60000;
const base = dayStart("2026-10-22") + 12 * 3600000;
/** A solve that finished at `at` and took `ms`. */
const solve = (at: number, ms = 10000, inspectionMs?: number) => ({ at, ms, inspectionMs });

describe("stretches", () => {
  test("a lone solve lasts as long as the solve", () => {
    const [s] = practiceStretches([solve(base, 12000)]);
    expect(s.end - s.start).toBe(12000);
    expect(s.solves).toBe(1);
  });

  test("runs from the start of the first solve (with inspection) to the end of the last", () => {
    const [s] = practiceStretches([solve(base, 10000, 8000), solve(base + MIN), solve(base + 2 * MIN)]);
    expect(s.start).toBe(base - 18000);
    expect(s.end).toBe(base + 2 * MIN);
    expect(s.solvingMs).toBe(30000);
  });

  test("a break of exactly 5 minutes joins, a millisecond more splits", () => {
    const joined = practiceStretches([solve(base), solve(base + GAP_MS + 10000)]);
    expect(joined).toHaveLength(1);
    const split = practiceStretches([solve(base), solve(base + GAP_MS + 10001)]);
    expect(split).toHaveLength(2);
  });

  test("order of input doesn't matter", () => {
    const a = practiceStretches([solve(base + 2 * MIN), solve(base), solve(base + MIN)]);
    expect(a).toHaveLength(1);
    expect(a[0].solves).toBe(3);
  });
});

describe("days", () => {
  test("a stretch over midnight is split between both days", () => {
    const midnight = dayStart("2026-10-23");
    const stretches = practiceStretches([solve(midnight - 10 * MIN, 10000), solve(midnight - 5 * MIN), solve(midnight), solve(midnight + 4 * MIN)]);
    expect(stretches).toHaveLength(1);
    const days = practiceDays(stretches);
    expect(days.map((d) => d.day)).toEqual(["2026-10-22", "2026-10-23"]);
    expect(days[0].ms).toBe(10 * MIN + 10000);
    expect(days[1].ms).toBe(4 * MIN);
    expect(days[0].ms + days[1].ms).toBe(stretches[0].end - stretches[0].start);
  });

  test("summary totals and streak", () => {
    const day = 86400000;
    const stretches = practiceStretches([solve(base - 2 * day, 60000), solve(base - day, 60000), solve(base, 60000), solve(base - 10 * day, 60000)]);
    const days = practiceDays(stretches);
    const sum = practiceSummary(days, stretches, base);
    expect(sum.today).toBe(MIN);
    expect(sum.week).toBe(3 * MIN);
    expect(sum.month).toBe(4 * MIN);
    expect(sum.total).toBe(4 * MIN);
    expect(sum.streak).toBe(3);
    expect(sum.onClock).toBe(1);
    // A day not over yet doesn't break the streak.
    expect(practiceSummary(days, stretches, base + day).streak).toBe(3);
  });
});

test("durations read naturally", () => {
  expect(formatDuration(45000)).toBe("45 s");
  expect(formatDuration(8 * MIN)).toBe("8 min");
  expect(formatDuration(72 * MIN)).toBe("1 h 12 min");
  expect(formatDuration(120 * MIN)).toBe("2 h");
});
