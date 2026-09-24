# Last Layer

A trainer for memorizing Rubik's cube F2L (41), OLL (57) and PLL (21) algorithms, plus a speedcubing timer. Each case has several algorithms; you pick your main one or add your own. The header switches between Algorithms mode (Library, Learn, Drill) and Timer mode (Timer); Analyze charts and tests the data of either. It is built with Next 16 (App Router), React 19, Tailwind 4, shadcn (base-nova / Base UI) and bun. There is no backend: progress, solves and the drill log are kept in `localStorage`. The header's backup button saves all of it to one file and loads it in another browser (`src/lib/backup.ts`).

UI design, tokens and themes are documented in [DESIGN.md](./DESIGN.md). Read it before changing any UI.

## Commands

- `bun dev`: start the dev server
- `bun run build`: production build
- `bun test`: run the tests (algorithm data is checked with a cube simulator, plus scheduler behaviour, stats and scrambles)
- `bunx tsc --noEmit`: typecheck
- `bun run fetch-images [--force]`: download case SVGs from VisualCube into `public/cases/`

## Layout

- `src/data/algs.ts`: algorithm data (id, set, name, group, algs). Ids look like `f2l-5`, `oll-21` or `pll-t`. `algs[0]` is the default main and the reference the case image and all checks use. F2L cases are for the front-right slot.
- `src/lib/notation.ts`: parse, invert, simplify and mirror algorithms
- `src/lib/cases.ts`: `fitAlg` checks whether an alg solves a case and adds the turn of the top it needs (used by the tests and for custom algs), `setupWorks`
- `src/lib/setup.ts`: `makeSetup` builds drill setups (face turns only, via `faceTurnsOnly` in `notation.ts`) that are not the inverse of your main: a random LL alg or PLL plus an undone alternative (F2L, OLL), or two other PLLs that combine into the case (PLL). Every setup is checked with the simulator.
- `src/lib/cube.ts`: sticker-level 3x3 simulator, used by the tests and for PLL arrows
- `src/lib/progress.ts`: `useProgress()` store (`useSyncExternalStore` over localStorage key `last-layer:progress:v1`). An entry also holds `main` (chosen alg) and `custom` (your own algs); read the main with `mainAlg()`.
- `src/lib/store.ts`: `createStore(key, fallback)`, the localStorage + `useSyncExternalStore` pattern used by the stores below
- `src/lib/solves.ts`: timer solves (optionally tagged with an `oll`/`pll` case id via `setSolveCase`) and sessions (`last-layer:timer:v1`), timer settings, the drill log (`last-layer:drill-log:v1`, one entry per drill answer), `effectiveMs` (+2 adds 2 s, DNF is `Infinity`) and `formatMs`
- `src/lib/mode.ts`: Algorithms/Timer mode (`last-layer:mode:v1`); pages of one mode set it, Analyze follows it
- `src/lib/stats.ts`: WCA averages (aoN trims 1 each end up to ao12, 5% above; too many DNFs make a DNF), outlier rules, normal/t distributions, Shapiro-Wilk, regression, Welch t-test, histograms
- `src/lib/scramble.ts`: random-move scrambles (face turns only, no repeated face, no R L R) and the unfolded net for the preview
- `src/lib/learn.ts`: Learn mode (`last-layer:learn:v1`): suggested batches (`planBatches`), per-case stage (pick, study, recall) and streak, and `nextTask`, which only brings in a new case once the shaky ones have a clean recall
- `src/lib/triggers.ts`: `chunkAlg` splits an alg into named triggers (Sune, sexy move, …) and short chunks; `describeAlg` and `memoryTips` (mirror/inverse relations, repeated triggers)
- `src/lib/scheduler.ts`: weighted pick for drills (In progress weighs 6, Learned 1, and a miss streak boosts the weight)
- `src/lib/themes.ts`: theme list and sticker palettes for the picker
- `src/app/timer`, `src/app/analyze`: timer and analysis pages (bodies in `src/components/timer/` and `src/components/analyze/`)
- `src/app/algs/[id]`: case page (all algorithms, pick main, add your own, practice setup)
- `src/components/`: page views, theme picker, cube art, and alg components; shadcn primitives live in `ui/`

## Conventions

- Import `cn` from `@/lib/utils`.
- Colors come only from theme tokens (`bg-learning`, `text-missed`, …). Never hard-code hex values in components. The exception is sticker palettes in `themes.ts`. Chart series use `--chart-1` to `--chart-4`.
- Adding a theme means changing three places: a CSS block in `globals.css` (including `--chart-*`), an entry in `THEMES`, and the `dark` custom variant if the theme is dark.
- After editing an algorithm, run `bun test`. If you changed `algs[0]`, run `bun run fetch-images --force` too so its image matches.
- Alternatives must solve the case exactly as pictured, so include any turn of the top they need first (`fitAlg` works it out). A test checks every one.
- Algorithms must end with the cube held the same way they started (no net `x`/`y`/`z` rotation). A test enforces this.
- Copy uses sentence case and the same status words everywhere: "Don't know", "In progress", "Learned".
