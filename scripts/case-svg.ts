/**
 * Case images for every puzzle but the 3x3 (whose images come from
 * VisualCube), drawn from the simulators so they always match the data. The
 * style follows VisualCube's plan view: the top face from above, a strip of
 * the side stickers around it, grey for stickers that don't matter for the
 * step, and arrows for where pieces go.
 */
import type { Alg } from "../src/data/algs";
import { caseState, engineFor } from "../src/lib/cases";
import { megaAround, megaApply, megaIdentity, megaSlot, MEGA_FACES, type MegaFace } from "../src/lib/megaminx";
import { applyMoves, FACES, identityState, slot, solvedState, type Face } from "../src/lib/nxn";
import { CUBE_SIZE } from "../src/lib/puzzles";

// VisualCube's colours (scheme yrgwob), so these sit well next to the 3x3 images.
const CUBE_COLORS: Record<Face, string> = { U: "#FEFE00", R: "#EE0000", F: "#00D800", D: "#FFFFFF", L: "#FFA100", B: "#0000F2" };
const MEGA_COLORS: Record<MegaFace, string> = {
  U: "#FEFE00",
  F: "#00D800",
  R: "#EE0000",
  L: "#8F3FD6",
  BL: "#FFA100",
  BR: "#1F4FE0",
  DR: "#7FD3FF",
  DL: "#FF7FBF",
  DBL: "#A8E000",
  B: "#F3DDAE",
  DBR: "#006B3C",
  D: "#B5B5B5",
};
const MASK = "#404040";
const BODY = "#000000";
const ARROW = "#333333";

type Pt = [number, number];
type Sticker = { points: Pt[]; fill: string };
type Arrow = { from: Pt; to: Pt; both: boolean };

const fmt = (n: number) => +n.toFixed(4);
const poly = (s: Sticker) =>
  `<polygon fill='${s.fill}' stroke='${BODY}' stroke-width='0.012' stroke-linejoin='round' points='${s.points.map((p) => p.map(fmt).join(",")).join(" ")}'/>`;

/** Shrink a polygon toward its centre so the black body shows between stickers. */
function inset(points: Pt[], amount: number): Pt[] {
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
  return points.map(([x, y]) => [x + (cx - x) * amount, y + (cy - y) * amount]);
}

const center = (points: Pt[]): Pt => [
  points.reduce((s, p) => s + p[0], 0) / points.length,
  points.reduce((s, p) => s + p[1], 0) / points.length,
];

function arrowSvg({ from, to, both }: Arrow, width = 0.028): string {
  // Stop short of the sticker centres so the heads don't cover them.
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const trim = Math.min(0.09, len * 0.2);
  const a: Pt = [from[0] + ux * trim, from[1] + uy * trim];
  const b: Pt = [to[0] - ux * trim, to[1] - uy * trim];
  const head = (tip: Pt, dir: 1 | -1) => {
    const size = 0.07;
    const bx = tip[0] - ux * size * dir;
    const by = tip[1] - uy * size * dir;
    return `<polygon fill='${ARROW}' points='${[tip, [bx - uy * size * 0.55, by + ux * size * 0.55], [bx + uy * size * 0.55, by - ux * size * 0.55]].map((p) => p.map(fmt).join(",")).join(" ")}'/>`;
  };
  const shaftA: Pt = both ? [a[0] + ux * 0.05, a[1] + uy * 0.05] : a;
  const shaftB: Pt = [b[0] - ux * 0.05, b[1] - uy * 0.05];
  return [
    `<line x1='${fmt(shaftA[0])}' y1='${fmt(shaftA[1])}' x2='${fmt(shaftB[0])}' y2='${fmt(shaftB[1])}' stroke='${ARROW}' stroke-width='${width}' stroke-linecap='round'/>`,
    head(b, 1),
    both ? head(a, -1) : "",
  ].join("");
}

/** Arrows for a list of [from, to] moves, drawing a swap as one double-headed arrow. */
function arrowsFor(moves: [Pt, Pt][]): Arrow[] {
  const key = (p: Pt) => p.map(fmt).join(",");
  const out: Arrow[] = [];
  const done = new Set<string>();
  for (const [from, to] of moves) {
    const k = `${key(from)}>${key(to)}`;
    if (done.has(k)) continue;
    const back = moves.some(([f, t]) => key(f) === key(to) && key(t) === key(from));
    done.add(k);
    if (back) done.add(`${key(to)}>${key(from)}`);
    out.push({ from, to, both: back });
  }
  return out;
}

function svg(viewBox: string, body: string[]): string {
  return `<?xml version='1.0' standalone='no'?>\n<svg version='1.1' xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='${viewBox}'>\n${body.join("\n")}\n</svg>\n`;
}

// ---------------------------------------------------------------------------
// Cubes

type Mask = "top" | "full";

/**
 * The top face of an n-cube from above with the side stickers next to it.
 * `view` turns the cube first (x shows the front face, z2 the bottom), and
 * `mirror` flips left and right, to look at the bottom as if through the cube.
 */
function cubePlan(
  n: number,
  colors: ArrayLike<number>,
  ids: ArrayLike<number> | null,
  { mask, view = "", mirror = false, ox = 0, scale = 1, arrows: withArrows = false }: { mask: Mask; view?: string; mirror?: boolean; ox?: number; scale?: number; arrows?: boolean },
): { body: string[]; points: Map<number, Pt> } {
  const viewed = view ? applyMoves(Uint8Array.from(colors), view, n) : colors;
  // Which original slot each viewed slot shows, to place arrows.
  const slots = view ? applyMoves(identityState(n), view, n) : identityState(n);
  const u = FACES.indexOf("U");
  const fill = (c: number) => (mask === "full" || c === u ? CUBE_COLORS[FACES[c]] : MASK);
  const cell = 1 / n;
  const X = (x: number) => ox + (mirror ? -x : x) * scale;
  const Y = (y: number) => y * scale;
  const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
    [X(x0), Y(y0)],
    [X(x1), Y(y0)],
    [X(x1), Y(y1)],
    [X(x0), Y(y1)],
  ];
  const stickers: Sticker[] = [];
  const points = new Map<number, Pt>();
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const i = slot(n, "U", r, c);
      const pts = inset(rect(-0.5 + c * cell, -0.5 + r * cell, -0.5 + (c + 1) * cell, -0.5 + (r + 1) * cell), 0.1);
      stickers.push({ points: pts, fill: fill(viewed[i]) });
      points.set(slots[i], center(pts));
    }
  // Side strips: the top row of each side face, drawn just outside the top face's edge.
  const near = 0.54;
  const far = 0.66;
  for (let i = 0; i < n; i++) {
    const a = -0.5 + i * cell;
    const b = a + cell;
    const sides: [Face, Pt[]][] = [
      ["F", rect(a, near, b, far)],
      ["B", rect(-b, -far, -a, -near)],
      ["R", rect(near, -a, far, -b)],
      ["L", rect(-far, a, -near, b)],
    ];
    for (const [face, pts] of sides) stickers.push({ points: inset(pts, 0.12), fill: fill(viewed[slot(n, face, 0, i)]) });
  }
  const body = [`<polygon fill='${BODY}' points='${rect(-0.52, -0.52, 0.52, 0.52).map((p) => p.map(fmt).join(",")).join(" ")}'/>`, ...stickers.map(poly)];
  if (withArrows && ids) {
    // Where each top sticker goes: the corners, and on each edge the first wing that moves.
    const moves: [Pt, Pt][] = [];
    const add = (r: number, c: number) => {
      const from = slot(n, "U", r, c);
      const to = Array.prototype.indexOf.call(ids, from);
      if (to === from || !points.has(to)) return false;
      moves.push([points.get(from)!, points.get(to)!]);
      return true;
    };
    for (const [r, c] of [[0, 0], [0, n - 1], [n - 1, 0], [n - 1, n - 1]]) add(r, c);
    const edges: ((i: number) => [number, number])[] = [(i) => [0, i], (i) => [n - 1, i], (i) => [i, 0], (i) => [i, n - 1]];
    for (const cell of edges) for (let i = 1; i < n - 1; i++) if (add(...cell(i))) break;
    body.push(...arrowsFor(moves).map((a) => arrowSvg(a, 0.028 * scale)));
  }
  return { body, points };
}

/** Does the case show on the top layer? Edge pairing in the middle layer shows from the front instead. */
function touchesTop(n: number, state: Uint8Array): boolean {
  const solved = solvedState(n);
  const top = [...Array(n * n).keys()].map((i) => slot(n, "U", Math.floor(i / n), i % n));
  for (const f of ["F", "R", "B", "L"] as const) for (let c = 0; c < n; c++) top.push(slot(n, f, 0, c));
  return top.some((i) => state[i] !== solved[i]);
}

function cubeCase(alg: Alg): string {
  const n = CUBE_SIZE[alg.puzzle]!;
  const state = caseState(alg) as Uint8Array;
  // Where each sticker goes when the reference algorithm solves the case.
  const ids = applyMoves(identityState(n), alg.algs[0], n);
  const solvesToSolved = engineFor(alg).after.length > 1;
  if (alg.set === "2x2-PBL") {
    // Both layers: the top from above, the bottom as seen through the cube from above.
    const top = cubePlan(n, state, ids, { mask: "full", ox: -0.47, scale: 0.62, arrows: true });
    const bottom = cubePlan(n, state, null, { mask: "full", view: "z2", mirror: true, ox: 0.47, scale: 0.62 });
    const arrows = bottomArrows(n, ids, bottom.points);
    return svg("-0.9 -0.9 1.8 1.8", [...top.body, ...bottom.body, ...arrows]);
  }
  const mask: Mask = alg.set === "2x2-OLL" || alg.group === "OLL parity" ? "top" : "full";
  const view = touchesTop(n, state) ? "" : "x";
  const plan = cubePlan(n, state, ids, { mask, view, arrows: solvesToSolved && !view });
  return svg("-0.9 -0.9 1.8 1.8", plan.body);
}

/** PBL: arrows for the bottom corners, placed on the bottom panel. */
function bottomArrows(n: number, ids: Int32Array, points: Map<number, Pt>): string[] {
  const corners = [slot(n, "D", 0, 0), slot(n, "D", 0, n - 1), slot(n, "D", n - 1, 0), slot(n, "D", n - 1, n - 1)];
  const moves: [Pt, Pt][] = [];
  for (const from of corners) {
    const to = ids.indexOf(from);
    if (to !== from && points.has(from) && points.has(to)) moves.push([points.get(from)!, points.get(to)!]);
  }
  return arrowsFor(moves).map((a) => arrowSvg(a, 0.028 * 0.62));
}

// ---------------------------------------------------------------------------
// Megaminx

const PENT_R = 0.5;
// Each side of the top pentagon, starting with the one shared with F at the bottom and going clockwise.
const vertexAt = (k: number): Pt => {
  // Bottom edge horizontal: vertices at 54° and 126° below the centre (y grows down).
  const a = ((54 + 72 * k) * Math.PI) / 180;
  return [PENT_R * Math.cos(a), PENT_R * Math.sin(a)];
};

const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function megaCase(alg: Alg): string {
  const state = caseState(alg) as Uint8Array;
  const ids = megaApply(megaIdentity(), alg.algs[0]);
  const u = MEGA_FACES.indexOf("U");
  // Neighbours of U clockwise from F, matching the drawing's sides clockwise from the bottom.
  const around = megaAround("U");
  const ring = [...around.slice(around.indexOf("F")), ...around.slice(0, around.indexOf("F"))];

  const show = (i: number, kind: "center" | "edge" | "corner", side: boolean): string => {
    const c = state[i];
    const color = MEGA_COLORS[MEGA_FACES[c]];
    switch (alg.set) {
      case "mega-EO":
        return kind !== "corner" && c === u ? color : kind === "center" ? color : MASK;
      case "mega-CO":
        return c === u ? color : MASK;
      case "mega-EP":
        return !side ? MEGA_COLORS.U : kind === "edge" ? color : MASK;
      default:
        return !side ? MEGA_COLORS.U : color;
    }
  };

  // The outer pentagon's vertices, clockwise from the bottom-right one: side k runs from V[k] to V[k+1].
  // Clockwise on screen from the bottom edge: bottom (F), left (L), …
  const V = [0, 1, 2, 3, 4].map((k) => vertexAt(k));
  // Side k (0 = bottom/F) runs between V[k] and V[k + 1].
  const t = 0.3; // where the cuts meet each side, as a fraction from either end
  const inner = 0.42; // centre pentagon size
  const C = V.map((v) => [v[0] * inner, v[1] * inner] as Pt);
  const stickers: Sticker[] = [];
  // Centre of each top-face sticker, and which kind of piece it's on, for the arrows.
  const pointOf = new Map<number, { at: Pt; kind: "center" | "edge" | "corner" }>();
  const add = (i: number, points: Pt[], kind: "center" | "edge" | "corner", side = false) => {
    const pts = inset(points, side ? 0.16 : 0.1);
    stickers.push({ points: pts, fill: show(i, kind, side) });
    if (!side) pointOf.set(i, { at: center(pts), kind });
  };
  add(megaSlot("U", ["U"]), C, "center");
  for (let k = 0; k < 5; k++) {
    const a = V[k];
    const b = V[(k + 1) % 5];
    const g = ring[k];
    const prev = ring[(k + 4) % 5];
    const next = ring[(k + 1) % 5];
    // Edge sticker of side k: between the two cut points and the centre's side.
    const e0 = lerp(a, b, t);
    const e1 = lerp(a, b, 1 - t);
    add(megaSlot("U", ["U", g]), [e0, e1, C[(k + 1) % 5], C[k]], "edge");
    // Corner sticker at V[k] (between sides k-1 and k).
    const prevSide = lerp(V[(k + 4) % 5], a, 1 - t);
    add(megaSlot("U", ["U", prev, g]), [a, e0, C[k], prevSide], "corner");
    // Side strip outside side k: corner, edge, corner of face g.
    const out = (p: Pt, d: number): Pt => {
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const len = Math.hypot(mx, my);
      return [p[0] + (mx / len) * d, p[1] + (my / len) * d];
    };
    const n0 = 0.05;
    const n1 = 0.16;
    const strip = (p: Pt, q: Pt): Pt[] => [out(p, n0), out(q, n0), out(q, n1), out(p, n1)];
    add(megaSlot(g, ["U", prev, g]), strip(a, e0), "corner", true);
    add(megaSlot(g, ["U", g]), strip(e0, e1), "edge", true);
    add(megaSlot(g, ["U", g, next]), strip(e1, b), "corner", true);
  }
  const outline = V.map((p) => [p[0] * 1.04, p[1] * 1.04].map(fmt).join(",")).join(" ");
  const body = [`<polygon fill='${BODY}' stroke='${BODY}' stroke-width='0.03' stroke-linejoin='round' points='${outline}'/>`, ...stickers.map(poly)];
  if (alg.set === "mega-EP" || alg.set === "mega-CP") {
    // Arrows for the pieces this step moves: edges for EP, corners for CP.
    const kind = alg.set === "mega-EP" ? "edge" : "corner";
    const moves: [Pt, Pt][] = [];
    for (const [from, p] of pointOf) {
      const to = ids.indexOf(from);
      if (p.kind !== kind || to === from || !pointOf.has(to)) continue;
      moves.push([p.at, pointOf.get(to)!.at]);
    }
    body.push(...arrowsFor(moves).map((a) => arrowSvg(a)));
  }
  return svg("-0.9 -0.9 1.8 1.8", body);
}

/** The SVG for a case, or null for the 3x3 (VisualCube draws those). */
export function caseSvg(alg: Alg): string | null {
  if (alg.puzzle === "3x3") return null;
  if (alg.puzzle === "megaminx") return megaCase(alg);
  return cubeCase(alg);
}
