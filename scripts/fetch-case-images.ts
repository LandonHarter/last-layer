/**
 * Downloads a top-down case image for every algorithm from the VisualCube API
 * into public/cases/{id}.svg. Run once (or after editing algs):
 *   bun scripts/fetch-case-images.ts [--force]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ALGS } from "../src/data/algs";
import { topStickerMoves } from "../src/lib/cube";

const OUT = join(import.meta.dir, "..", "public", "cases");
const API = "https://visualcube.api.cubing.net/";
const force = process.argv.includes("--force");

mkdirSync(OUT, { recursive: true });

function urlFor(alg: (typeof ALGS)[number]): string {
  const params = new URLSearchParams({
    fmt: "svg",
    size: "240",
    pzl: "3",
    bg: "t",
    // Yellow top, green front, red right: the way you hold the cube for setups.
    sch: "yrgwob",
    stage: alg.set.toLowerCase(),
    case: alg.algs[0],
  });
  // Last-layer cases are drawn from above; F2L from the front-right corner so the slot shows.
  if (alg.set !== "F2L") params.set("view", "plan");
  if (alg.set === "PLL") {
    const arrows = topStickerMoves(alg.algs[0]).map(([from, to]) => `U${from}U${to}`);
    params.set("arw", arrows.join(","));
    params.set("ac", "333333");
  }
  return `${API}?${params}`;
}

let fetched = 0;
for (const alg of ALGS) {
  const file = join(OUT, `${alg.id}.svg`);
  if (existsSync(file) && !force) continue;
  const res = await fetch(urlFor(alg));
  const body = await res.text();
  if (!res.ok || !body.includes("<svg")) {
    throw new Error(`${alg.id}: ${res.status} ${body.slice(0, 200)}`);
  }
  writeFileSync(file, body);
  fetched++;
  console.log(`saved ${alg.id}`);
}
console.log(`done: ${fetched} fetched, ${ALGS.length - fetched} already present`);
