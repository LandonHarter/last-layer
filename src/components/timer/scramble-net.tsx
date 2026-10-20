"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import type { Face } from "@/lib/cube";
import { cubeSize, scrambledNetN, type TimerPuzzle } from "@/lib/scramble";
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

/** The scrambled cube as an unfolded net, in the current theme's sticker colors. Other puzzles draw nothing. */
export function ScrambleNet({ scramble, puzzle = "3x3", className }: { scramble: string; puzzle?: TimerPuzzle; className?: string }) {
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
