import { parseAlg } from "./notation";

/**
 * Sticker-level megaminx simulator, used to check the megaminx algorithms and
 * draw their case images.
 *
 * Faces are the twelve vertices of an icosahedron. A sticker slot is a piece
 * (the set of faces it touches: one for a centre, two for an edge, three for a
 * corner) and the face the sticker is on. A clockwise turn of face X moves
 * every piece that touches X one neighbour clockwise around it, so the whole
 * simulator is bookkeeping on face names, with no floating point after setup.
 *
 * Upper half, clockwise seen from above starting at the front: F, L, BL, BR, R.
 * Lower half: DL, DR (under F), DBL, DBR, B, and D at the bottom.
 */

export const MEGA_FACES = ["U", "F", "L", "BL", "BR", "R", "DR", "DL", "DBL", "B", "DBR", "D"] as const;
export type MegaFace = (typeof MEGA_FACES)[number];

type Vec = [number, number, number];

const PHI = (1 + Math.sqrt(5)) / 2;
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec): Vec => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Rotate v about unit axis k by angle t (right-handed). */
function rotateAbout(v: Vec, k: Vec, t: number): Vec {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const kv = cross(k, v);
  const d = dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d];
}

type Model = {
  normals: Record<MegaFace, Vec>;
  /** The five neighbours of each face, clockwise seen from outside. */
  around: Record<MegaFace, MegaFace[]>;
};

function buildModel(): Model {
  // Icosahedron vertices, then turned so one points straight up.
  const raw: Vec[] = [];
  for (const a of [-1, 1]) for (const b of [-PHI, PHI]) raw.push([0, a, b], [a, b, 0], [b, 0, a]);
  const top = norm(raw.find((v) => v[0] === 0 && v[1] === 1 && v[2] === PHI)!);
  // Rotation taking `top` to +y.
  const axis = norm(cross(top, [0, 1, 0]));
  const angle = Math.acos(dot(top, [0, 1, 0]));
  let pts = raw.map((v) => rotateAbout(norm(v), axis, angle));
  // Spin about y so one upper face sits straight in front (+z).
  const upper = pts.filter((p) => p[1] > 0.1 && p[1] < 0.9);
  const front = upper.reduce((best, p) => (p[2] > best[2] ? p : best));
  const spin = Math.atan2(front[0], front[2]);
  pts = pts.map((p) => rotateAbout(p, [0, 1, 0], -spin));

  const azimuth = (p: Vec) => Math.atan2(p[0], p[2]); // 0 = front, + = right
  const near = (want: number, ring: Vec[]) =>
    ring.reduce((best, p) => {
      const d = (q: Vec) => Math.abs(Math.atan2(Math.sin(azimuth(q) - want), Math.cos(azimuth(q) - want)));
      return d(p) < d(best) ? p : best;
    });
  const up = pts.filter((p) => p[1] > 0.1 && p[1] < 0.9);
  const down = pts.filter((p) => p[1] < -0.1 && p[1] > -0.9);
  const deg = (d: number) => (d * Math.PI) / 180;
  const normals = {
    U: pts.find((p) => p[1] > 0.9)!,
    D: pts.find((p) => p[1] < -0.9)!,
    F: near(0, up),
    R: near(deg(72), up),
    BR: near(deg(144), up),
    BL: near(deg(-144), up),
    L: near(deg(-72), up),
    DR: near(deg(36), down),
    DL: near(deg(-36), down),
    DBR: near(deg(108), down),
    DBL: near(deg(-108), down),
    B: near(deg(180), down),
  } as Record<MegaFace, Vec>;

  const around = {} as Record<MegaFace, MegaFace[]>;
  for (const f of MEGA_FACES) {
    const n = normals[f];
    const neighbours = MEGA_FACES.filter((g) => g !== f && dot(normals[g], n) > 0.3);
    // A reference direction in the face's plane, then angles about the normal.
    const ref = norm(cross(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1]));
    const ref2 = cross(n, ref);
    const ang = (g: MegaFace) => Math.atan2(dot(normals[g], ref2), dot(normals[g], ref));
    // Clockwise seen from outside is decreasing angle about the outward normal.
    around[f] = neighbours.sort((a, b) => ang(b) - ang(a));
  }
  return { normals, around };
}

const MODEL = buildModel();
export const megaAround = (f: MegaFace) => MODEL.around[f];
export const megaNormal = (f: MegaFace) => MODEL.normals[f];

/** A sticker slot: the face it shows on, and the faces of its piece (sorted). */
type Slot = { face: MegaFace; piece: MegaFace[] };

const key = (face: MegaFace, piece: MegaFace[]) => `${face}:${[...piece].sort().join(",")}`;

const SLOTS: Slot[] = [];
const SLOT_INDEX = new Map<string, number>();
for (const f of MEGA_FACES) {
  const ring = MODEL.around[f];
  const pieces: MegaFace[][] = [[f], ...ring.map((g) => [f, g]), ...ring.map((g, i) => [f, g, ring[(i + 1) % 5]])];
  for (const piece of pieces) {
    SLOT_INDEX.set(key(f, piece), SLOTS.length);
    SLOTS.push({ face: f, piece: [...piece].sort() as MegaFace[] });
  }
}
export const MEGA_SLOT_COUNT = SLOTS.length;
export const megaSlot = (face: MegaFace, piece: MegaFace[]) => SLOT_INDEX.get(key(face, piece))!;
export const megaSlots = SLOTS;

/** A face map as a sticker permutation: each slot goes where its faces go. */
function permFrom(map: (f: MegaFace) => MegaFace, touches: (s: Slot) => boolean): Int32Array {
  const perm = new Int32Array(SLOTS.length);
  SLOTS.forEach((s, i) => {
    perm[i] = touches(s) ? SLOT_INDEX.get(key(map(s.face), s.piece.map(map)))! : i;
  });
  return perm;
}

const TURN = Object.fromEntries(
  MEGA_FACES.map((f) => {
    const ring = MODEL.around[f];
    const next = (g: MegaFace) => (ring.includes(g) ? ring[(ring.indexOf(g) + 1) % 5] : g);
    return [f, permFrom(next, (s) => s.piece.includes(f))];
  }),
) as Record<MegaFace, Int32Array>;

// y: the whole puzzle a fifth clockwise seen from above.
const Y_MAP = (() => {
  const u = MODEL.normals.U;
  const out = {} as Record<MegaFace, MegaFace>;
  for (const f of MEGA_FACES) {
    const turned = rotateAbout(MODEL.normals[f], u, (-2 * Math.PI) / 5);
    out[f] = MEGA_FACES.reduce((best, g) => (dot(MODEL.normals[g], turned) > dot(MODEL.normals[best], turned) ? g : best));
  }
  return out;
})();
const Y_PERM = permFrom((f) => Y_MAP[f], () => true);

export type MegaState = Uint8Array;

/** Colour of each slot, as the index of its home face. */
export function megaSolved(): MegaState {
  return Uint8Array.from(SLOTS, (s) => MEGA_FACES.indexOf(s.face));
}

export function megaIdentity(): Int32Array {
  return Int32Array.from(SLOTS, (_, i) => i);
}

export function megaApply<T extends Uint8Array | Int32Array>(state: T, alg: string): T {
  let cur = state;
  for (const { base, turns } of parseAlg(alg, "megaminx")) {
    const perm = base === "y" ? Y_PERM : TURN[base as MegaFace];
    for (let t = 0; t < turns; t++) {
      const next = new (cur.constructor as { new (len: number): T })(cur.length);
      for (let i = 0; i < cur.length; i++) next[perm[i]] = cur[i];
      cur = next;
    }
  }
  return cur;
}

const U = MEGA_FACES.indexOf("U");
const home = (i: number) => MEGA_FACES.indexOf(SLOTS[i].face);
const inTop = (s: Slot) => s.piece.includes("U");

export function megaIsSolved(state: MegaState): boolean {
  return state.every((c, i) => c === home(i));
}

/** Everything off the top layer is solved. */
export function megaF2LSolved(state: MegaState): boolean {
  return SLOTS.every((s, i) => inTop(s) || state[i] === home(i));
}

/** The top colour faces up on every top-layer edge (and corner, with `corners`). */
export function megaOriented(state: MegaState, corners: boolean): boolean {
  return SLOTS.every((s, i) => !(s.face === "U" && s.piece.length > 1) || (s.piece.length === 3 && !corners) || state[i] === U);
}

/** Top-layer edges are in their places. */
export function megaEdgesPlaced(state: MegaState): boolean {
  return SLOTS.every((s, i) => !(inTop(s) && s.piece.length === 2) || state[i] === home(i));
}

/** True when the alg ends with the puzzle held the way it started: the centres are home. */
export function megaKeepsOrientation(alg: string): boolean {
  const end = megaApply(megaSolved(), alg);
  return MEGA_FACES.every((f) => end[megaSlot(f, [f])] === MEGA_FACES.indexOf(f));
}

/**
 * The same alg with rotations taken out: moves after a y are renamed to the
 * faces they now point at.
 */
export function megaWithoutRotations(alg: string): string {
  // frame[f]: the face of the held puzzle that's now in position f.
  let frame = Object.fromEntries(MEGA_FACES.map((f) => [f, f])) as Record<MegaFace, MegaFace>;
  const out: string[] = [];
  const inverse = Object.fromEntries(MEGA_FACES.map((f) => [Y_MAP[f], f])) as Record<MegaFace, MegaFace>;
  for (const token of alg.replace(/[()[\]]/g, " ").split(/\s+/).filter(Boolean)) {
    const m = /^(DBR|DBL|BR|BL|DR|DL|[URFLDB]|y)(.*)$/.exec(token)!;
    if (m[1] !== "y") {
      out.push(frame[m[1] as MegaFace] + m[2]);
      continue;
    }
    const [{ turns }] = parseAlg(token, "megaminx");
    for (let t = 0; t < turns; t++) frame = Object.fromEntries(MEGA_FACES.map((f) => [f, frame[inverse[f]]])) as Record<MegaFace, MegaFace>;
  }
  return out.join(" ");
}
