// Types for the vendored cubejs (index.js beside this file).
/** Kociemba two-phase solver (https://github.com/ldez/cubejs). */
export default class Cube {
  static initSolver(): void;
  /** A random-state scramble. Needs `initSolver` first. */
  static scramble(): string;
  move(alg: string): this;
  isSolved(): boolean;
  /** A solution of at most `maxDepth` face turns (default 22). */
  solve(maxDepth?: number): string;
}
