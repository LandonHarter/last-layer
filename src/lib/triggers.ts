import { ALGS, type Alg } from "@/data/algs";
import { fitAlg } from "./cases";
import { countUnit, invertAlg, mirrorAlg, moveCount, splitMoves, tokens, type Notation } from "./notation";
import { looksSq1 } from "./sq1";
import { notationOf } from "./puzzles";

/** A piece of an algorithm to remember as one unit. Named when it is a well-known trigger. */
export type Chunk = { moves: string[]; name?: string };

// Well-known triggers, longest first when matching. Short unnamed ones still
// mark where one chunk ends and the next begins.
const BASE: [string, string?][] = [
  ["R U R' U R U2 R'", "Sune"],
  ["R U2 R' U' R U' R'", "Antisune"],
  ["r U R' U R U2 r'", "Wide Sune"],
  ["r U2 R' U' R U' r'", "Wide Antisune"],
  ["F R U R' U' F'", "F sexy F'"],
  ["f R U R' U' f'", "f sexy f'"],
  ["R U R' U'", "Sexy move"],
  ["U R U' R'", "Reverse sexy"],
  ["R' U' R U", "Inverse sexy"],
  ["r U R' U'", "Wide sexy"],
  ["R' F R F'", "Sledgehammer"],
  ["F R' F' R", "Hedgeslammer"],
  ["r U r'"], ["r U' r'"], ["r U2 r'"], ["r' U' r"], ["r' U r"], ["r' U2 r"],
  ["R U R'"], ["R U' R'"], ["R U2 R'"], ["R' U' R"], ["R' U R"], ["R' U2 R"],
  ["F U F'"], ["F U' F'"], ["F' U F"], ["F' U' F"],
  ["M' U M"], ["M U M'"], ["M' U' M"], ["M U' M'"],
];

const TRIGGERS: { moves: string[]; name?: string }[] = (() => {
  const seen = new Set<string>();
  const out: { moves: string[]; name?: string }[] = [];
  for (const [alg, name] of BASE) {
    for (const [moves, label] of [
      [alg, name],
      [mirrorAlg(alg, "M"), name && `Left ${name[0].toLowerCase()}${name.slice(1)}`],
    ] as const) {
      const key = splitMoves(moves).join(" ");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ moves: splitMoves(moves), name: label ?? undefined });
    }
  }
  return out.sort((a, b) => b.moves.length - a.moves.length);
})();

/** Split unmatched moves into pieces of at most four, as even as possible. */
function splitRun(run: string[]): Chunk[] {
  if (!run.length) return [];
  const pieces = Math.ceil(run.length / 4);
  const size = Math.ceil(run.length / pieces);
  const out: Chunk[] = [];
  for (let i = 0; i < run.length; i += size) out.push({ moves: run.slice(i, i + size) });
  return out;
}

// On a megaminx U2 is two fifths, so the Sunes are different algs there; the quarter-turn triggers still fit.
const MEGA_TRIGGERS = TRIGGERS.filter((t) => t.moves.every((m) => !m.includes("2")));

/** Break an algorithm into chunks to learn one at a time: named triggers where they fit. */
export function chunkAlg(alg: string, notation: Notation = "cube"): Chunk[] {
  if (notation === "sq1" || looksSq1(alg)) return sq1Chunks(alg);
  const triggers = notation === "megaminx" ? MEGA_TRIGGERS : TRIGGERS;
  const moves = splitMoves(alg);
  const chunks: Chunk[] = [];
  let run: string[] = [];
  let i = 0;
  while (i < moves.length) {
    const hit = triggers.find((t) => t.moves.every((m, j) => moves[i + j] === m));
    if (!hit) {
      run.push(moves[i++]);
      continue;
    }
    chunks.push(...splitRun(run));
    run = [];
    chunks.push({ moves: hit.moves, name: hit.name });
    i += hit.moves.length;
  }
  chunks.push(...splitRun(run));
  return mergeTiny(chunks);
}

/** Square-1: two slices to a chunk, each with the turn before it, so a chunk reads "(1,0) / (-1,0) /". */
function sq1Chunks(alg: string): Chunk[] {
  const units: string[][] = [];
  let unit: string[] = [];
  for (const move of splitMoves(alg)) {
    unit.push(move);
    if (move === "/") {
      units.push(unit);
      unit = [];
    }
  }
  if (unit.length) {
    if (units.length) units[units.length - 1].push(...unit);
    else units.push(unit);
  }
  const chunks: Chunk[] = [];
  for (let i = 0; i < units.length; i += 2) chunks.push({ moves: units.slice(i, i + 2).flat() });
  // A lone last slice joins the chunk before it.
  if (chunks.length > 1 && units.length % 2 === 1) chunks.splice(-2, 2, { moves: [...chunks.at(-2)!.moves, ...chunks.at(-1)!.moves] });
  return chunks;
}

/** Fold one- and two-move pieces into an unnamed neighbour, so no chunk is a lone "F". */
function mergeTiny(chunks: Chunk[]): Chunk[] {
  const out = [...chunks];
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    if (c.name || c.moves.length > 2) continue;
    const next = out[i + 1];
    const prev = out[i - 1];
    if (next && !next.name && next.moves.length + c.moves.length <= 5) {
      out.splice(i, 2, { moves: [...c.moves, ...next.moves] });
      i = Math.max(-1, i - 2);
    } else if (prev && !prev.name && prev.moves.length + c.moves.length <= 5) {
      out.splice(i - 1, 2, { moves: [...prev.moves, ...c.moves] });
      i = Math.max(-1, i - 3);
    }
  }
  return out;
}

/** Short facts about an algorithm, for comparing the options for a case. */
export function describeAlg(alg: string): string[] {
  if (looksSq1(alg)) return [`${moveCount(alg)} ${countUnit(alg, moveCount(alg))}`];
  const layers = tokens(alg).map((t) => t.replace(/(2'|2|')$/, ""));
  const bases = new Set(layers.map((b) => (/^[RLUDFB]w$/.test(b) ? b[0].toLowerCase() : b)));
  const tags: string[] = [`${moveCount(alg)} moves`];
  const faces = [...bases].filter((b) => /^[RLUDFB]$/.test(b));
  if ([...bases].every((b) => b === "R" || b === "U")) tags.push("Only R and U");
  else if ([...bases].every((b) => b === "L" || b === "U")) tags.push("Only L and U");
  else if (faces.length === bases.size && faces.length <= 3) tags.push(`Only ${faces.join(", ")}`);
  if ([...bases].some((b) => /^\d?[rludfb]$|^\d[RLUDFB]w$/.test(b))) tags.push("Wide moves");
  if ([...bases].some((b) => /^[MES]$|^\d[RLUDFB]$/.test(b))) tags.push("Slice moves");
  if ([...bases].some((b) => /^[xyz]$/.test(b))) tags.push("Rotation");
  if (bases.has("D")) tags.push("D turns");
  if (bases.has("B")) tags.push("B turns");
  return tags;
}

export type Tip = { text: string; caseId?: string };


/**
 * Other cases whose algorithm, mirrored or done backwards, solves this one.
 * `mainOf` gives the algorithm you use for each case.
 */
export function relatives(target: Alg, mainOf: (a: Alg) => string): { alg: Alg; how: "mirror" | "inverse" }[] {
  const out: { alg: Alg; how: "mirror" | "inverse" }[] = [];
  for (const other of ALGS) {
    if (other.set !== target.set || other.id === target.id) continue;
    const main = mainOf(other);
    const notation = notationOf(target.set);
    // F2L mirrors through the front-right edge so the slot stays put; everything else left for right.
    if (fitAlg(target, mirrorAlg(main, target.set === "F2L" ? "FR" : "M", notation))) out.push({ alg: other, how: "mirror" });
    else if (fitAlg(target, invertAlg(main, notation))) out.push({ alg: other, how: "inverse" });
  }
  return out;
}

/**
 * Advice for memorizing `alg` for `target`. Relations to cases you've
 * `learned`, then ones in your current `batch`, come first.
 */
export function memoryTips(target: Alg, alg: string, mainOf: (a: Alg) => string, learned: Set<string>, batch: Set<string> = new Set()): Tip[] {
  const tips: Tip[] = [];
  const chunks = chunkAlg(alg, notationOf(target.set));
  const count = moveCount(alg);

  const rank = (id: string) => (learned.has(id) ? 2 : batch.has(id) ? 1 : 0);
  const rel = relatives(target, mainOf).sort((a, b) => rank(b.alg.id) - rank(a.alg.id));
  for (const { alg: other, how } of rel.slice(0, 2)) {
    const lead = learned.has(other.id) ? `You know ${other.name}` : batch.has(other.id) ? `${other.name} is in this batch` : `It pairs with ${other.name}`;
    tips.push({
      caseId: other.id,
      text:
        how === "mirror"
          ? `${lead}: its algorithm mirrored (left hand for right) solves this case too. Learn them as a pair.`
          : `${lead}: its algorithm done backwards solves this case. One undoes the other.`,
    });
  }

  const named = chunks.filter((c) => c.name);
  const counts = new Map<string, number>();
  for (const c of named) counts.set(c.name!, (counts.get(c.name!) ?? 0) + 1);
  for (const [name, n] of counts) if (n > 1) tips.push({ text: `The ${name.toLowerCase()} comes ${n === 2 ? "twice" : `${n} times`}. Count them as you go.` });
  if (named.length) {
    const names = [...new Set(named.map((c) => c.name!))];
    tips.push({ text: `Built on ${names.join(", ")}. Your hands already know ${names.length === 1 ? "it" : "these"}; remember what goes between.` });
  }

  const bases = new Set(tokens(alg).map((t) => t.replace(/(2'|2|')$/, "")));
  if ([...bases].every((b) => b === "R" || b === "U")) tips.push({ text: "Only R and U turns: keep your grip and don't regrip." });

  if (chunks.length >= 4) {
    const half = Math.ceil(chunks.length / 2);
    tips.push({ text: `${count} ${countUnit(alg, count)} in ${chunks.length} chunks. Learn the first ${half} until they're smooth, then add the rest.` });
  }

  const first = splitMoves(alg)[0];
  if (/^U/.test(first)) tips.push({ text: `Starts with ${first}: check you're holding the case at the angle in the picture.` });
  return tips;
}
