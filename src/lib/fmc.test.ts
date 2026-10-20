import { expect, test } from "bun:test";
import { checkSolution, countMoves, padScramble } from "./fmc";
import { invertAlg } from "./notation";

test("counts moves in each metric", () => {
  expect(countMoves("R U2 M' x Rw")).toEqual({ htm: 5, qtm: 6, stm: 4, etm: 5 });
});

test("a solution is checked on the simulator, rotations allowed", () => {
  const scramble = "R U F' D2 L";
  expect(checkSolution(scramble, invertAlg(scramble))).toEqual({ ok: true, solved: true, moves: 5, slices: false });
  expect(checkSolution(scramble, `${invertAlg(scramble)} x y2`)).toMatchObject({ solved: true, moves: 5 });
  expect(checkSolution(scramble, "R")).toMatchObject({ ok: true, solved: false });
  expect(checkSolution(scramble, "Q")).toMatchObject({ ok: false });
});

test("padding is refused when it would merge with the scramble", () => {
  expect(padScramble("U R D")).toBe("R' U' F U R D R' U' F");
  expect(padScramble("F R D")).toBeNull();
  expect(padScramble("U R L")).toBeNull();
});
