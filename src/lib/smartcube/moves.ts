import { moveCount, simplifyAlg } from "../notation";

/**
 * Turns recorded from a smart cube. A solve keeps them as text, "R/0 U'/112 F2/240",
 * each turn with its time in ms from the first turn. The cube reports quarter
 * turns; a half turn is two quarters close together, merged when recorded.
 */

export type TimedMove = { move: string; t: number };

/** A turn as the cube reported it: host clock time, and the cube's own clock when it has one. */
export type RawMove = { move: string; local: number; cube: number | null };

const MOVE_RE = /^([URFDLB])(['2]?)\/(\d+)$/;

export function encodeMoves(moves: TimedMove[]): string {
  return moves.map((m) => `${m.move}/${Math.max(0, Math.round(m.t))}`).join(" ");
}

export function decodeMoves(text: string | undefined): TimedMove[] {
  if (!text) return [];
  const out: TimedMove[] = [];
  for (const token of text.split(" ")) {
    const m = MOVE_RE.exec(token);
    if (m) out.push({ move: m[1] + m[2], t: Number(m[3]) });
  }
  return out;
}

/**
 * Times from the cube's clock where every turn has one, fitted to the host
 * clock by least squares (cube clocks drift a little); else the host times.
 * Returned times are host-clock ms.
 */
export function fitTimes(raw: RawMove[]): number[] {
  const n = raw.length;
  if (n < 2 || raw.some((m) => m.cube === null)) return raw.map((m) => m.local);
  const xs = raw.map((m) => m.cube as number);
  const ys = raw.map((m) => m.local);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const slope = sxx ? sxy / sxx : 1;
  // A wild slope means the clocks don't agree; trust the host.
  if (!(slope > 0.9 && slope < 1.1)) return ys;
  return xs.map((x) => my + slope * (x - mx));
}

/**
 * Quarter turns into timed moves from the first turn: two quarter turns of one
 * face within `mergeMs` become a half turn, and a turn straight back cancels.
 */
export function mergeQuarterTurns(moves: TimedMove[], mergeMs = 250): TimedMove[] {
  const out: (TimedMove & { q: number })[] = [];
  for (const m of moves) {
    const q = m.move.endsWith("2") ? 2 : m.move.endsWith("'") ? 3 : 1;
    const last = out.at(-1);
    if (last && last.move[0] === m.move[0] && m.t - last.t <= mergeMs && last.q !== 2 && q !== 2) {
      const turns = (last.q + q) % 4;
      if (turns === 2) {
        last.q = 2;
        last.move = `${m.move[0]}2`;
        last.t = m.t;
        continue;
      }
    }
    out.push({ ...m, q });
  }
  return out.map(({ move, t }) => ({ move, t }));
}

/** Turns made, with neighbouring turns of one face merged (HTM). */
export function htm(moves: string[]): number {
  return moves.length ? moveCount(simplifyAlg(moves.join(" "))) : 0;
}
