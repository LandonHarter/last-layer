import type { StickerSet } from "@/lib/themes";

type FaceKey = keyof StickerSet;

// A lightly scrambled look so previews read as a real cube, not a flag.
const TOP: FaceKey[] = ["U", "U", "R", "U", "U", "U", "F", "U", "U"];
const FRONT: FaceKey[] = ["F", "L", "F", "F", "F", "F", "F", "F", "D"];
const RIGHT: FaceKey[] = ["R", "R", "U", "R", "R", "R", "B", "R", "R"];

// Isometric projection of cube-space (x right, y up, z toward viewer).
const COS = Math.cos(Math.PI / 6);
const project = (x: number, y: number, z: number) => [(x - z) * COS, (x + z) * 0.5 - y] as const;

function quad(points: [number, number, number][], inset = 0.1): string {
  // Shrink each sticker toward its centre so the black body shows between them.
  const cx = points.reduce((s, p) => s + p[0], 0) / 4;
  const cy = points.reduce((s, p) => s + p[1], 0) / 4;
  const cz = points.reduce((s, p) => s + p[2], 0) / 4;
  return points
    .map(([x, y, z]) => project(x + (cx - x) * inset * 2, y + (cy - y) * inset * 2, z + (cz - z) * inset * 2).join(","))
    .join(" ");
}

function faceStickers(face: "top" | "front" | "right") {
  const cells: [number, number, number][][] = [];
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++) {
      if (face === "top") {
        // row 0 = back
        const x = col, z = row;
        cells.push([[x, 3, z], [x + 1, 3, z], [x + 1, 3, z + 1], [x, 3, z + 1]]);
      } else if (face === "front") {
        const x = col, y = 3 - row;
        cells.push([[x, y, 3], [x + 1, y, 3], [x + 1, y - 1, 3], [x, y - 1, 3]]);
      } else {
        const z = 2 - col, y = 3 - row;
        cells.push([[3, y, z + 1], [3, y, z], [3, y - 1, z], [3, y - 1, z + 1]]);
      }
    }
  return cells;
}

const OUTLINE = [
  [0, 3, 0], [3, 3, 0], [3, 0, 0], [3, 0, 3], [0, 0, 3], [0, 3, 3],
].map(([x, y, z]) => project(x, y, z).join(",")).join(" ");

/** Three-face isometric cube in a given sticker palette. */
export function IsoCube({ stickers, className }: { stickers: StickerSet; className?: string }) {
  const faces: ["top" | "front" | "right", FaceKey[]][] = [
    ["top", TOP],
    ["front", FRONT],
    ["right", RIGHT],
  ];
  return (
    <svg viewBox="-2.8 -3.3 5.6 6.4" className={className} aria-hidden="true">
      <polygon points={OUTLINE} fill="#0a0a0a" stroke="#0a0a0a" strokeWidth={0.12} strokeLinejoin="round" />
      {faces.map(([face, colors]) =>
        faceStickers(face).map((pts, i) => (
          <polygon
            key={`${face}-${i}`}
            points={quad(pts)}
            fill={stickers[colors[i]]}
            style={{ transition: "fill 320ms ease", transitionDelay: `${i * 28}ms` }}
          />
        )),
      )}
    </svg>
  );
}

/** Flat 3x3 face, used as the compact theme button. */
export function FlatFace({ stickers, className }: { stickers: StickerSet; className?: string }) {
  const pattern: FaceKey[] = ["U", "R", "U", "F", "U", "B", "U", "L", "U"];
  return (
    <svg viewBox="0 0 3.3 3.3" className={className} aria-hidden="true">
      <rect width="3.3" height="3.3" rx="0.35" fill="#0a0a0a" />
      {pattern.map((k, i) => (
        <rect
          key={i}
          x={0.15 + (i % 3) * 1.02}
          y={0.15 + Math.floor(i / 3) * 1.02}
          width="0.94"
          height="0.94"
          rx="0.16"
          fill={stickers[k]}
          // Diagonal ripple when the palette changes.
          style={{ transition: "fill 300ms ease", transitionDelay: `${((i % 3) + Math.floor(i / 3)) * 60}ms` }}
        />
      ))}
    </svg>
  );
}
