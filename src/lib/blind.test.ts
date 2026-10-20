import { expect, test } from "bun:test";
import { applyAlg, solvedCube } from "./cube";
import { DEFAULT_BLIND, memoFor, netCell, orientationMoves, pairUp } from "./blind";
import { randomScramble } from "./scramble";

test("a solved cube has nothing to memo", () => {
  const memo = memoFor("", DEFAULT_BLIND);
  expect(memo.edges).toEqual([]);
  expect(memo.corners).toEqual([]);
  expect(memo.parity).toBe(false);
});

test("U cycles the top pieces from the buffer", () => {
  // UF holds UR's edge, UFR holds UBR's corner.
  expect(memoFor("U", DEFAULT_BLIND).edges.join("")).toBe("BAD");
  expect(memoFor("U", DEFAULT_BLIND).corners.join("")).toBe("BAD");
  expect(memoFor("U", DEFAULT_BLIND).parity).toBe(true);
});

test("a flipped edge and a twisted corner show up as a break into them", () => {
  // Flips UF and UB: the buffer holds itself, so break into UB (A) and come back on its other sticker (Q).
  const flip = "M' U M' U M' U M' U2 M' U M' U M' U M'";
  expect(memoFor(flip, DEFAULT_BLIND).edges.join("")).toBe("AQ");
  expect(memoFor(flip, DEFAULT_BLIND).corners).toEqual([]);
});

test("edge and corner targets always share parity, and the memo ends", () => {
  for (let i = 0; i < 100; i++) {
    const memo = memoFor(randomScramble(), { ...DEFAULT_BLIND, top: "yellow", front: "red" });
    expect(memo.edges.length % 2).toBe(memo.corners.length % 2);
    expect(memo.edges.length).toBeLessThanOrEqual(18);
    expect(memo.corners.length).toBeLessThanOrEqual(12);
  }
});

test("orientation and net helpers", () => {
  expect(orientationMoves("white", "green")).toBe("");
  const s = applyAlg(solvedCube(), orientationMoves("yellow", "green"));
  expect(s.length).toBe(54);
  expect(netCell("UB")).toEqual({ face: "U", row: 0, col: 1 });
  expect(netCell("DFR")).toEqual({ face: "D", row: 0, col: 2 });
  expect(pairUp(["A", "B", "C"])).toBe("AB C");
});
