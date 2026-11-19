import { applyAlg, solvedCube, type Sticker } from "../cube";
import { invertAlg, parseAlg, simplifyAlg } from "../notation";
import { toFacelets } from "./state";

/**
 * Following a scramble on a smart cube. Every state along the scramble is
 * known (a half turn passes through either quarter), so wherever the cube is,
 * we either know how far through it is, or which turns undo the slip.
 */

export type GuideStatus =
  /** `done` moves of the scramble are made; the next is half made when `half`. */
  | { kind: "on"; done: number; half: boolean }
  /** Off the scramble: these turns get back to `done` moves in. */
  | { kind: "off"; done: number; fix: string }
  | { kind: "scrambled" }
  /** Not on the scramble and we don't know how it got there: solve it (or mark it solved) first. */
  | { kind: "lost" };

export class ScrambleGuide {
  private readonly moves: string[];
  /** Facelets after each prefix, and for half turns, after either quarter. */
  private readonly at = new Map<string, { done: number; half: boolean }>();
  private status: GuideStatus = { kind: "on", done: 0, half: false };
  /** Turns since the cube was last on the scramble. */
  private extra: string[] = [];
  readonly target: string;

  /** `now` is the cube as it is; the scramble starts from solved. */
  constructor(readonly scramble: string, now: Sticker[]) {
    const start = solvedCube();
    this.moves = parseAlg(scramble).map((m) => (m.turns === 2 ? `${m.base}2` : m.turns === 3 ? `${m.base}'` : m.base));
    let state = start;
    this.at.set(toFacelets(state), { done: 0, half: false });
    for (const [i, move] of this.moves.entries()) {
      if (move.endsWith("2")) {
        for (const q of [move[0], `${move[0]}'`]) {
          const key = toFacelets(applyAlg(state, q));
          if (!this.at.has(key)) this.at.set(key, { done: i, half: true });
        }
      }
      state = applyAlg(state, move);
      // Later positions win: a scramble that passes the same state twice is further along.
      this.at.set(toFacelets(state), { done: i + 1, half: false });
    }
    this.target = toFacelets(state);
    const key = toFacelets(now);
    this.status = this.at.has(key) || key === this.target ? this.update(key) : { kind: "lost" };
  }

  get current(): GuideStatus {
    return this.status;
  }

  get length() {
    return this.moves.length;
  }

  /** The cube turned `move` and is now in `state`. */
  turn(move: string, state: Sticker[]): GuideStatus {
    const key = toFacelets(state);
    if (this.at.has(key) || key === this.target) {
      this.extra = [];
      return this.update(key);
    }
    if (this.status.kind === "lost") return this.status;
    this.extra.push(move);
    const done = this.status.kind === "scrambled" ? this.moves.length : this.status.done;
    return (this.status = { kind: "off", done, fix: simplifyAlg(invertAlg(this.extra.join(" "))) });
  }

  private update(key: string): GuideStatus {
    if (key === this.target) return (this.status = { kind: "scrambled" });
    const pos = this.at.get(key)!;
    return (this.status = { kind: "on", ...pos });
  }
}
