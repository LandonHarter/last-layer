import { describe, expect, test } from "bun:test";
import { dailyBadges, dailyRuns, dailyStreak, dailyTrend, dayKey, dayStart, shiftDay, todayRun } from "./daily";
import type { Penalty, Solve } from "./solves";

let n = 0;
/** A solve at `hour` o'clock local time on the day `day`. */
const solve = (day: string, ms: number, opts: { hour?: number; daily?: number; penalty?: Penalty; session?: string } = {}): Solve => ({
  id: `s${n++}`,
  ms,
  penalty: opts.penalty ?? "none",
  scramble: "",
  at: dayStart(day) + (opts.hour ?? 12) * 3600000 + n,
  session: opts.session ?? "main",
  daily: "daily" in opts ? opts.daily : 5,
});
/** A finished ao5 on a day whose average is `avg`. */
const ao5 = (day: string, avg: number) => [avg - 1000, avg, avg, avg, avg + 1000].map((ms) => solve(day, ms));

describe("days", () => {
  test("day keys are local calendar days", () => {
    const start = dayStart("2026-10-22");
    expect(dayKey(start)).toBe("2026-10-22");
    expect(dayKey(start - 1)).toBe("2026-10-21");
    expect(dayKey(start + 86400000 - 1)).toBe("2026-10-22");
  });

  test("shifting crosses months and years", () => {
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("dailyRuns", () => {
  test("groups tagged solves by day and session, ignoring untagged ones", () => {
    const solves = [...ao5("2026-10-20", 10000), solve("2026-10-20", 1, { daily: undefined }), solve("2026-10-20", 1, { session: "other" }), ...ao5("2026-10-21", 9000)];
    const runs = dailyRuns(solves, "main");
    expect(runs.map((r) => r.day)).toEqual(["2026-10-20", "2026-10-21"]);
    expect(runs[0].average).toBeCloseTo(10000, 6);
    expect(runs[1].average).toBeCloseTo(9000, 6);
  });

  test("penalties count, and extra solves past the size are left out", () => {
    const day = "2026-10-20";
    const solves = [solve(day, 10000), solve(day, 10000, { penalty: "+2" }), solve(day, 10000), solve(day, 10000), solve(day, 10000, { penalty: "dnf" }), solve(day, 1)];
    const [run] = dailyRuns(solves, "main");
    expect(run.solves).toHaveLength(5);
    // Drops the 10.00 and the DNF: (10 + 10 + 12) / 3.
    expect(run.average).toBeCloseTo(32000 / 3, 6);
  });

  test("a run that isn't finished has no average yet", () => {
    const day = "2026-10-20";
    const [run] = dailyRuns([solve(day, 10000), solve(day, 12000)], "main");
    expect(run.done).toBe(false);
    expect(run.average).toBeNull();
    expect(run.soFar).toBeCloseTo(11000, 6);
  });

  test("today's run", () => {
    const runs = dailyRuns(ao5("2026-10-22", 10000), "main");
    expect(todayRun(runs, dayStart("2026-10-22") + 3600000)?.day).toBe("2026-10-22");
    expect(todayRun(runs, dayStart("2026-10-23"))).toBeNull();
  });
});

describe("dailyStreak", () => {
  const runs = dailyRuns([...ao5("2026-10-18", 10000), ...ao5("2026-10-20", 10000), ...ao5("2026-10-21", 10000)], "main");

  test("counts back from yesterday while today isn't done", () => {
    expect(dailyStreak(runs, dayStart("2026-10-22") + 3600000)).toBe(2);
  });

  test("a missed day ends it", () => {
    expect(dailyStreak(runs, dayStart("2026-10-24"))).toBe(0);
  });

  test("today counts once it's done", () => {
    const more = dailyRuns([...runs.flatMap((r) => r.solves), ...ao5("2026-10-22", 10000)], "main");
    expect(dailyStreak(more, dayStart("2026-10-22") + 3600000)).toBe(3);
  });
});

describe("trend and badges", () => {
  const runs = dailyRuns([...ao5("2026-10-01", 20000), ...ao5("2026-10-08", 19000), ...ao5("2026-10-15", 18000)], "main");

  test("change per week from the dates, not the solve count", () => {
    const trend = dailyTrend(runs)!;
    expect(trend.perWeek).toBeCloseTo(-1000, 0);
    expect(trend.projected).toBeLessThan(18000);
  });

  test("needs three dailies", () => {
    expect(dailyTrend(runs.slice(0, 2))).toBeNull();
  });

  test("best daily and change from the one before", () => {
    const b = dailyBadges(runs)!;
    expect(b.isBest).toBe(true);
    expect(b.change).toBeCloseTo(-1000, 6);
    const slower = dailyBadges(dailyRuns([...runs.flatMap((r) => r.solves), ...ao5("2026-10-16", 19500)], "main"))!;
    expect(slower.isBest).toBe(false);
    expect(slower.change).toBeCloseTo(1500, 6);
  });
});
