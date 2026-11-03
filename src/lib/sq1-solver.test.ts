import { expect, test } from "bun:test";
import { sliceCount, sq1Apply, sq1Broken, sq1IsSolved, sq1Solved } from "./sq1";
import { randomSq1State, solveSq1, sq1RandomStateScramble } from "./sq1-solver";

/** A small seeded generator, so a failure can be replayed. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

test("random Square-1 positions solve, with no blocked slice", () => {
  const random = seeded(7);
  for (let i = 0; i < 40; i++) {
    const state = randomSq1State(random);
    const solution = solveSq1(state);
    const end = sq1Apply(state, solution);
    expect(sq1Broken(end)).toBe(false);
    expect(sq1IsSolved(end)).toBe(true);
    // Two-phase solutions run about 13 slices; random moves needed 20.
    expect(sliceCount(solution)).toBeLessThanOrEqual(17);
  }
}, 60_000);

test("a random-state scramble reaches the position it was made for", () => {
  // Same seed, same position: the scramble is the inverse of its solution.
  const state = randomSq1State(seeded(3));
  const scramble = sq1RandomStateScramble(seeded(3));
  const reached = sq1Apply(sq1Solved(), scramble);
  expect(sq1Broken(reached)).toBe(false);
  expect(Array.from(reached)).toEqual(Array.from(state));
});

test("random positions cover both middle layers and many shapes", () => {
  const random = seeded(11);
  const middles = new Set<number>();
  const shapes = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const s = randomSq1State(random);
    middles.add(s[24]);
    shapes.add(Array.from(s.slice(0, 24), (v) => (v >> 1 < 8 ? "c" : "e")).join(""));
  }
  expect(middles.size).toBe(2);
  expect(shapes.size).toBeGreaterThan(150);
});

test("solved needs no moves", () => {
  expect(solveSq1(sq1Solved())).toBe("");
});
