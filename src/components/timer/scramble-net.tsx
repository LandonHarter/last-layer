"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import type { Face } from "@/lib/cube";
import { cubeSize, scrambledNetN, type TimerPuzzle } from "@/lib/scramble";
import { sq1Apply, sq1Broken, sq1Colors, sq1Layer, sq1Solved, type Pt } from "@/lib/sq1";
import { themeById, type StickerSet } from "@/lib/themes";

const useMounted = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

// Scrambles are applied white on top, green in front (WCA). The palettes are named
// for the trainer's yellow-top view, so swap the U and D colors.
export const WCA_COLOR: Record<Face, keyof StickerSet> = { U: "D", D: "U", F: "F", B: "B", R: "R", L: "L" };

/** The current theme's sticker colors (the default theme's until mounted). */
export function useStickers(): StickerSet {
  const { theme } = useTheme();
  const mounted = useMounted();
  return themeById(mounted ? theme : undefined).stickers;
}

// Where each face sits in the unfolded cross, in face-sized cells.
const LAYOUT: [Face, number, number][] = [
  ["U", 1, 0],
  ["L", 0, 1],
  ["F", 1, 1],
  ["R", 2, 1],
  ["B", 3, 1],
  ["D", 1, 2],
];

/** The scrambled cube as an unfolded net (a Square-1 as its two layers), in the current theme's sticker colors. Other puzzles draw nothing. */
export function ScrambleNet({ scramble, puzzle = "3x3", className }: { scramble: string; puzzle?: TimerPuzzle; className?: string }) {
  if (puzzle === "sq1") return <Sq1Scramble scramble={scramble} className={className} />;
  return <CubeNet scramble={scramble} puzzle={puzzle} className={className} />;
}

const points = (pts: Pt[]) => pts.map((p) => p.map((n) => +n.toFixed(3)).join(",")).join(" ");

/** Shrink a polygon toward its centre so the body shows between stickers. */
function inset(pts: Pt[], amount: number): Pt[] {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, y]) => [x + (cx - x) * amount, y + (cy - y) * amount]);
}

/**
 * A scrambled Square-1: the top layer seen from above, the bottom seen from
 * below (turned over left to right, so the front stays at the bottom), and the
 * middle layer from the front, square when both halves show one colour.
 */
function Sq1Scramble({ scramble, className }: { scramble: string; className?: string }) {
  const stickers = useStickers();
  const state = useMemo(() => {
    try {
      const s = sq1Apply(sq1Solved(), scramble);
      return sq1Broken(s) ? null : s;
    } catch {
      return null;
    }
  }, [scramble]);
  if (!state) return null;
  const color = (face: Face) => stickers[WCA_COLOR[face]];
  return (
    <svg viewBox="-3.4 -1.75 6.8 4.1" className={className} role="img" aria-label="Scrambled Square-1: top layer, bottom layer and middle">
      {([0, 1] as const).map((l) => (
        <g key={l} transform={`translate(${l === 0 ? -1.7 : 1.7} 0) scale(${l === 0 ? 1 : -1} 1)`}>
          {sq1Layer(state, l).map((p) => (
            <g key={p.slot}>
              <polygon points={points(p.face)} className="fill-muted" />
              {p.sides.map((side, i) => (
                <polygon
                  key={i}
                  points={points(inset(side, 0.14))}
                  fill={color(sq1Colors(p.values[i]).side)}
                  className="stroke-foreground/25"
                  strokeWidth={0.02}
                />
              ))}
              <polygon
                points={points(inset(p.face, 0.1))}
                fill={color(sq1Colors(p.values[0]).face)}
                className="stroke-foreground/25"
                strokeWidth={0.02}
                style={{ transition: "fill 200ms ease" }}
              />
            </g>
          ))}
        </g>
      ))}
      <g transform="translate(0 2)">
        <rect x={-1.3} y={-0.06} width={2.6} height={0.38} rx={0.06} className="fill-muted" />
        <rect x={-1.22} y={0.02} width={1.17} height={0.22} rx={0.04} fill={color("F")} className="stroke-foreground/25" strokeWidth={0.02} />
        <rect x={0.05} y={0.02} width={1.17} height={0.22} rx={0.04} fill={color(state[24] ? "B" : "F")} className="stroke-foreground/25" strokeWidth={0.02} />
      </g>
    </svg>
  );
}

function CubeNet({ scramble, puzzle, className }: { scramble: string; puzzle: TimerPuzzle; className?: string }) {
  const stickers = useStickers();
  const n = cubeSize(puzzle);
  const net = useMemo(() => (scramble && n ? scrambledNetN(scramble, n) : null), [scramble, n]);
  if (!net || !n) return null;

  const cell = 3 / n;
  const gap = 0.07 * cell * 2;
  const face = 3 + 0.3;
  return (
    <svg viewBox={`-0.1 -0.1 ${4 * face + 0.1} ${3 * face + 0.1}`} className={className} role="img" aria-label="Scrambled cube, unfolded">
      {LAYOUT.map(([f, col, row]) => (
        <g key={f} transform={`translate(${col * face} ${row * face})`}>
          <rect width={3.1} height={3.1} x={-0.05} y={-0.05} rx={0.2} className="fill-muted" />
          {net[f].map((color, i) => (
            <rect
              key={i}
              x={(i % n) * cell + gap / 2}
              y={Math.floor(i / n) * cell + gap / 2}
              width={cell - gap}
              height={cell - gap}
              rx={gap}
              fill={stickers[WCA_COLOR[color]]}
              // A faint edge so white stickers read on light themes.
              className="stroke-foreground/25"
              strokeWidth={0.04 * Math.min(1, cell)}
              style={{ transition: "fill 200ms ease" }}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}
