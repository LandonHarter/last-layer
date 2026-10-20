/// <reference lib="webworker" />
import Cube from "@/vendor/cubejs";

/**
 * Runs the two-phase solver off the main thread: building its tables takes
 * about a second, and a solve can take a few hundred milliseconds.
 */

export type SolverRequest = { id: number; type: "solve"; moves: string } | { id: number; type: "scramble" };
export type SolverResponse = { id: number; result: string } | { id: number; error: string };

let ready = false;

self.onmessage = (e: MessageEvent<SolverRequest>) => {
  const req = e.data;
  try {
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
