"use client";

import { PUZZLES, type Puzzle } from "./puzzles";
import { createStore } from "./store";

/** The puzzle Library, Learn and Drill show. One choice for all three, so switching pages keeps it. */
const puzzleStore = createStore<Puzzle>("last-layer:puzzle:v1", "3x3");

export function usePuzzle(): Puzzle {
  const stored = puzzleStore.use();
  return PUZZLES.includes(stored) ? stored : "3x3";
}

export const getPuzzle = (): Puzzle => (PUZZLES.includes(puzzleStore.read()) ? puzzleStore.read() : "3x3");
export const setPuzzle = (puzzle: Puzzle) => puzzleStore.write(puzzle);
