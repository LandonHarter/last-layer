import { caseState, engineFor, type CaseLike } from "../cases";
import { parseAlg } from "../notation";
import { htm } from "./moves";

/**
 * Answering a drill case by turning a smart cube. The cube can be in any state:
 * its turns go to a virtual copy of the case as pictured, so the case is solved
 * when the virtual copy is. Turns are in the grip's frame (`gripMap`), and every
 * alg ends with the centres home, so slice and wide moves (which the cube
 * reports as turns of the two outer faces) come out right.
 */

/** Turns allowed beyond the main alg (in quarter turns of outer faces) before it counts as missed. */
export const EXTRA_TURNS = 4;
/** A pause this long once you've started turning counts as missed. */
export const PAUSE_MS = 2500;
/** Turns this soon after a case appears belong to the last one (finishing a turn, a stray AUF). */
export const IGNORE_MS = 300;

/** The quarter turns of outer faces a smart cube reports for an alg. Slices turn two faces; rotations none. */
export function reportedTurns(alg: string): number {
  let n = 0;
  for (const m of parseAlg(alg)) {
    const quarters = m.turns === 2 ? 2 : 1;
    if (/^[xyz]/.test(m.base)) continue;
    n += /^[MES]$/.test(m.base) ? 2 * quarters : quarters;
  }
  return n;
}

export type AttemptResult = { ok: boolean; recogMs: number; execMs: number; moveCount: number; moves: string[] };

export class CaseAttempt {
  private state: unknown;
  private readonly engine;
  private readonly limit: number;
  readonly moves: string[] = [];
  private first: number | null = null;
  private last = 0;
  result: AttemptResult | null = null;

  constructor(c: CaseLike, main: string, readonly shownAt: number) {
    this.engine = engineFor(c);
    this.state = caseState(c);
    this.limit = reportedTurns(main) + EXTRA_TURNS;
  }

  /** Feed one turn (grip frame, "R'"). Returns the result once the attempt is over. */
  turn(move: string, at: number): AttemptResult | null {
    if (this.result) return this.result;
    if (this.first === null && at - this.shownAt < IGNORE_MS) return null;
    if (this.first === null) this.first = at;
    this.last = at;
    this.moves.push(move);
    this.state = this.engine.apply(this.state, move);
    if (this.solved()) return this.finish(true, at);
    if (this.moves.length >= this.limit) return this.finish(false, at);
    return null;
  }

  /** Call now and then: a long pause after turning has started ends the attempt as missed. */
  tick(now: number): AttemptResult | null {
    if (this.result || this.first === null || now - this.last < PAUSE_MS) return this.result;
    return this.finish(false, this.last);
  }

  get started() {
    return this.first !== null;
  }

  /** End it now (a key or button), as missed or not. */
  giveUp(now: number, ok = false): AttemptResult {
    return this.result ?? this.finish(ok, this.first === null ? now : this.last);
  }

  private solved(): boolean {
    const { engine, state } = this;
    return engine.after.some((a) => engine.done(a ? engine.apply(state, a) : state));
  }

  private finish(ok: boolean, end: number): AttemptResult {
    const first = this.first ?? end;
    this.result = { ok, recogMs: Math.max(0, first - this.shownAt), execMs: Math.max(0, end - first), moveCount: htm(this.moves), moves: [...this.moves] };
    return this.result;
  }
}
