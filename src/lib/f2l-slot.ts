import { faceTurnsOnly, invertAlg, mirrorAlg, simplifyAlg } from "./notation";

export const F2L_SLOTS = ["FR", "FL", "BR", "BL"] as const;
export type F2LSlot = (typeof F2L_SLOTS)[number];
/** `rotation` turns the cube so the slot sits at front-right. */
export const SLOT_INFO: Record<F2LSlot, { label: string; x: number; z: number; rotation: string }> = {
  FR: { label: "Front-right", x: 1, z: 1, rotation: "" },
  FL: { label: "Front-left", x: -1, z: 1, rotation: "y'" },
  BR: { label: "Back-right", x: 1, z: -1, rotation: "y" },
  BL: { label: "Back-left", x: -1, z: -1, rotation: "y2" },
};

/** Reflect within FR first, then relabel faces to move that slot around D. No physical rotation remains. */
export function f2lToSlot(alg: string, slot: F2LSlot, mirrored = false): string {
  const rotation = SLOT_INFO[slot].rotation;
  const source = mirrored ? mirrorAlg(alg, "FR") : alg;
  return faceTurnsOnly(`${rotation} ${source} ${invertAlg(rotation)}`);
}

/** `f2l-5` is the front-right case; the other slots add a suffix: `f2l-5-bl`. */
export function slotCaseId(baseId: string, slot: F2LSlot): string {
  return slot === "FR" ? baseId : `${baseId}-${slot.toLowerCase()}`;
}

/** The front-right case and slot behind an F2L case id. */
export function parseSlotId(id: string): { baseId: string; slot: F2LSlot } | null {
  const m = /^(f2l-\d+)(?:-(fl|br|bl))?$/.exec(id);
  return m ? { baseId: m[1], slot: (m[2]?.toUpperCase() ?? "FR") as F2LSlot } : null;
}

/** "Front-right slot" in prose. */
export const slotPhrase = (slot: F2LSlot) => `${SLOT_INFO[slot].label.toLowerCase()} slot`;

/**
 * A front-right case's algorithms moved to another slot: first in face turns
 * (R U R' becomes L' U' L for front-left), then turning the cube to put the
 * slot at front-right and doing the original. Those regrip versions end with
 * the cube held turned, as you would in a solve.
 */
export function slotAlgs(frAlgs: string[], slot: F2LSlot): string[] {
  if (slot === "FR") return frAlgs;
  const rotation = SLOT_INFO[slot].rotation;
  const translated = frAlgs.map((alg) => f2lToSlot(alg, slot));
  const regrip = frAlgs.map((alg) => simplifyAlg(`${rotation} ${alg}`));
  return [...new Set([...translated, ...regrip])];
}
