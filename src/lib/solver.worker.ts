/// <reference lib="webworker" />
import Cube from "@/vendor/cubejs";
import { sq1RandomStateScramble } from "./sq1-solver";

/**
 * Runs the solvers off the main thread. The 3x3 two-phase solver takes about a
 * second to build its tables and a few hundred milliseconds to solve; the
 * Square-1 one about half a second to build and up to a second for a scramble.
 * Each builds its tables on its first request.
 */

export type SolverRequest =
  | { id: number; type: "solve"; moves: string }
  | { id: number; type: "scramble" }
  | { id: number; type: "sq1-scramble" };
export type SolverResponse = { id: number; result: string } | { id: number; error: string };

let ready = false;

self.onmessage = (e: MessageEvent<SolverRequest>) => {
  const req = e.data;
  try {
    if (req.type === "sq1-scramble") return post({ id: req.id, result: sq1RandomStateScramble() });
    if (!ready) {
      Cube.initSolver();
      ready = true;
    }
    if (req.type === "scramble") return post({ id: req.id, result: Cube.scramble() });
    const cube = new Cube();
    if (req.moves.trim()) cube.move(req.moves);
    post({ id: req.id, result: cube.isSolved() ? "" : cube.solve() });
  } catch (err) {
    post({ id: req.id, error: err instanceof Error ? err.message : String(err) });
  }
};

const post = (res: SolverResponse) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(res);
