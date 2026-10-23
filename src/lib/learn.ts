import { ALGS, ALGS_BY_ID, GROUPS, type Alg, type AlgSet } from "@/data/algs";
import { createStore } from "./store";

/** Clean recalls in a row, with no peeking, before a case counts as solid. */
export const SOLID = 3;

export type Stage = "pick" | "study" | "recall";
export type LearnCase = { stage: Stage; streak: number };

export type LearnData = {
  set: AlgSet;
  size: number;
  /** The batch you're on for each set, in the order you learn it. */
  batch: Partial<Record<AlgSet, string[]>>;
  cases: Record<string, LearnCase>;
};

const learnStore = createStore<LearnData>("last-layer:learn:v1", { set: "PLL", size: 4, batch: {}, cases: {} });
export const useLearn = learnStore.use;
export const getLearn = learnStore.read;
export const updateLearn = learnStore.update;

export const learnCase = (data: LearnData, id: string): LearnCase => data.cases[id] ?? { stage: "pick", streak: 0 };

export function setCase(id: string, change: Partial<LearnCase>) {
  updateLearn((d) => ({ ...d, cases: { ...d.cases, [id]: { ...learnCase(d, id), ...change } } }));
}

/** Record a recall: a clean one adds to the streak, a miss starts it again. */
export function recordRecall(id: string, ok: boolean) {
  updateLearn((d) => {
    const c = learnCase(d, id);
    return { ...d, cases: { ...d.cases, [id]: { ...c, streak: ok ? c.streak + 1 : 0 } } };
  });
}

export const isSolid = (c: LearnCase) => c.stage === "recall" && c.streak >= SOLID;

// ---------------------------------------------------------------------------
// Suggested order

type Cluster = { ids: string[]; why: string };

const byGroup = (set: AlgSet, groups: string[], why: (group: string) => string): Cluster[] =>
  groups.map((g) => ({ ids: ALGS.filter((a) => a.set === set && a.group === g).map((a) => a.id), why: why(g) }));

/** One cluster per group, in the set's own order. */
const groupsOf = (set: AlgSet, why: (group: string) => string): Cluster[] => byGroup(set, GROUPS[set], why);

// Cases that belong together, easiest first. Batches never mix two clusters
// unless both fit whole.
const CLUSTERS: Record<AlgSet, Cluster[]> = {
  "2x2-OLL": [
    { ids: ["2x2-oll-sune", "2x2-oll-antisune"], why: "Sune and Antisune: the same triggers, and the ones you'll see most" },
    { ids: ["2x2-oll-u", "2x2-oll-t", "2x2-oll-l"], why: "Two corners oriented: tell them apart by where the yellow stickers point" },
    { ids: ["2x2-oll-h", "2x2-oll-pi"], why: "No corners oriented: H has two pairs of headlights, Pi one" },
  ],
  "2x2-PBL": [
    { ids: ["2x2-pbl-adj-top", "2x2-pbl-diag-top"], why: "Top layer only: the 3x3 T and Y perms work here" },
    { ids: ["2x2-pbl-diag-diag", "2x2-pbl-adj-adj"], why: "The same swap on both layers: short and easy to spot" },
    { ids: ["2x2-pbl-adj-diag", "2x2-pbl-diag-adj"], why: "One adjacent and one diagonal swap: a pair to learn side by side" },
    { ids: ["2x2-pbl-adj-bottom", "2x2-pbl-diag-bottom"], why: "Bottom layer only: the top is solved, so check the bottom before you start" },
  ],
  "4x4-parity": [
    { ids: ["4x4-oll-parity", "4x4-pll-opp", "4x4-pll-adj"], why: "The parities you meet in most solves: one flipped edge, or two edges swapped" },
    { ids: ["4x4-pll-oa", "4x4-pll-ob"], why: "Four edges cycling: a mirror pair" },
    { ids: ["4x4-pll-adj-corners", "4x4-pll-diag-corners"], why: "Two corners swapped: rarer, and you can also fix them with PLL parity and a 3x3 PLL" },
  ],
  "5x5-edges": groupsOf("5x5-edges", (g) => (g === "Parity" ? "Edge parity: the wing swaps a 3x3 can't have" : "Wing swaps without parity")),
  "6x6-parity": groupsOf("6x6-parity", (g) => `${g}: the same alg for each ring of wings, turning a different slice`),
  "7x7-parity": groupsOf("7x7-parity", () => "One alg for both rings of wings: only the slice changes"),
  "mega-EO": groupsOf("mega-EO", (g) => `${g}: built on F sexy F'`),
  "mega-CO": groupsOf("mega-CO", (g) => `${g}: mostly Sune shapes, learned side by side`),
  "mega-EP": groupsOf("mega-EP", (g) => `${g} of edges`),
  "mega-CP": groupsOf("mega-CP", (g) => `${g} of corners`),
  "sq1-CS": groupsOf("sq1-CS", (g) => `${g} to a cube: the same depth, so learn them side by side`),
  "sq1-CO": groupsOf("sq1-CO", () => "Short, and built on (1,0) / (-1,0): spot how many corners are on the wrong layer"),
  "sq1-EO": groupsOf("sq1-EO", () => "Edges to their own layer: like CO, but the edges move"),
  "sq1-CP": groupsOf("sq1-CP", (g) => `${g}: adjacent and opposite swaps, all in (3,0) turns`),
  "sq1-EP": groupsOf("sq1-EP", (g) => (g === "One layer" ? "One layer only: the 3x3 U, H and Z perms" : `${g}: name each layer, then put the pair together`)),
  "sq1-parity": groupsOf("sq1-parity", () => "Parity: learn the adjacent swap first, it fixes any parity case with an EP after it"),
  PLL: [
    { ids: ["pll-ua", "pll-ub", "pll-h", "pll-z"], why: "Edges only: short M-slice algorithms and easy to spot" },
    { ids: ["pll-t", "pll-jb", "pll-ja", "pll-y"], why: "Built from the sexy move and sledgehammer, and used all the time" },
    { ids: ["pll-aa", "pll-ab", "pll-e"], why: "Corners only: the same held-sideways shape" },
    { ids: ["pll-ra", "pll-rb", "pll-f", "pll-v"], why: "Longer swaps that reuse the triggers you know" },
    { ids: ["pll-na", "pll-nb"], why: "A mirror pair: learn one, then its reflection" },
    { ids: ["pll-ga", "pll-gb", "pll-gc", "pll-gd"], why: "G perms: two pairs that undo each other" },
  ],
  OLL: [
    { ids: ["oll-27", "oll-26", "oll-21", "oll-22", "oll-23", "oll-24", "oll-25"], why: "Cross: Sune and Antisune, then the rest of the edges-done cases" },
    ...byGroup(
      "OLL",
      [
        "T shape",
        "Corners oriented",
        "Square",
        "C shape",
        "P shape",
        "Fish",
        "Small lightning bolt",
        "W shape",
        "Big lightning bolt",
        "Awkward",
        "Knight move",
        "I shape",
        "Small L",
        "Dot",
      ],
      (g) => `${g}: the same shape, so you learn to tell them apart side by side`,
    ),
  ],
  F2L: byGroup(
    "F2L",
    ["White facing side", "White facing up", "Corner in slot", "Edge in slot", "Both in slot"],
    (g) => `${g}: pieces sit the same way, so the moves rhyme`,
  ),
};

export type Batch = { ids: string[]; why: string[] };

/** Split a list into `parts` runs of near-equal length, in order. */
function evenSplit<T>(list: T[], parts: number): T[][] {
  const out: T[][] = [];
  let start = 0;
  for (let p = 0; p < parts; p++) {
    const end = start + Math.round((list.length - start) / (parts - p));
    out.push(list.slice(start, end));
    start = end;
  }
  return out;
}

/**
 * Batches of about `size` cases to learn in order, skipping `skip` (cases
 * you've learned). Each cluster is split evenly when it's too big, and small
 * pieces share a batch when they fit.
 */
export function planBatches(set: AlgSet, size: number, skip: (id: string) => boolean = () => false): Batch[] {
  const batches: Batch[] = [];
  let current: Batch = { ids: [], why: [] };
  for (const cluster of CLUSTERS[set]) {
    const ids = cluster.ids.filter((id) => !skip(id));
    if (!ids.length) continue;
    for (const piece of evenSplit(ids, Math.ceil(ids.length / size))) {
      if (current.ids.length && current.ids.length + piece.length > size) {
        batches.push(current);
        current = { ids: [], why: [] };
      }
      current.ids.push(...piece);
      if (!current.why.includes(cluster.why)) current.why.push(cluster.why);
    }
  }
  if (current.ids.length) batches.push(current);
  return batches;
}

/** Every case appears in the plan exactly once. */
export const planCases = (set: AlgSet): Alg[] => CLUSTERS[set].flatMap((c) => c.ids.map((id) => ALGS_BY_ID.get(id)!));

// ---------------------------------------------------------------------------
// What to do next in a batch

export type Task = { kind: "learn" | "recall"; id: string } | { kind: "done" };

/**
 * Learn a new case only while fewer than two are still shaky (and each has
 * one clean recall), practice the
 * shaky ones in between, and now and then bring back a solid one so it stays
 * solid. The batch is done when every case is solid.
 */
export function nextTask(batch: string[], data: LearnData, last: string | null, random: () => number = Math.random): Task {
  const cases = batch.map((id) => ({ id, c: learnCase(data, id) }));
  const fresh = cases.filter(({ c }) => c.stage !== "recall");
  const shaky = cases.filter(({ c }) => c.stage === "recall" && c.streak < SOLID);
  const solid = cases.filter(({ c }) => isSolid(c));
  const notLast = <T extends { id: string }>(list: T[]) => (list.length > 1 ? list.filter((x) => x.id !== last) : list);

  // Each shaky case needs one clean recall before a new one comes in.
  if (fresh.length && shaky.length < 2 && shaky.every((s) => s.c.streak > 0)) return { kind: "learn", id: fresh[0].id };
  if (shaky.length) {
    const reviewable = notLast(solid).filter((s) => s.id !== last);
    if (reviewable.length && random() < 0.25) return { kind: "recall", id: reviewable[Math.floor(random() * reviewable.length)].id };
    const pool = notLast(shaky);
    // Least practiced first.
    const low = Math.min(...pool.map((s) => s.c.streak));
    const lowest = pool.filter((s) => s.c.streak === low);
    return { kind: "recall", id: lowest[Math.floor(random() * lowest.length)].id };
  }
  if (fresh.length) return { kind: "learn", id: fresh[0].id };
  return { kind: "done" };
}
