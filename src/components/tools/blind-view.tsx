"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, RefreshCwIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { MoveSequence } from "@/components/algs/move-sequence";
import { useStickers, WCA_COLOR } from "@/components/timer/scramble-net";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  canBeFront,
  COLORS,
  CORNER_BUFFERS,
  CORNER_SLOTS,
  DEFAULT_BLIND,
  EDGE_BUFFERS,
  EDGE_SLOTS,
  memoFor,
  netCell,
  normalizeMemo,
  orientationMoves,
  pairUp,
  SPEFFZ,
  type BlindOptions,
  type Color,
  type Memo,
} from "@/lib/blind";
import { applyAlg, solvedCube, type Face, type Sticker } from "@/lib/cube";
import { netOf, randomScramble } from "@/lib/scramble";
import { createStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const store = createStore<BlindOptions>("last-layer:blind:v1", DEFAULT_BLIND);
const update = (change: Partial<BlindOptions>) => store.update((o) => ({ ...o, ...change }));

const TOGGLE_ITEM = "px-3 font-semibold aria-pressed:bg-foreground aria-pressed:text-background";
const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

// Where each face sits in the unfolded cross, in face-sized cells (column, row).
const LAYOUT: [Face, number, number][] = [
  ["U", 1, 0],
  ["L", 0, 1],
  ["F", 1, 1],
  ["R", 2, 1],
  ["B", 3, 1],
  ["D", 1, 2],
];

type Cell = { slot: string; kind: "edges" | "corners"; index: number };
// Which letter slot sits at each face, row and column of the net.
const CELLS = new Map<string, Cell>();
EDGE_SLOTS.forEach((slot, index) => {
  const { face, row, col } = netCell(slot);
  CELLS.set(`${face}${row}${col}`, { slot, kind: "edges", index });
});
CORNER_SLOTS.forEach((slot, index) => {
  const { face, row, col } = netCell(slot);
  CELLS.set(`${face}${row}${col}`, { slot, kind: "corners", index });
});

const lettersOf = (o: BlindOptions, cell: Cell) => (cell.kind === "edges" ? o.edgeLetters : o.cornerLetters)[cell.index]?.trim() ?? "";

/**
 * The cube as an unfolded net, with each sticker's letter on it. `edit` turns
 * the letters into inputs; `highlight` rings one slot for the letter quiz.
 */
function LetterNet({
  state,
  options,
  showLetters = true,
  edit,
  highlight,
  className,
}: {
  state: Sticker[];
  options: BlindOptions;
  showLetters?: boolean;
  edit?: (cell: Cell, letter: string) => void;
  highlight?: string;
  className?: string;
}) {
  const stickers = useStickers();
  const net = useMemo(() => netOf(state), [state]);
  return (
    <div
      className={cn("grid w-full max-w-[34rem] grid-cols-4 gap-[calc(var(--cell)*0.2)] [--cell:clamp(1.3rem,6.4vw,2.6rem)]", className)}
      role="img"
      aria-label="Cube, unfolded, with letters"
    >
      {LAYOUT.map(([face, col, row]) => (
        <div key={face} className="grid grid-cols-3 gap-[calc(var(--cell)*0.07)] rounded-md bg-muted p-[calc(var(--cell)*0.07)]" style={{ gridColumn: col + 1, gridRow: row + 1 }}>
          {net[face].map((color, i) => {
            const r = Math.floor(i / 3);
            const c = i % 3;
            const cell = CELLS.get(`${face}${r}${c}`);
            const letter = cell ? lettersOf(options, cell) : "";
            return (
              <div
                key={i}
                className={cn(
                  "relative flex aspect-square items-center justify-center rounded-[calc(var(--cell)*0.14)] ring-1 ring-foreground/25 ring-inset",
                  cell && highlight === cell.slot && "z-10 ring-4 ring-foreground outline-2 outline-background",
                )}
                style={{ background: stickers[WCA_COLOR[color]] }}
              >
                {cell && edit ? (
                  <input
                    value={letter}
                    maxLength={1}
                    aria-label={`Letter for ${cell.slot}`}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => edit(cell, e.target.value.slice(-1).toUpperCase())}
                    className="size-[80%] rounded-[calc(var(--cell)*0.12)] bg-background/85 text-center font-mono text-[calc(var(--cell)*0.45)] font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                ) : cell && showLetters && letter ? (
                  <span className="rounded-[calc(var(--cell)*0.1)] bg-background/80 px-[0.2em] font-mono text-[calc(var(--cell)*0.4)] leading-tight font-bold text-foreground">
                    {letter}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function OptionSelect<T extends string>({ label, value, items, onChange }: { label: string; value: T; items: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <Select items={items} value={value} onValueChange={(v) => v && onChange(v as T)}>
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function Settings({ options }: { options: BlindOptions }) {
  const [editing, setEditing] = useState(false);
  const fronts = COLORS.filter((c) => canBeFront(options.top, c));
  const held = useMemo(() => applyAlg(solvedCube(), orientationMoves(options.top, options.front)), [options.top, options.front]);
  const all = [...options.edgeLetters, ...options.cornerLetters].map((l) => l.trim()).filter(Boolean);
  const repeated = new Set(options.edgeLetters.split("").filter((l, i, a) => l.trim() && a.indexOf(l) !== i));
  const cornerRepeated = new Set(options.cornerLetters.split("").filter((l, i, a) => l.trim() && a.indexOf(l) !== i));

  function setLetter(cell: Cell, letter: string) {
    const field = cell.kind === "edges" ? "edgeLetters" : "cornerLetters";
    const chars = options[field].padEnd(24, " ").split("");
    chars[cell.index] = letter || " ";
    update({ [field]: chars.join("") });
  }

  return (
    <section aria-labelledby="blind-settings" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 id="blind-settings" className="text-lg font-extrabold tracking-tight">
        Your setup
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <OptionSelect
          label="Top"
          value={options.top}
          items={COLORS.map((c) => ({ value: c, label: capital(c) }))}
          onChange={(top: Color) => update({ top, front: canBeFront(top, options.front) ? options.front : COLORS.find((c) => canBeFront(top, c))! })}
        />
        <OptionSelect label="Front" value={options.front} items={fronts.map((c) => ({ value: c, label: capital(c) }))} onChange={(front: Color) => update({ front })} />
        <OptionSelect
          label="Edge buffer"
          value={options.edgeBuffer}
          items={EDGE_BUFFERS.map((b) => ({ value: b.slot as string, label: b.label }))}
          onChange={(edgeBuffer) => update({ edgeBuffer })}
        />
        <OptionSelect
          label="Corner buffer"
          value={options.cornerBuffer}
          items={CORNER_BUFFERS.map((b) => ({ value: b.slot as string, label: b.label }))}
          onChange={(cornerBuffer) => update({ cornerBuffer })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
          {editing ? "Done" : "Edit lettering scheme"}
        </Button>
        {(options.edgeLetters !== SPEFFZ || options.cornerLetters !== SPEFFZ) && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => update({ edgeLetters: SPEFFZ, cornerLetters: SPEFFZ })}>
            <RotateCcwIcon data-icon="inline-start" />
            Back to Speffz
          </Button>
        )}
        {!editing && <span className="text-sm text-muted-foreground">{options.edgeLetters === SPEFFZ && options.cornerLetters === SPEFFZ ? "Speffz" : "Your own scheme"}</span>}
      </div>
      {editing && (
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Type a letter on each edge and corner sticker, as you hold the cube. Edges and corners are lettered separately, so the same letter can be on both.
          </p>
          <LetterNet state={held} options={options} edit={setLetter} />
          {(repeated.size > 0 || cornerRepeated.size > 0 || all.length < 48) && (
            <p className="text-sm text-missed">
              {all.length < 48 && `${48 - all.length} ${48 - all.length === 1 ? "sticker has" : "stickers have"} no letter. `}
              {repeated.size > 0 && `Edge letters used twice: ${[...repeated].join(", ")}. `}
              {cornerRepeated.size > 0 && `Corner letters used twice: ${[...cornerRepeated].join(", ")}.`}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function MemoResult({ memo }: { memo: Memo }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {(["edges", "corners"] as const).map((kind) => (
        <div key={kind} className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
          <dt className="flex items-baseline justify-between text-sm font-medium text-muted-foreground">
            {capital(kind)}
            <span className="tabular-nums">
              {memo[kind].length} {memo[kind].length === 1 ? "target" : "targets"}
            </span>
          </dt>
          <dd className="font-mono text-[clamp(1.4rem,4vw,2rem)] font-bold tracking-wide break-words">{memo[kind].length ? pairUp(memo[kind]) : "Solved"}</dd>
        </div>
      ))}
      <p className="text-sm text-muted-foreground sm:col-span-2">
        {memo.parity ? "Parity: an odd number of targets, so do your parity algorithm after the edges." : "No parity."}
      </p>
    </dl>
  );
}

function MemoMode({ options }: { options: BlindOptions }) {
  const [scramble, setScramble] = useState("");
  useEffect(() => setScramble(randomScramble()), []);
  const result = useMemo(() => {
    try {
      return { memo: memoFor(scramble, options) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [scramble, options]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="blind-scramble" className="text-sm font-medium">
          Scramble (white top, green front)
        </label>
        <Textarea id="blind-scramble" value={scramble} onChange={(e) => setScramble(e.target.value)} className="font-mono text-base" rows={2} spellCheck={false} />
        <Button variant="outline" size="sm" className="self-start" onClick={() => setScramble(randomScramble())}>
          <RefreshCwIcon data-icon="inline-start" />
          Random scramble
        </Button>
      </div>
      {"error" in result ? (
        <p className="text-sm text-missed">{result.error}</p>
      ) : (
        result.memo && (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <LetterNet state={result.memo.state} options={options} />
            <MemoResult memo={result.memo} />
          </div>
        )
      )}
    </div>
  );
}

type QuizKind = "memo" | "letters";

function MemoQuiz({ options }: { options: BlindOptions }) {
  const [scramble, setScramble] = useState("");
  const [edges, setEdges] = useState("");
  const [corners, setCorners] = useState("");
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0 });
  const [showLetters, setShowLetters] = useState(false);
  const started = useRef(0);
  const [took, setTook] = useState(0);
  const edgeInput = useRef<HTMLInputElement>(null);

  const next = () => {
    setScramble(randomScramble());
    setEdges("");
    setCorners("");
    setChecked(false);
    started.current = performance.now();
    edgeInput.current?.focus();
  };
  useEffect(next, []);

  const memo = useMemo(() => (scramble ? memoFor(scramble, options) : null), [scramble, options]);
  if (!memo) return null;
  const edgesOk = normalizeMemo(edges) === memo.edges.join("");
  const cornersOk = normalizeMemo(corners) === memo.corners.join("");

  function check(e: React.FormEvent) {
    e.preventDefault();
    if (checked) return next();
    const ok = edgesOk && cornersOk;
    setTook(performance.now() - started.current);
    setChecked(true);
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1, streak: ok ? s.streak + 1 : 0 }));
  }

  const field = (kind: "edges" | "corners", value: string, set: (v: string) => void, ok: boolean) => (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      <span className="flex items-center gap-2">
        {capital(kind)}
        {checked && (ok ? <CheckIcon className="size-4 text-learned" aria-label="Right" /> : <XIcon className="size-4 text-missed" aria-label="Wrong" />)}
      </span>
      <Input
        ref={kind === "edges" ? edgeInput : undefined}
        value={value}
        onChange={(e) => set(e.target.value)}
        readOnly={checked}
        className="h-11 font-mono text-lg uppercase"
        placeholder={kind === "edges" ? "AB CD …" : "EF GH …"}
        autoComplete="off"
        spellCheck={false}
      />
      {checked && !ok && <span className="font-mono text-base text-foreground">{memo[kind].length ? pairUp(memo[kind]) : "Solved (leave it empty)"}</span>}
    </label>
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <MoveSequence alg={scramble} className="text-base" />
        <LetterNet state={memo.state} options={options} showLetters={showLetters || checked} />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showLetters} onChange={(e) => setShowLetters(e.target.checked)} className="size-4 accent-primary" />
          Show letters on the stickers
        </label>
      </div>
      <form onSubmit={check} className="flex flex-col gap-4">
        {field("edges", edges, setEdges, edgesOk)}
        {field("corners", corners, setCorners, cornersOk)}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">{checked ? "Next scramble" : "Check"}</Button>
          {checked && (
            <span className={cn("text-sm font-semibold", edgesOk && cornersOk ? "text-learned" : "text-missed")}>
              {edgesOk && cornersOk ? `Got it in ${(took / 1000).toFixed(1)} s` : "Not quite"}
              {memo.parity && " · parity"}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {score.right} of {score.total} right · streak {score.streak}
        </p>
      </form>
    </div>
  );
}

function LetterQuiz({ options }: { options: BlindOptions }) {
  const held = useMemo(() => applyAlg(solvedCube(), orientationMoves(options.top, options.front)), [options.top, options.front]);
  const pool = useMemo(
    () => [
      ...EDGE_SLOTS.map((slot, index) => ({ slot, kind: "edges" as const, index })),
      ...CORNER_SLOTS.map((slot, index) => ({ slot, kind: "corners" as const, index })),
    ].filter((c) => lettersOf(options, c)),
    [options],
  );
  const [target, setTarget] = useState<Cell | null>(null);
  const [answer, setAnswer] = useState<{ given: string; ok: boolean } | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0 });

  const next = () => {
    setAnswer(null);
    setTarget((prev) => {
      let t = pool[Math.floor(Math.random() * pool.length)];
      for (let i = 0; i < 5 && pool.length > 1 && t.slot === prev?.slot; i++) t = pool[Math.floor(Math.random() * pool.length)];
      return t ?? null;
    });
  };
  useEffect(next, [pool]);

  const input = useRef<HTMLInputElement>(null);

  function answerWith(key: string) {
    if (!target || answer || !/^[a-z0-9]$/i.test(key)) return;
    const right = lettersOf(options, target).toUpperCase();
    const ok = key.toUpperCase() === right;
    setAnswer({ given: key.toUpperCase(), ok });
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1, streak: ok ? s.streak + 1 : 0 }));
    // A right answer moves on by itself.
    if (ok) window.setTimeout(next, 350);
  }

  if (!target) return <p className="text-sm text-muted-foreground">Give some stickers a letter first.</p>;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <LetterNet state={held} options={options} showLetters={false} highlight={target.slot} />
      <div className="flex flex-col gap-4">
        <p className="text-lg">
          Type the letter of the ringed {target.kind === "edges" ? "edge" : "corner"} sticker.
        </p>
        <Input
          ref={input}
          autoFocus
          value=""
          onChange={(e) => answerWith(e.target.value.slice(-1))}
          onKeyDown={(e) => {
            if (answer && !answer.ok && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              next();
            }
          }}
          aria-label="Letter"
          placeholder="Type the letter"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="h-12 w-40 font-mono text-xl"
        />
        <div className="flex min-h-20 items-center gap-4">
          {answer && (
            <>
              <span className={cn("font-mono text-6xl font-bold", answer.ok ? "text-learned" : "text-missed")}>{answer.ok ? answer.given : lettersOf(options, target)}</span>
              {!answer.ok && (
                <span className="text-sm text-muted-foreground">
                  You typed {answer.given}. <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      next();
                      input.current?.focus();
                    }}
                  >
                    Next
                  </Button>
                </span>
              )}
            </>
          )}
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {score.right} of {score.total} right · streak {score.streak}
        </p>
      </div>
    </div>
  );
}

export function BlindView() {
  const options = store.use();
  const [mode, setMode] = useState<"memo" | "quiz">("memo");
  const [quiz, setQuiz] = useState<QuizKind>("memo");
  return (
    <div className="flex flex-col gap-6">
      <Settings options={options} />
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup value={[mode]} onValueChange={(v) => v[0] && setMode(v[0] as "memo" | "quiz")} variant="outline" spacing={0} aria-label="Mode">
          <ToggleGroupItem value="memo" className={TOGGLE_ITEM}>
            Memo
          </ToggleGroupItem>
          <ToggleGroupItem value="quiz" className={TOGGLE_ITEM}>
            Quiz
          </ToggleGroupItem>
        </ToggleGroup>
        {mode === "quiz" && (
          <ToggleGroup value={[quiz]} onValueChange={(v) => v[0] && setQuiz(v[0] as QuizKind)} variant="outline" size="sm" spacing={0} aria-label="Quiz">
            <ToggleGroupItem value="memo" className={TOGGLE_ITEM}>
              Full memo
            </ToggleGroupItem>
            <ToggleGroupItem value="letters" className={TOGGLE_ITEM}>
              Letters
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>
      {mode === "memo" ? <MemoMode options={options} /> : quiz === "memo" ? <MemoQuiz options={options} /> : <LetterQuiz options={options} />}
    </div>
  );
}
