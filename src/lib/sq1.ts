/**
 * Square-1 simulator, used to check the Square-1 algorithms, draw their case
 * images and the timer's scramble picture.
 *
 * Each layer has twelve 30° slots, numbered clockwise seen from above (the
 * bottom layer too, as if seen through the puzzle). Slot k covers the angles
 * 15° + 30k to 45° + 30k, measured clockwise from the back. An edge fills one
 * slot and a corner two. The slice (`/`) turns the right half, slots 0 to 5 on
 * both layers, half a turn: top slot k swaps with bottom slot 5 - k, and the
 * middle layer flips. It can't turn while a corner sits across the cut, between
 * slots 11 and 0 or 5 and 6.
 *
 * Solved, each layer reads corner, corner, edge from slot 0, so the edges sit
 * at slots 2, 5, 8 and 11 (right, front, left and back) and the front edge is
 * just right of the cut. From there `(1,0) /` and `(0,-1) /` keep the cube
 * shape, the way WCA scrambles and most algorithms start.
 *
 * Notation: `(a,b)` turns the top a twelfths clockwise seen from above and the
 * bottom b twelfths clockwise seen from below; `/` is the slice.
 *
 * A state is 25 bytes: the 12 top slots, the 12 bottom slots, then the middle
 * (0 solved, 1 flipped). A slot holds `piece * 2 + half`: pieces 0 to 3 are the
 * top corners, 4 to 7 the bottom corners, 8 to 11 the top edges and 12 to 15
 * the bottom edges; half 0 is a corner's first slot clockwise from above when
 * solved. If a slice turns while it's blocked, byte 25 is set and the state
 * counts as broken.
 */

export type Sq1State = Uint8Array;

export const SQ1_LENGTH = 26;
const MIDDLE = 24;
const BROKEN = 25;

/** The face each slot points at, clockwise from above starting at slot 0 (back-right). */
export const SIDE_FACE = ["B", "R", "R", "R", "F", "F", "F", "L", "L", "L", "B", "B"] as const;
export type Sq1Face = "U" | "D" | "F" | "R" | "B" | "L";

const CORNER_SLOTS = [0, 3, 6, 9];
const EDGE_SLOTS = [2, 5, 8, 11];

export const isCorner = (value: number) => value >> 1 < 8;
const piece = (value: number) => value >> 1;

export function sq1Solved(): Sq1State {
  const s = new Uint8Array(SQ1_LENGTH);
  for (let layer = 0; layer < 2; layer++) {
    const base = layer * 12;
    CORNER_SLOTS.forEach((slot, i) => {
      const p = layer * 4 + i;
      s[base + slot] = p * 2;
      s[base + slot + 1] = p * 2 + 1;
    });
    EDGE_SLOTS.forEach((slot, i) => {
      s[base + slot] = (8 + layer * 4 + i) * 2;
    });
  }
  return s;
}

const SOLVED = sq1Solved();
/** Each value's home slot (0 to 23). */
const HOME = new Map<number, number>();
SOLVED.slice(0, 24).forEach((v, i) => HOME.set(v, i));

/** The colours of the piece half in a slot: its top or bottom colour, and its side colour. */
export function sq1Colors(value: number): { face: "U" | "D"; side: Sq1Face } {
  const home = HOME.get(value)!;
  return { face: home < 12 ? "U" : "D", side: SIDE_FACE[home % 12] };
}

/** The colour of a piece's top or bottom sticker as it sits now. */
export const isTopPiece = (value: number) => HOME.get(value)! < 12;

export type Sq1Move = { top: number; bottom: number } | "/";

const mod12 = (n: number) => ((n % 12) + 12) % 12;
/** WCA writes turns from -5 to 6. */
export const wcaTurn = (n: number) => {
  const m = mod12(n);
  return m > 6 ? m - 12 : m;
};

const MOVE_RE = /\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?|\//g;

/** Parse "(1,0) / (-3,0) /" (parentheses and spaces optional). Throws on anything else. */
export function parseSq1(alg: string): Sq1Move[] {
  const moves: Sq1Move[] = [];
  const rest = alg.replace(MOVE_RE, (m, a, b) => {
    moves.push(m === "/" ? "/" : { top: Number(a), bottom: Number(b) });
    return " ";
  });
  if (rest.trim()) throw new Error(`Unknown move "${rest.trim().split(/\s+/)[0]}" in "${alg}"`);
  return moves;
}

/** Merge neighbouring turns, drop (0,0), cancel "/ /", and write it the WCA way. */
export function formatSq1(moves: Sq1Move[]): string {
  const out: Sq1Move[] = [];
  for (const m of moves) {
    const last = out.at(-1);
    if (m === "/") {
      if (last === "/") out.pop();
      else out.push("/");
    } else if (last && last !== "/") {
      out[out.length - 1] = { top: last.top + m.top, bottom: last.bottom + m.bottom };
    } else {
      out.push({ ...m });
    }
    const end = out.at(-1);
    if (end && end !== "/" && mod12(end.top) === 0 && mod12(end.bottom) === 0) {
      out.pop();
      // Dropping (0,0) can leave two slices side by side.
      if (out.at(-1) === "/" && out.at(-2) === "/") out.splice(-2, 2);
    }
  }
  return out.map((m) => (m === "/" ? "/" : `(${wcaTurn(m.top)},${wcaTurn(m.bottom)})`)).join(" ");
}

export const simplifySq1 = (alg: string) => formatSq1(parseSq1(alg));

export const invertSq1 = (alg: string) =>
  formatSq1(
    parseSq1(alg)
      .reverse()
      .map((m) => (m === "/" ? "/" : { top: -m.top, bottom: -m.bottom })),
  );

/**
 * The mirror image, left for right: every turn reversed. Mirroring moves the
 * cut to the other side of the front edge, so the alg is wrapped in the turns
 * that put it back.
 */
export const mirrorSq1 = (alg: string) =>
  formatSq1([
    { top: 1, bottom: -1 },
    ...parseSq1(alg).map((m) => (m === "/" ? ("/" as const) : { top: -m.top, bottom: -m.bottom })),
    { top: -1, bottom: 1 },
  ]);

/** Slices, the usual way to count a Square-1 alg. */
export const sliceCount = (alg: string) => parseSq1(alg).filter((m) => m === "/").length;

/** The moves as they're written, one token each: "(1,0)" and "/". */
export const sq1Tokens = (alg: string) => {
  const text = simplifySq1(alg);
  return text ? text.split(" ") : [];
};

/** True when an alg string is Square-1 notation rather than face turns. */
export const looksSq1 = (alg: string) => /[/,]/.test(alg);

function turnLayer(s: Sq1State, base: number, by: number) {
  const k = mod12(by);
  if (!k) return;
  const old = s.slice(base, base + 12);
  for (let i = 0; i < 12; i++) s[base + ((i + k) % 12)] = old[i];
}

/** A slice can turn: no corner sits across the cut on either layer. */
export function canSlice(s: Sq1State): boolean {
  for (const base of [0, 12]) {
    if (piece(s[base + 11]) === piece(s[base])) return false;
    if (piece(s[base + 5]) === piece(s[base + 6])) return false;
  }
  return true;
}

function slice(s: Sq1State) {
  if (!canSlice(s)) s[BROKEN] = 1;
  const top = s.slice(0, 6);
  for (let k = 0; k < 6; k++) s[k] = s[12 + 5 - k];
  for (let k = 0; k < 6; k++) s[12 + 5 - k] = top[k];
  s[MIDDLE] ^= 1;
}

export function sq1ApplyMoves(state: Sq1State, moves: Sq1Move[]): Sq1State {
  const s = state.slice();
  for (const m of moves) {
    if (m === "/") slice(s);
    else {
      turnLayer(s, 0, m.top);
      // Clockwise seen from below is counterclockwise seen from above.
      turnLayer(s, 12, -m.bottom);
    }
  }
  return s;
}

export const sq1Apply = (state: Sq1State, alg: string) => sq1ApplyMoves(state, parseSq1(alg));

export const sq1Broken = (s: Sq1State) => s[BROKEN] === 1;

// ---------------------------------------------------------------------------
// Checks for each step

const layer = (s: Sq1State, l: 0 | 1) => s.subarray(l * 12, l * 12 + 12);

/** Corner/edge pattern of a layer as a 12-bit mask of corner slots. */
function shapeBits(l: Uint8Array): number {
  let bits = 0;
  for (let i = 0; i < 12; i++) if (isCorner(l[i])) bits |= 1 << i;
  return bits;
}

// The square pattern: corners in two slots then an edge, all the way round, at any of the three offsets.
const square = (l: Uint8Array) => {
  for (let r = 0; r < 3; r++) {
    let ok = true;
    for (let k = 0; k < 12 && ok; k++) ok = isCorner(l[(k + r) % 12]) === (k % 3 !== 2);
    if (ok) return true;
  }
  return false;
};

/** Both layers are squares (cube shape), whatever the middle. */
export const sq1CubeShape = (s: Sq1State) => !sq1Broken(s) && square(layer(s, 0)) && square(layer(s, 1));

/** Every piece on its own layer: top-colour corners (and with `edges`, edges) on top. */
export function sq1Oriented(s: Sq1State, edges: boolean): boolean {
  if (!sq1CubeShape(s)) return false;
  for (let i = 0; i < 24; i++) {
    if (!edges && !isCorner(s[i])) continue;
    if (isTopPiece(s[i]) !== i < 12) return false;
  }
  return true;
}

/** Turn a layer so its pieces of `kind` sit in their home slots, if one turn does it. */
function homeTurn(s: Sq1State, l: 0 | 1, kind: "corners" | "all"): boolean {
  const cur = layer(s, l);
  const home = layer(SOLVED, l);
  for (let r = 0; r < 12; r++) {
    let ok = true;
    for (let i = 0; i < 12 && ok; i++) {
      const v = cur[(i + r) % 12];
      if (kind === "corners" && !isCorner(home[i])) {
        ok = !isCorner(v);
        continue;
      }
      ok = v === home[i];
    }
    if (ok) return true;
  }
  return false;
}

/** Oriented, and each layer's corners in order (some turn of each layer puts them home). */
export const sq1CornersPermuted = (s: Sq1State) => sq1Oriented(s, true) && homeTurn(s, 0, "corners") && homeTurn(s, 1, "corners");

/** Solved up to a turn of each layer, with the middle layer square. */
export const sq1Solved1 = (s: Sq1State) => sq1Oriented(s, true) && s[MIDDLE] === 0 && homeTurn(s, 0, "all") && homeTurn(s, 1, "all");

/** Exactly solved, middle and all. */
export const sq1IsSolved = (s: Sq1State) => !sq1Broken(s) && s.every((v, i) => v === SOLVED[i]);

/** Turns of the top and bottom (multiples of a quarter) that keep the cube shape: the Square-1 AUF. */
export const SQ1_AUFS = [0, 3, 6, -3].flatMap((a) => [0, 3, 6, -3].map((b) => (a || b ? `(${a},${b})` : "")));

/** Every turn of the two layers, for cases that start out of cube shape. */
export const SQ1_ALL_TURNS = Array.from({ length: 144 }, (_, i) => {
  const a = wcaTurn(Math.floor(i / 12));
  const b = wcaTurn(i % 12);
  return a || b ? `(${a},${b})` : "";
});

/**
 * The shape of a state as a key that ignores turns of either layer: the same
 * key means the same cubeshape case.
 */
export function shapeKey(s: Sq1State): string {
  const canon = (l: Uint8Array) => {
    const bits = shapeBits(l);
    let best = bits;
    for (let r = 1; r < 12; r++) best = Math.min(best, ((bits << r) | (bits >>> (12 - r))) & 0xfff);
    return best;
  };
  return `${canon(layer(s, 0))}/${canon(layer(s, 1))}`;
}

// ---------------------------------------------------------------------------
// Drawing

export type Pt = [number, number];

/** One piece of a layer as drawn: its face from above, and its side stickers. */
export type Sq1Piece = {
  /** First slot it fills, clockwise from above. */
  slot: number;
  corner: boolean;
  /** Values in its slots, first slot first. */
  values: number[];
  face: Pt[];
  sides: Pt[][];
};

const R_EDGE = 1 / Math.cos(Math.PI / 12);
const R_CORNER = Math.SQRT2;

/** A point at `deg` clockwise from the back, seen from above (back is up, right is right). */
const polar = (deg: number, r: number): Pt => [r * Math.sin((deg * Math.PI) / 180), -r * Math.cos((deg * Math.PI) / 180)];
const out = ([x, y]: Pt, k: number): Pt => [x * k, y * k];

/**
 * The pieces of one layer (0 top, 1 bottom) laid out in a square of half-side
 * 1, seen from above. Edges are 30° wedges and corners 60° kites, so any shape
 * draws, not just the cube.
 */
export function sq1Layer(s: Sq1State, l: 0 | 1): Sq1Piece[] {
  const slots = layer(s, l);
  const pieces: Sq1Piece[] = [];
  for (let i = 0; i < 12; i++) {
    const v = slots[i];
    const a = 15 + 30 * i;
    if (!isCorner(v)) {
      const p0 = polar(a, R_EDGE);
      const p1 = polar(a + 30, R_EDGE);
      pieces.push({ slot: i, corner: false, values: [v], face: [[0, 0], p0, p1], sides: [[p0, p1, out(p1, 1.16), out(p0, 1.16)]] });
    } else if (piece(slots[(i + 1) % 12]) === piece(v)) {
      const p0 = polar(a, R_EDGE);
      const tip = polar(a + 30, R_CORNER);
      const p1 = polar(a + 60, R_EDGE);
      pieces.push({
        slot: i,
        corner: true,
        values: [v, slots[(i + 1) % 12]],
        face: [[0, 0], p0, tip, p1],
        sides: [
          [p0, tip, out(tip, 1.16), out(p0, 1.16)],
          [tip, p1, out(p1, 1.16), out(tip, 1.16)],
        ],
      });
    }
  }
  return pieces;
}

/**
 * Where the pieces of `kind` go to solve `s`, as [from slot, to slot] for each
 * layer (by first slot). Each layer is solved at the quarter turn that leaves
 * the fewest corners, then edges, to move, the way a PLL picture picks its
 * angle. Only for cube-shaped states with every piece on its own layer.
 */
export function sq1Arrows(s: Sq1State, kind: "corners" | "edges"): [number, number][][] {
  return ([0, 1] as const).map((l) => {
    const cur = layer(s, l);
    let best: [number, number][] = [];
    let bestCost = Infinity;
    for (const k of [0, 3, 6, 9]) {
      const moves: [number, number][] = [];
      let cost = 0;
      for (let i = 0; i < 12; i++) {
        const v = cur[i];
        const corner = isCorner(v);
        if (corner && piece(cur[(i + 1) % 12]) !== piece(v)) continue;
        // A corner's home is the slot its first half fills when solved.
        const target = (HOME.get(corner ? piece(v) * 2 : v)! % 12 + k) % 12;
        if (target === i) continue;
        cost += corner ? 100 : 1;
        if ((kind === "corners") === corner) moves.push([i, target]);
      }
      if (cost < bestCost) [best, bestCost] = [moves, cost];
    }
    return best;
  });
}
