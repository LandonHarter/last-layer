import { expect, test } from "bun:test";
import { blankEntry, type Status } from "./progress";
import { pickNext } from "./scheduler";

const make = (id: string, status: Status, missStreak = 0) => ({ id, entry: { ...blankEntry(), status, missStreak } });

test("in-progress cases come up far more often than learned ones", () => {
  const pool = [make("a", "learning"), make("b", "learning"), make("c", "learning"), make("d", "learned"), make("e", "learned"), make("f", "learned")];
  const counts: Record<string, number> = {};
  const recent: string[] = [];
  for (let i = 0; i < 20000; i++) {
    const id = pickNext(pool, recent)!;
    counts[id] = (counts[id] ?? 0) + 1;
    recent.push(id);
  }
  // Per case, an in-progress alg should come up several times as often.
  const learning = counts.a + counts.b + counts.c;
  const learned = counts.d + counts.e + counts.f;
  expect(learning / learned).toBeGreaterThan(4);
});

test("never repeats the previous case", () => {
  const pool = [make("a", "learning"), make("b", "learned")];
  const recent: string[] = [];
  for (let i = 0; i < 500; i++) {
    const id = pickNext(pool, recent)!;
    expect(id).not.toBe(recent.at(-1));
    recent.push(id);
  }
});

test("a miss streak raises a case's odds", () => {
  const pool = [make("a", "learning", 3), make("b", "learning"), make("c", "learning")];
  const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 5000; i++) counts[pickNext(pool, [])!]++;
  expect(counts.a).toBeGreaterThan(counts.b * 2);
});

test("handles an empty or single-case pool", () => {
  expect(pickNext([], [])).toBeNull();
  expect(pickNext([make("a", "learned")], ["a"])).toBe("a");
});
