"use client";

import { colorOf, faceOf, type Face, type Sticker } from "@/lib/cube";
import { isF2LTargetSticker, type F2LSlot } from "@/lib/f2l-trainer";
import { useStickers } from "@/components/timer/scramble-net";

const LAYOUT: [Face, number, number][] = [["U", 1, 0], ["L", 0, 1], ["F", 1, 1], ["R", 2, 1], ["B", 3, 1], ["D", 1, 2]];

function cell(s: Sticker, face: Face): [number, number] {
  const [x, y, z] = s.pos;
  switch (face) {
    case "U": return [x + 1, z + 1];
    case "D": return [x + 1, 1 - z];
    case "F": return [x + 1, 1 - y];
    case "B": return [1 - x, 1 - y];
    case "R": return [1 - z, 1 - y];
    case "L": return [z + 1, 1 - y];
  }
}

/** Trainer hold: yellow U / white D / green F in the standard palette. Target marks follow piece identity. */
export function F2LCubeState({ state, slot }: { state: Sticker[]; slot: F2LSlot }) {
  const stickers = useStickers();
  return (
    <svg viewBox="-0.15 -0.65 13.6 11.25" className="mx-auto w-full max-w-md" role="img" aria-label="Cube unfolded: U above F, L on the left, R and B on the right, D below. Dots mark your target corner and edge.">
      {LAYOUT.map(([face, col, row]) => (
        <g key={face} transform={`translate(${col * 3.4} ${row * 3.7})`}>
          <text x={1.5} y={-0.15} textAnchor="middle" className="fill-muted-foreground font-sans text-[0.32px] font-semibold">{face}</text>
          {state.filter((s) => faceOf(s.normal) === face).map((s) => {
            const [x, y] = cell(s, face);
            const target = isF2LTargetSticker(s, slot);
            return (
              <g key={s.id}>
                <rect x={x + 0.04} y={y + 0.04} width={0.92} height={0.92} rx={0.07} fill={stickers[colorOf(s)]} className="stroke-foreground/30" strokeWidth={0.035} />
                {target && <>
                  <circle cx={x + 0.5} cy={y + 0.5} r={0.15} className="fill-background" />
                  <circle cx={x + 0.5} cy={y + 0.5} r={0.09} className="fill-foreground" />
                </>}
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}
