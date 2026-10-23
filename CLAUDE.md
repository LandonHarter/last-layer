# Last Layer

A trainer for memorizing Rubik's cube F2L (41), OLL (57) and PLL (21) algorithms, plus 2x2 Ortega (OLL, PBL), 4x4 to 7x7 parity and edge cases, the megaminx 4-look last layer (EO, CO, EP, CP) and the Square-1 (all 169 cubeshape cases, CO, EO, CP, EP, parity), a speedcubing timer, and a Tools page (blindfolded memo and quiz, fewest moves practice, a 3x3 solver, scramble sheets, an algorithm toolkit, an average calculator). Library, Learn and Drill share one puzzle choice (`last-layer:puzzle:v1`, `src/lib/puzzle-choice.ts`); each timer session has its own puzzle (2x2 to 7x7, megaminx, pyraminx, skewb, Square-1). Each case has several algorithms; you pick your main one or add your own. The header switches between Algorithms mode (Library, Learn, Drill) and Timer mode (Timer); Analyze charts and tests the data of either, and Tools sits in both. It is built with Next 16 (App Router), React 19, Tailwind 4, shadcn (base-nova / Base UI), bun, Prisma 7 (Postgres on Neon) and Better Auth (Google sign-in). Signed out, progress, solves and the drill log are kept in `localStorage`; signed in, they live in the database and localStorage is not touched (`src/lib/storage.ts`). A new account is offered to load a backup file or this browser's data. The header's backup button saves all of it to one file and loads it elsewhere (`src/lib/backup.ts`).

UI design, tokens and themes are documented in [DESIGN.md](./DESIGN.md). Read it before changing any UI.

## Commands

- `bun dev`: start the dev server
- `bun run build`: production build
- `bun test`: run the tests (algorithm data is checked with a cube simulator, plus scheduler behaviour, stats and scrambles)
- `bunx tsc --noEmit`: typecheck
- `bun run db:migrate`: create and apply a migration after editing `prisma/schema.prisma` (`db:deploy` applies them in production; `postinstall` runs `prisma generate`)
- `bun run fetch-images [--force]`: write case SVGs into `public/cases/` (3x3 from VisualCube, other puzzles drawn locally)

## Layout

- `src/data/algs.ts`: algorithm data (id, puzzle, set, name, group, algs). 3x3 ids look like `f2l-5`, `oll-21` or `pll-t`; other puzzles' cases live in `src/data/puzzle-algs.ts` (`2x2-pbl-adj-top`, `4x4-oll-parity`, `mega-co-5`) and `src/data/sq1-algs.ts` (`sq1-cs-kite-kite`, `sq1-ep-ua-solved`). `algs[0]` is the default main and the reference the case image and all checks use. F2L cases are for the front-right slot.
- `src/lib/puzzles.ts`: puzzles, sets (`SET_INFO`: puzzle, label, title), notation per set, and per-puzzle copy (how to hold it, headlines)
- `src/lib/nxn.ts`: colour-based simulator for any cube 2x2 to 7x7 (big-cube centres and wings look alike, so states compare by colour). `src/lib/megaminx.ts`: megaminx simulator and `megaWithoutRotations`
- `src/lib/sq1.ts`: Square-1 simulator (12 slots per layer, the slice swaps top slot k with bottom slot 5-k; a slice blocked by a corner marks the state broken), its notation (`(1,0) / (-1,0)`, WCA style; `parseAlg(alg, "sq1")`, moves count slices), the checks for each step, drawing geometry (`sq1Layer`, `sq1Arrows`) and `shapeKey`. Solved, the cut is just left of the front edge, so `(1,0) /` and `(0,-1) /` keep the cube shape.
- Big-cube notation: `Rw` and `r` turn two layers, `3Rw` three, `2R` and `3R` one inner slice. Megaminx: `R2` is two fifths clockwise, `R2'` two fifths back (`parseAlg(alg, "megaminx")`).
- `src/lib/notation.ts`: parse, invert, simplify and mirror algorithms
- `src/lib/cases.ts`: `engineFor(case)` picks the simulator, the goal of the step and the turns allowed before and after (2x2 PBL also turns the bottom; big-cube OLL parity ends reduced, other big-cube cases end solved; Square-1 checks allow any turn of the layers at the end, and cubeshape cases any turn first). `fitAlg(case, alg)` checks whether an alg solves a case and adds the turn of the top it needs (used by the tests and for custom algs), `setupWorks`
- `src/lib/setup.ts`: `makeSetup` builds drill setups that are not the inverse of your main: an alg from a later step plus an undone alternative (F2L, OLL, 2x2 OLL, megaminx EO to EP, big-cube OLL parity), or two other cases that combine into it (PLL, PBL, CP, other big-cube cases). 3x3 and 2x2 setups are face turns only (`faceTurnsOnly`); other puzzles have rotations taken out. Every setup is checked with the simulator.
- `src/lib/cube.ts`: sticker-level 3x3 simulator, used by the tests and for PLL arrows
- `scripts/case-svg.ts`: draws every non-3x3 case image from the simulators (VisualCube-style plan view, arrows for cases that end solved); a test checks the files in `public/cases/` match
- `src/lib/progress.ts`: `useProgress()` store (`useSyncExternalStore` over localStorage key `last-layer:progress:v1`). An entry also holds `main` (chosen alg), `custom` (your own algs) and `notes` (shown as the Drill hint); read the main with `mainAlg()`.
- `src/lib/store.ts`: `createStore(key, fallback)`, the storage + `useSyncExternalStore` pattern used by the stores below
- `src/lib/storage.ts`: where stores keep values: localStorage signed out, the account signed in (loaded by the root layout, changes sent to `POST /api/data` after 500 ms). `src/lib/user-data.ts`: the shared sync diff (documents whole; solves and drill log as row changes) and input checks. `src/lib/user-data.server.ts`: load, apply and replace in Postgres. Env: `DATABASE_URL` (migrations), `DATABASE_URL_POOLED` (app), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/db.ts`: Better Auth (with an `onboarded` user field), its client, and the Prisma client (generated into `src/generated/prisma`, gitignored)
- `src/lib/stackmat.ts`: Stackmat audio decoder (1200 baud serial, either polarity, gen 2 and gen 3+ packets); `src/lib/use-stackmat.ts` reads it from an audio input
- `src/lib/solves.ts`: timer solves (optionally tagged with an `oll`/`pll` case id via `setSolveCase`) and sessions (`last-layer:timer:v1`; a session's `puzzle` is read with `sessionPuzzle`, missing means 3x3), timer settings, the drill log (`last-layer:drill-log:v1`, one entry per drill answer), `effectiveMs` (+2 adds 2 s, DNF is `Infinity`) and `formatMs`
- `src/lib/daily.ts`: daily averages. Start daily on the Timer tags the next N solves with `daily: N` (5, 12, 25 or 50); `dailyRuns` groups them by local day per session, plus `dailyStreak`, `dailyTrend` (change per week against the date) and `dailyBadges`. Pure, so `user-data.ts` can import it on the server
- `src/lib/mode.ts`: Algorithms/Timer mode (`last-layer:mode:v1`); pages of one mode set it, Analyze follows it
- `src/lib/stats.ts`: WCA averages (aoN trims 1 each end up to ao12, 5% above; too many DNFs make a DNF), outlier rules, normal/t distributions, Shapiro-Wilk, regression, Welch t-test, histograms
- `src/lib/scramble.ts`: scrambles per timer puzzle (`scrambleFor`; random-move cubes never turn one layer set twice in a same-axis run, megaminx is WCA R++/D-- style, Square-1 is 20 random legal slices) and the unfolded net for any cube size (`scrambledNetN`)
- `src/lib/blind.ts`: blindfolded memo (`memoFor`: letters per sticker slot in Speffz order, buffers, top/front colours, parity). `src/lib/fmc.ts`: move counts (HTM, QTM, STM, ETM), FMC padding and solution checks. `src/lib/average.ts`: typed times, WCA average of all, what the last solve needs
- `src/lib/solver.worker.ts` + `src/lib/use-solver.ts`: cubejs (Kociemba two-phase, at most 22 moves; vendored in `src/vendor/cubejs` because the package depends on all of npm 6) and random-state 3x3 scrambles in a web worker
- `src/app/tools`: the Tools index and one page per tool (bodies in `src/components/tools/`, listed in `tool-list.ts`)
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
- After editing an algorithm, run `bun test`. If you changed `algs[0]`, run `bun run fetch-images --force` too so its image matches (the test fails for a stale non-3x3 image).
- Alternatives must solve the case exactly as pictured, so include any turn of the top they need first (`fitAlg` works it out). A test checks every one.
- Algorithms must end with the puzzle held the same way they started (no net `x`/`y`/`z` rotation; every centre back on its face). A test enforces this.
- Set labels repeat across puzzles ("OLL" on 2x2 and 3x3), so show `setLabel(set)` or `fullSetLabel(set)`, never the raw set id.
- Copy uses sentence case and the same status words everywhere: "Don't know", "In progress", "Learned".

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
