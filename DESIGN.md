# Design

Last Layer is a practice tool for someone holding a cube. It has two modes: Algorithms (F2L, OLL and PLL) and Timer (full solves), plus Analyze for the data both produce. They look at the screen between turns, so cases and moves must be readable at arm's length and everything else stays quiet.

## Principles

- **One bold element.** The theme picker (a cube for each theme) is where the visual flair goes. Everything else is plain and orderly. On the Timer, the clock is the one loud thing.
- **Motion only as a response.** The one orchestrated moment is a theme switch: the chosen cube turns, then the new theme sweeps out in a circle from it (View Transition API). Other motion is small feedback: fades when a case changes or the algorithm is revealed, and sticker colors changing. All motion respects `prefers-reduced-motion`.
- **Structure carries information.** Group headings are real shape groups (for F2L: where the corner and edge sit). The progress board has one square per algorithm. There are no decorative labels or numbering.
- **Plain copy.** Sentence case, direct verbs, and the same words everywhere ("In progress", "Learned", "Missed", "Got it"). Empty states say what to do next.

## Type

- **Bricolage Grotesque** (`--font-sans`, `--font-heading`) for all UI. Headings use weight 800 with tight tracking.
- **JetBrains Mono** (`--font-mono`) only for move notation. Each move is its own `<span>` (`MoveSequence`), so lines break between moves and never inside one.
- The solve clock and the Analyze hero figure use `font-clock` (Bricolage at width 75, weight 800, tabular digits so a running time doesn't jitter).
- Drill moves scale with `clamp()`: setup moves go up to about 2.4rem, and the revealed algorithm up to about 1.9rem in bold.

## Color and themes

Themes are set with `data-theme` on `<html>` (next-themes). Each theme redefines the shadcn tokens plus the status tokens in `src/app/globals.css`:

| Token | Use |
| --- | --- |
| `--unknown` | Don't know |
| `--learning` / `--learning-foreground` | In progress |
| `--learned` / `--learned-foreground` | Learned, Got it |
| `--missed` | Missed, miss count |

| Theme | Mode | Character |
| --- | --- | --- |
| Daylight (default) | light | Cool white with cube-blue primary |
| Blackout | dark | True black with sticker-yellow primary |
| Stickerless | light | Lavender with hot pink, rounder corners |
| Speedstack | dark | Competition-mat navy with red primary, tight corners |
| Chalk | light | Low-stimulus greys with a muted yellow |

Each theme also sets `--chart-1` to `--chart-4`, the series colors for Analyze charts. They were checked with the dataviz palette validator (lightness band, chroma, colorblind separation, 3:1 contrast against `--card`); re-run it if you change them. Text in charts never uses a series color.

Sticker palettes for the picker previews live in `src/lib/themes.ts`, because the picker shows every theme at once. Dark themes are listed in the `dark` custom variant in `globals.css`. When you add a theme, update both files and `THEMES`.

## Layout

- **Header:** sticky. Holds the wordmark (hidden below `sm`), the Algorithms/Timer mode switch (active filled with primary; icons only below `md`), that mode's nav (Library, Learn, Drill, Analyze or Timer, Analyze; active filled with foreground), the backup button (a popover to save all data to a file or load one, which replaces this browser's data after a confirm), and the theme button. Below `sm` the nav text and gaps shrink so it fits at 375px. Opening a page of one mode switches to it; Analyze follows the last mode. While the timer runs, the header fades out (`data-timing` on `<html>`).
- **Library (`/`):**
  - Hero: headline and short explainer on the left, progress board on the right. Every set is 3 rows at the same square size: OLL 19 wide, F2L 14 (41 cases leave one gap), PLL 7.
  - Filter bar: full width and sticky under the header. Contains search, an All/F2L/OLL/PLL toggle, a status select, and a shape select.
  - Content: sections per set, then per shape group. Cards sit in an auto-fill grid (min 12.5rem). On mobile, cards switch to horizontal rows with the image on the left.
  - Card: case image on a muted tile, name (links to the case page), drill score, your main algorithm in mono, a link to the other algorithms, and a three-way status toggle.
- **Learn (`/learn`):**
  - Overview: set toggle, cases per batch (3 to 6), learned count, your current batch (cases with stage or streak dots, Continue, Stop this batch), then suggested batches, each with case chips, why they belong together, and Start.
  - Session: batch strip on top, case image on the left (4fr) with the status toggle, (after Pick) a Your algorithm select, and a Your notes box under it, the step on the right (8fr). Switching algorithm sends the case back to Study. Cases marked Learned, here or in the Library, drop out of the batch; Pick also has Mark it Learned and skip it. Steps: Pick (every algorithm as chunks with tags, Try it shows a setup, Make it yours, Learn this one), Study (setup, then chunks one at a time with the current one in primary, then From memory with blanks you can tap to peek, plus tips), Recall (setup, Show me or Got it, streak dots).
  - A case is solid after 3 clean recalls in a row. A new case comes in only when fewer than two are shaky and each has one clean recall. A finished batch is marked Learned.
  - Keyboard: Space next chunk or Show me, K Got it, N new setup.
- **Drill (`/drill`):**
  - Idle: counts of In progress and Learned cases, plus a Start button. With nothing to drill, it shows a message and a link to the Library.
  - Session: case image on the left (5fr), work column on the right (7fr). The work column holds setup moves with a New setup button, then the Reveal card (a Hint button that shows your notes, if the case has any; after Reveal: name, group, your algorithm, your notes with Edit (or Add notes), link to all algorithms, status toggle). Shortcuts are off while typing in the notes, and Esc there closes the editor, then Missed and Got it buttons. Setups are random and never just undo your algorithm. On mobile this stacks, with a smaller image so the buttons stay reachable.
  - Keyboard: Space reveals, H shows the hint, J/← is Missed, K/→ is Got it, N gives a new setup, Esc ends the session.
- **Timer (`/timer`):**
  - Main column: the scramble in mono at the top with the session select, New scramble and Settings; the clock in the middle; ao5 and ao12 under it; penalty (OK / +2 / DNF) and Delete for the last solve, then optional OLL and PLL ghost buttons that tag it with the case you had (a popover with search and one row per case: image, name, your main algorithm in muted mono). The unfolded scramble (white top, green front, in the theme's sticker colors) sits bottom-left.
  - Sidebar (right on desktop, below on mobile): current and best single, mo3, ao5, ao12, ao50, ao100 and mean, then the solve list (latest 200). A row opens its scramble, date, OLL/PLL tags and penalty controls.
  - Clock colors: holding is `missed`, ready is `learned` (stackmat red/green). Inspection turns `learning` after 8 s and `missed` after 15 s.
  - Controls: hold Space for the hold time (0.3 s by default), let go to start; any key or a tap stops. Esc cancels a hold or inspection. On touch, the middle of the page is the pad. Everything but the clock fades out while timing.
- **Analyze (`/analyze`):**
  - Title with a Timer solves / Algorithm drills toggle (the same state as the header switch). A sticky filter row scopes everything below: session (plus OLL and PLL case, once you've tagged solves) or set and case, range, and an outlier rule. Outliers are drawn hollow and left out of lines, fits and tests; DNFs never count as outliers.
  - Summary: one hero figure (mean time, or the share you got for drills) with its 95% interval, then a grid of figures.
  - Over time: dots plus rolling averages (toggle each in the legend) and a trend line; by solve or by date, linear or log. Drills add a rolling Got it chart.
  - Distribution: histogram with a normal or log-normal curve, and a Q-Q plot.
  - Tests: Shapiro-Wilk normality, trend regression, Welch comparison of two groups, and chances of beating a time (bootstrapped for ao5 and ao12). Each ends in a plain sentence.
  - By group: mean (or Got it share) per session, OLL, PLL, time of day, weekday, month, set, case and so on, with interval whiskers.
  - Tables: all solves with CSV export and JSON export/import of solves (import merges, and also reads a full backup), or all cases sorted by most missed.
  - Charts are hand-built SVG in `analyze/charts.tsx`: 2px lines, dots with a surface ring, columns at most 24px with a rounded top, hairline gridlines, a crosshair tooltip, and arrow keys to step through values.
- **Case (`/algs/[id]`):**
  - Top: breadcrumb (Library / set / group) and previous/next case links.
  - Case image on the left (sticky on desktop). On the right: name, group, status toggle, your algorithm in large bold mono, a Your notes textarea (saved as you type, shown as the Drill hint), and a practice setup card.
  - Algorithms: a radio list, one row per algorithm, with move count and "Default" or "Yours" tags. A filled square sticker (primary color) marks your main, echoing the progress board. Your own algorithms have Remove.
  - Add your own: a mono input. The algorithm is checked on the simulator. If it needs a turn of the top first, it is stored with that turn, and a toast says so.

## Components

shadcn (base-nova style, Base UI primitives) in `src/components/ui`. App pieces:

- `cube-art.tsx`: `IsoCube` (isometric 3-face SVG) and `FlatFace` (3x3 button icon)
- `theme-selector.tsx`: popover picker with the switch animation
- `algs/`: `CaseImage`, `MoveSequence`, `StatusToggle`, `AlgCard`, `NotesField` (notes textarea shared by the case page, Learn and Drill)
- `library-view.tsx`, `learn-view.tsx`, `drill-view.tsx`: page bodies
- `backup-menu.tsx`: header backup popover
- `timer/`: `TimerView`, `ScrambleNet`, `SessionStats`, `SolveList`, `SessionPicker`, `PenaltyToggle`, `CasePicker`
- `analyze/`: `AnalyzeView`, charts (`TrendChart`, `HistogramChart`, `QQChart`, `GroupBarChart`) and test panels

Case images are VisualCube SVGs in `public/cases/{id}.svg`, yellow top, green front, red right. OLL and PLL use the top-down plan view, and PLL images have arrows. F2L uses the isometric view so the front-right slot shows.

## Quality floor

- Works down to 390px wide with no horizontal scroll.
- Focus outlines are visible (`--ring`).
- Contrast is AA in every theme.
- Progress, solves and the drill log live in `localStorage`, so there is a brief default render before hydration.
