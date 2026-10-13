import type { Notation } from "./notation";

/** Every puzzle with algorithms in the app. */
export type Puzzle = "2x2" | "3x3" | "4x4" | "5x5" | "6x6" | "7x7" | "megaminx";

export const PUZZLES: Puzzle[] = ["2x2", "3x3", "4x4", "5x5", "6x6", "7x7", "megaminx"];

export const PUZZLE_NAMES: Record<Puzzle, string> = {
  "2x2": "2x2",
  "3x3": "3x3",
  "4x4": "4x4",
  "5x5": "5x5",
  "6x6": "6x6",
  "7x7": "7x7",
  megaminx: "Megaminx",
};

/** Cube size for the cubes; the megaminx has none. */
export const CUBE_SIZE: Partial<Record<Puzzle, number>> = { "2x2": 2, "3x3": 3, "4x4": 4, "5x5": 5, "6x6": 6, "7x7": 7 };

export type AlgSet =
  | "F2L"
  | "OLL"
  | "PLL"
  | "2x2-OLL"
  | "2x2-PBL"
  | "4x4-parity"
  | "5x5-edges"
  | "6x6-parity"
  | "7x7-parity"
  | "mega-EO"
  | "mega-CO"
  | "mega-EP"
  | "mega-CP";

type SetInfo = {
  puzzle: Puzzle;
  /** Short name, shown on toggles and next to case names. */
  label: string;
  /** Heading in the Library. */
  title: string;
  /** What the step leaves you with, for the copy on case pages. */
  blurb: string;
};

export const SET_INFO: Record<AlgSet, SetInfo> = {
  F2L: { puzzle: "3x3", label: "F2L", title: "First two layers", blurb: "Pair a corner and edge into the front-right slot." },
  OLL: { puzzle: "3x3", label: "OLL", title: "Orient the last layer", blurb: "Make the top all yellow." },
  PLL: { puzzle: "3x3", label: "PLL", title: "Permute the last layer", blurb: "Move the top pieces into place." },
  "2x2-OLL": {
    puzzle: "2x2",
    label: "OLL",
    title: "Orient the last layer (Ortega)",
    blurb: "With one face done on the bottom, make the top one colour too. The bottom can end up out of order; PBL fixes it.",
  },
  "2x2-PBL": {
    puzzle: "2x2",
    label: "PBL",
    title: "Permute both layers (Ortega)",
    blurb: "With the top and bottom faces done, put both layers in order at once.",
  },
  "4x4-parity": {
    puzzle: "4x4",
    label: "Parity",
    title: "OLL and PLL parity",
    blurb: "Cases that can't happen on a 3x3, left after you reduce the 4x4.",
  },
  "5x5-edges": {
    puzzle: "5x5",
    label: "Edges",
    title: "Last two edges and edge parity",
    blurb: "Fix the last wings while pairing edges, including the parity a 3x3 can't have.",
  },
  "6x6-parity": {
    puzzle: "6x6",
    label: "Parity",
    title: "OLL and PLL parity",
    blurb: "A 6x6 has two rings of wings, and each can have its own parity.",
  },
  "7x7-parity": {
    puzzle: "7x7",
    label: "Parity",
    title: "Edge parity",
    blurb: "A 7x7 has two rings of wings; each can be left flipped after pairing.",
  },
  "mega-EO": { puzzle: "megaminx", label: "EO", title: "Orient the edges", blurb: "First look of four: flip the top edges so they all face up." },
  "mega-CO": { puzzle: "megaminx", label: "CO", title: "Orient the corners", blurb: "Second look: twist the top corners so the whole top is one colour." },
  "mega-EP": { puzzle: "megaminx", label: "EP", title: "Permute the edges", blurb: "Third look: move the top edges into place." },
  "mega-CP": { puzzle: "megaminx", label: "CP", title: "Permute the corners", blurb: "Last look: move the top corners into place." },
};

export const ALL_SETS = Object.keys(SET_INFO) as AlgSet[];

export const setsOf = (puzzle: Puzzle): AlgSet[] => ALL_SETS.filter((s) => SET_INFO[s].puzzle === puzzle);

export const puzzleOf = (set: AlgSet): Puzzle => SET_INFO[set].puzzle;

export const setLabel = (set: AlgSet) => SET_INFO[set].label;

export const notationOf = (set: AlgSet): Notation => (SET_INFO[set].puzzle === "megaminx" ? "megaminx" : "cube");

/** How to hold the puzzle for a setup, written for the setup line. */
export const HOLD: Record<Puzzle, string> = {
  "2x2": "yellow on top, green in front",
  "3x3": "yellow on top, green in front",
  "4x4": "yellow on top, green in front",
  "5x5": "yellow on top, green in front",
  "6x6": "yellow on top, green in front",
  "7x7": "yellow on top, green in front",
  megaminx: "the last-layer face on top",
};

/** Placeholder for the "add your own" field. */
export const EXAMPLE_ALG: Record<Puzzle, string> = {
  "2x2": "R U R' U R U2 R'",
  "3x3": "R U R' U R U2 R'",
  "4x4": "Rw U2 x Rw U2 Rw U2 Rw' U2",
  "5x5": "2R2 B2 U2 2L U2 2R'",
  "6x6": "3R2 B2 U2 3L U2 3R'",
  "7x7": "3R2 B2 U2 3L U2 3R'",
  megaminx: "R U2' R' U' R U' R'",
};

/** The Library headline for each puzzle. */
export const HEADLINES: Record<Puzzle, string> = {
  "2x2": "Ortega for the 2x2: every OLL and PBL case",
  "3x3": "Every F2L, OLL and PLL case, one place to learn them",
  "4x4": "4x4 parity: every case a 3x3 can't have",
  "5x5": "5x5 last edges and edge parity",
  "6x6": "6x6 parity, for both rings of wings",
  "7x7": "7x7 edge parity, for both rings of wings",
  megaminx: "The megaminx last layer in four looks",
};
