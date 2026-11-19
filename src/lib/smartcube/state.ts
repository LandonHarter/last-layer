import { applyAlg, colorOf, faceOf, solvedCube, type Face, type Sticker, type Vec } from "../cube";
import { invertAlg, parseAlg } from "../notation";

/**
 * Smart cube states. A smart cube knows only which centre each turn moved, so
 * everything here lives in the cube's own frame: white (U) up, green (F) front,
 * the WCA scrambling hold. `Sticker[]` states come from `cube.ts`.
 */

export const FACE_ORDER: Face[] = ["U", "R", "F", "D", "L", "B"];

// Kociemba facelet order: each face read in rows as seen from outside, with the
// top of U against B, the top of D against F, and the sides upright.
const FACELET_SLOTS: { pos: Vec; normal: Vec }[] = FACE_ORDER.flatMap((face) => {
  const slots: { pos: Vec; normal: Vec }[] = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      const a = r - 1, b = c - 1;
      const at: Record<Face, [Vec, Vec]> = {
        U: [[b, 1, a], [0, 1, 0]],
        R: [[1, -a, -b], [1, 0, 0]],
        F: [[b, -a, 1], [0, 0, 1]],
        D: [[b, -1, -a], [0, -1, 0]],
        L: [[-1, -a, b], [-1, 0, 0]],
        B: [[-b, -a, -1], [0, 0, -1]],
      };
      const [pos, normal] = at[face];
      slots.push({ pos, normal });
    }
  return slots;
});

const key = (pos: Vec, normal: Vec) => `${pos.join(",")}/${normal.join(",")}`;
const SLOT_INDEX = new Map(FACELET_SLOTS.map((s, i) => [key(s.pos, s.normal), i]));
const SOLVED = solvedCube();
/** A solved-cube sticker id for each colour, so a state can be built from colours alone. */
const ID_OF: Record<Face, number> = Object.fromEntries(FACE_ORDER.map((f) => [f, SOLVED.find((s) => faceOf(s.normal) === f)!.id])) as Record<Face, number>;

/** The colours of a state as a Kociemba facelet string, `UUUUUUUUURRR…`. Equal strings are equal states. */
export function toFacelets(state: Sticker[]): string {
  const out = new Array<string>(54);
  for (const s of state) out[SLOT_INDEX.get(key(s.pos, s.normal))!] = colorOf(s);
  return out.join("");
}

/** A state with these colours. Sticker ids only carry colour here, which is all the checks use. */
export function fromFacelets(facelets: string): Sticker[] {
  if (!/^[URFDLB]{54}$/.test(facelets)) throw new Error("Bad facelets");
  return FACELET_SLOTS.map((slot, i) => ({ id: ID_OF[facelets[i] as Face], pos: [...slot.pos] as Vec, normal: [...slot.normal] as Vec }));
}

export const SOLVED_FACELETS = toFacelets(SOLVED);

/** Give each sticker the colour of the face its colour's centre sits on, after a whole-cube rotation. */
export function recolourToCentres(state: Sticker[]): Sticker[] {
  const centreFace = centres(state);
  return state.map((s) => ({ ...s, id: ID_OF[centreFace.get(colorOf(s))!] }));
}

const ROTATIONS = ["", "y", "y2", "y'"].flatMap((y) => ["", "x", "x2", "x'", "z", "z'"].map((xz) => `${xz} ${y}`.trim()));

/** The whole-cube rotation that brings the `top` colour up and `front` colour to the front. */
export function rotationFor(top: Face, front: Face): string | null {
  for (const rot of ROTATIONS) {
    const c = centres(applyAlg(SOLVED, rot));
    if (c.get(top) === "U" && c.get(front) === "F") return rot;
  }
  return null;
}

/** Where each colour's centre is. */
export function centres(state: Sticker[]): Map<Face, Face> {
  const out = new Map<Face, Face>();
  for (const s of state) if (s.pos.filter((v) => v !== 0).length === 1) out.set(colorOf(s), faceOf(s.normal));
  return out;
}

/**
 * How a turn reported by the cube (named by the colour of the centre it turned)
 * reads to someone holding `top` up and `front` in front: "U" (white) is "D" when
 * yellow is up.
 */
export function gripMap(top: Face, front: Face): Record<Face, Face> {
  const rot = rotationFor(top, front);
  if (rot === null) throw new Error(`Can't hold ${top} up with ${front} in front`);
  const c = centres(applyAlg(SOLVED, rot));
  return Object.fromEntries(FACE_ORDER.map((f) => [f, c.get(f)!])) as Record<Face, Face>;
}

/** Turn a cube-frame move ("R'") into the grip's name for it. */
export function toGrip(move: string, map: Record<Face, Face>): string {
  return map[move[0] as Face] + move.slice(1);
}

/** Faces that can be up and in front together. */
export const opposite: Record<Face, Face> = { U: "D", D: "U", R: "L", L: "R", F: "B", B: "F" };

// Slice, wide and rotation moves as turns of outer faces plus a rotation of the whole cube.
const AS_OUTER: Record<string, [string, string]> = {
  r: ["L", "x"], l: ["R", "x'"], u: ["D", "y"], d: ["U", "y'"], f: ["B", "z"], b: ["F", "z'"],
  M: ["R L'", "x'"], E: ["U D'", "y'"], S: ["F' B", "z"],
  x: ["", "x"], y: ["", "y"], z: ["", "z"],
};

/**
 * The turns a smart cube reports (named by centre colour, in its own frame)
 * when someone holding `top` up and `front` in front does `alg`. Used for tests
 * and the virtual cube.
 */
export function reportsFor(alg: string, top: Face = "U", front: Face = "F"): string[] {
  let frame = applyAlg(SOLVED, rotationFor(top, front) ?? "");
  const out: string[] = [];
  for (const m of parseAlg(alg)) {
    const base = m.base.endsWith("w") ? m.base[0].toLowerCase() : m.base;
    // A prime is one turn the other way, not three.
    const back = m.turns === 3;
    for (let t = 0; t < (back ? 1 : m.turns); t++) {
      const [fwdOuter, fwdRot] = AS_OUTER[base] ?? [base, ""];
      const outer = back ? invertAlg(fwdOuter) : fwdOuter;
      const rot = back ? invertAlg(fwdRot) : fwdRot;
      const at = centres(frame);
      const colourOn = (f: Face) => [...at.entries()].find(([, g]) => g === f)![0];
      for (const turn of parseAlg(outer)) {
        const colour = colourOn(turn.base as Face);
        out.push(turn.turns === 1 ? colour : `${colour}'`);
      }
      if (rot) frame = applyAlg(frame, rot);
    }
  }
  return out;
}
