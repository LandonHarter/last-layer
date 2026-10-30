import { ALGS, type Alg } from "@/data/algs";
import { applyAlg, colorOf, faceOf, normalizeOrientation, solvedCube, type Sticker } from "./cube";
import { countMoves } from "./fmc";
import { faceTurnsOnly, formatAlg, invertAlg, mirrorAlg, parseAlg, simplifyAlg } from "./notation";

export const F2L_CASES = ALGS.filter((c) => c.set === "F2L");
export const F2L_SLOTS = ["FR", "FL", "BR", "BL"] as const;
export type F2LSlot = (typeof F2L_SLOTS)[number];
export const SLOT_INFO: Record<F2LSlot, { label: string; x: number; z: number; rotation: string }> = {
  FR: { label: "Front-right", x: 1, z: 1, rotation: "" },
  FL: { label: "Front-left", x: -1, z: 1, rotation: "y'" },
  BR: { label: "Back-right", x: 1, z: -1, rotation: "y" },
  BL: { label: "Back-left", x: -1, z: -1, rotation: "y2" },
};
export const F2L_AUFS = ["", "U", "U2", "U'"] as const;
export type F2LVariant = { caseId: string; slot: F2LSlot; mirrored: boolean; auf: string };
export type F2LExercise = F2LVariant & { setup: string; protectedSlots: F2LSlot[] };
export type F2LSolution = { alg: string; htm: number; rotations: number };
export type F2LCheck =
  | { ok: false; error: string }
  | (F2LSolution & { ok: true; solved: boolean; targetSolved: boolean; crossSolved: boolean; brokenSlots: F2LSlot[] });

const HOME = solvedCube();
const pick = <T>(items: readonly T[], random: () => number): T => items[Math.floor(random() * items.length)];
const getCase = (id: string): Alg => {
  const c = F2L_CASES.find((c) => c.id === id);
  if (!c) throw new Error(`Unknown F2L case: ${id}`);
  return c;
};

/** Reflect within FR first, then relabel faces to move that slot around D. No physical rotation remains. */
export function f2lToSlot(alg: string, slot: F2LSlot, mirrored = false): string {
  const rotation = SLOT_INFO[slot].rotation;
  const source = mirrored ? mirrorAlg(alg, "FR") : alg;
  return faceTurnsOnly(`${rotation} ${source} ${invertAlg(rotation)}`);
}

export function f2lVariantKey(v: F2LVariant): string {
  return `${v.caseId}:${v.slot}:${v.mirrored ? "mirror" : "original"}:${v.auf || "none"}`;
}

/** Later-step noise hides the last layer; undo an alternative so the setup needn't spell out the reference. */
export function makeF2LExercise(variant: F2LVariant, random: () => number = Math.random): F2LExercise {
  const c = getCase(variant.caseId);
  const noise = pick(["R U R' U R U2 R'", "R U' R U R U R U' R' U' R2", "F R U R' U' F'"], random);
  const alternative = pick(c.algs.slice(1).length ? c.algs.slice(1) : c.algs, random);
  return {
    ...variant,
    setup: simplifyAlg(`${f2lToSlot(`${noise} ${invertAlg(alternative)}`, variant.slot, variant.mirrored)} ${variant.auf}`),
    protectedSlots: F2L_SLOTS.filter((slot) => slot !== variant.slot),
  };
}

export function isF2LTargetSticker(sticker: Sticker, slot: F2LSlot): boolean {
  const { x, z } = SLOT_INFO[slot];
  const pos = HOME[sticker.id].pos;
  return pos[0] === x && pos[2] === z && pos[1] < 1;
}

/** Track piece identities, so a displaced piece cannot disappear from a goal check. State must be normalized. */
export function f2lSlotSolved(state: Sticker[], slot: F2LSlot): boolean {
  return state.filter((s) => isF2LTargetSticker(s, slot)).every(stickerHome);
}

function stickerHome(s: Sticker): boolean {
  const home = HOME[s.id];
  return s.pos.every((v, i) => v === home.pos[i]) && colorOf(s) === faceOf(s.normal);
}

export function f2lCrossSolved(state: Sticker[]): boolean {
  return state.filter((s) => {
    const p = HOME[s.id].pos;
    return p[1] === -1 && Math.abs(p[0]) + Math.abs(p[2]) === 1;
  }).every(stickerHome);
}

/** Reject big-cube tokens before the 3x3 simulator sees them. Preserve submitted move costs, including cancellations. */
export function describeF2LSolution(alg: string): F2LSolution {
  if (alg.length > 2000) throw new Error("Keep solutions under 2,000 characters.");
  const moves = parseAlg(alg);
  if (!moves.length) throw new Error("Enter the moves you used first.");
  if (moves.some((m) => !/^(?:[RLUDFBrludfbMESxyz]|[RLUDFB]w)$/.test(m.base))) {
    throw new Error("Use 3x3 face, wide, slice or rotation moves (for example R U R' or y L' U L).");
  }
  return { alg: formatAlg(moves), htm: countMoves(alg).htm, rotations: moves.filter((m) => /^[xyz]$/.test(m.base)).length };
}

/** Ending in another hold is allowed. Cross and protected slots need only be restored at the end. */
export function checkF2LSolution(exercise: F2LExercise, alg: string): F2LCheck {
  try {
    const description = describeF2LSolution(alg);
    const state = normalizeOrientation(applyAlg(applyAlg(HOME, exercise.setup), description.alg));
    const targetSolved = f2lSlotSolved(state, exercise.slot);
    const crossSolved = f2lCrossSolved(state);
    const brokenSlots = exercise.protectedSlots.filter((slot) => !f2lSlotSolved(state, slot));
    return { ...description, ok: true, targetSolved, crossSolved, brokenSlots, solved: targetSolved && crossSolved && brokenSlots.length === 0 };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not read those moves." };
  }
}

/** Verified alternatives, not an optimality claim. Include a different hold for learning back-slot execution. */
export function f2lComparisons(exercise: F2LExercise, personal?: string): F2LSolution[] {
  const c = getCase(exercise.caseId);
  const candidates = c.algs.map((alg) => simplifyAlg(`${invertAlg(exercise.auf)} ${f2lToSlot(alg, exercise.slot, exercise.mirrored)}`));
  const regrip = SLOT_INFO[exercise.slot].rotation;
  if (regrip) {
    for (const alg of [...candidates]) {
      candidates.push(`${regrip} ${faceTurnsOnly(`${invertAlg(regrip)} ${alg} ${regrip}`)}`);
    }
  }
  if (personal) candidates.push(personal);
  return [...new Set(candidates)].flatMap((alg) => {
    const check = checkF2LSolution(exercise, alg);
    return check.ok && check.solved ? [{ alg: check.alg, htm: check.htm, rotations: check.rotations }] : [];
  }).sort((a, b) => a.htm - b.htm || a.rotations - b.rotations || a.alg.localeCompare(b.alg));
}

export type F2LRecord = {
  attempts: number;
  solved: number;
  efficient: number;
  streak: number;
  lastSeen: number;
  best?: F2LSolution;
};
export type F2LProgress = Record<string, F2LRecord>;

/** First attempts only. Assisted answers never build an efficiency streak. */
export function recordF2LResult(previous: F2LRecord | undefined, check: F2LCheck | null, target: F2LSolution, assisted: boolean, at: number): F2LRecord {
  const solved = check?.ok === true && check.solved;
  const efficient = solved && !assisted && check.htm <= target.htm && check.rotations <= target.rotations;
  const candidate = solved ? { alg: check.alg, htm: check.htm, rotations: check.rotations } : undefined;
  const best = candidate && (!previous?.best || candidate.htm < previous.best.htm || (candidate.htm === previous.best.htm && candidate.rotations < previous.best.rotations))
    ? candidate : previous?.best;
  return {
    attempts: (previous?.attempts ?? 0) + 1,
    solved: (previous?.solved ?? 0) + Number(solved),
    efficient: (previous?.efficient ?? 0) + Number(efficient),
    streak: efficient ? (previous?.streak ?? 0) + 1 : 0,
    lastSeen: at,
    best,
  };
}

/** Unseen and inefficient variants return more often; avoid exact immediate repeats when possible. */
export function pickF2LVariant(variants: F2LVariant[], progress: F2LProgress, recent: string | undefined, random: () => number = Math.random): F2LVariant | undefined {
  const pool = variants.length > 1 ? variants.filter((v) => f2lVariantKey(v) !== recent) : variants;
  const shaky = pool.filter((v) => {
    const record = progress[f2lVariantKey(v)];
    return record && record.streak < 3;
  });
  // Without a review lane, one missed variant would get lost among 1,311 unseen ones.
  const review = shaky.length > 0 && random() < 0.65;
  const weighted = (review ? shaky : pool).map((variant) => {
    const record = progress[f2lVariantKey(variant)];
    const weight = !record ? 5 : record.streak >= 3 ? 1 : 6 + 4 * (1 - record.efficient / record.attempts);
    return { variant, weight };
  });
  let n = random() * weighted.reduce((sum, item) => sum + item.weight, 0);
  for (const item of weighted) {
    n -= item.weight;
    if (n < 0) return item.variant;
  }
  return weighted.at(-1)?.variant;
}

export function f2lVariants(caseIds: string[], slots: readonly F2LSlot[], mirrors: boolean): F2LVariant[] {
  return caseIds.flatMap((caseId) => slots.flatMap((slot) => (mirrors ? [false, true] : [false]).flatMap((mirrored) =>
    F2L_AUFS.map((auf) => ({ caseId, slot, mirrored, auf })),
  )));
}
