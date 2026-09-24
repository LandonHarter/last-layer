import { ALGS, type Alg } from "@/data/algs";
import { applyAlg, solvedCube, type Sticker } from "./cube";
import { AUFS, setupWorks } from "./cases";
import { invertAlg, moveCount, simplifyAlg } from "./notation";

type Random = () => number;

const pick = <T>(list: readonly T[], random: Random): T => list[Math.floor(random() * list.length)];

const bank = (set: Alg["set"]) => ALGS.filter((a) => a.set === set).flatMap((a) => a.algs);

/** Undoing an alternative, not the one you drill with, so the setup doesn't spell out the answer. */
function otherAlg(target: Alg, main: string, random: Random): string {
  const others = target.algs.filter((a) => a !== main);
  return pick(others.length ? others : target.algs, random);
}

const fingerprint = (state: Sticker[]) => state.map((s) => `${s.pos}${s.normal}`).join("|");

/**
 * PLL: find two other PLLs that together make this case, so the setup has
 * nothing to do with any algorithm for it.
 */
function pllFromPair(target: Alg, main: string, random: Random): string | null {
  // Setups that work are exactly: a turn of the top, the main undone, a turn of the top.
  const undo = invertAlg(main);
  const goals = new Set(AUFS.flatMap((a) => AUFS.map((b) => fingerprint(applyAlg(solvedCube(), `${a} ${undo} ${b}`)))));
  const others = ALGS.filter((a) => a.set === "PLL" && a.id !== target.id);
  const hits: string[] = [];
  for (let i = 0; i < 600 && hits.length < 4; i++) {
    const first = invertAlg(pick(pick(others, random).algs, random));
    const second = invertAlg(pick(pick(others, random).algs, random));
    const setup = `${pick(AUFS, random)} ${first} ${pick(AUFS, random)} ${second} ${pick(AUFS, random)}`;
    if (goals.has(fingerprint(applyAlg(solvedCube(), setup)))) hits.push(simplifyAlg(setup));
  }
  // Keep the shortest of the few found.
  return hits.sort((a, b) => moveCount(a) - moveCount(b))[0] ?? null;
}

/**
 * Moves that set up `target` from a solved cube, for someone who solves it
 * with `main`. Every setup is checked with the simulator.
 *
 * - F2L: a random last-layer algorithm scrambles the top, then an alternative
 *   for the case is undone.
 * - OLL: a random PLL scrambles the top's pieces, then an alternative is undone.
 * - PLL: two other PLLs that combine into the case, else an undone alternative.
 */
export function makeSetup(target: Alg, main: string, random: Random = Math.random): string {
  const auf = () => pick(AUFS, random);
  const attempts: (() => string | null)[] = [];
  if (target.set === "PLL") {
    attempts.push(() => pllFromPair(target, main, random));
  } else {
    const noise = target.set === "OLL" ? bank("PLL") : [...bank("OLL"), ...bank("PLL")];
    attempts.push(() => `${auf()} ${pick(noise, random)} ${auf()} ${invertAlg(otherAlg(target, main, random))} ${auf()}`);
  }
  attempts.push(() => `${auf()} ${invertAlg(otherAlg(target, main, random))} ${auf()}`);

  for (const attempt of attempts) {
    for (let i = 0; i < 5; i++) {
      const raw = attempt();
      if (!raw) break;
      const setup = simplifyAlg(raw);
      if (setup && setupWorks(target.set, setup, main)) return setup;
    }
  }
  return simplifyAlg(invertAlg(main));
}
