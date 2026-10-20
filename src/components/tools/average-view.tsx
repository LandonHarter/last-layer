"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { averageAll, lastSolve, parseTimes } from "@/lib/average";
import { formatMs } from "@/lib/solves";
import { averageOf, best, mean } from "@/lib/stats";
import { cn } from "@/lib/utils";

const FORMATS = [
  { n: 3, label: "Mean of 3" },
  { n: 5, label: "Average of 5" },
  { n: 12, label: "Average of 12" },
] as const;
const TOGGLE_ITEM = "px-3 font-semibold aria-pressed:bg-foreground aria-pressed:text-background";

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn("font-clock tabular-nums", strong ? "text-4xl" : "text-2xl")}>{value}</dd>
    </div>
  );
}

export function AverageView() {
  const [text, setText] = useState("");
  const [n, setN] = useState<number>(5);
  const [targetText, setTargetText] = useState("");
  const { times, bad } = useMemo(() => parseTimes(text), [text]);
  const target = useMemo(() => {
    const t = parseTimes(targetText).times;
    return t.length === 1 && Number.isFinite(t[0]) ? t[0] : null;
  }, [targetText]);

  const finite = times.filter(Number.isFinite);
  const format = FORMATS.find((f) => f.n === n)!;
  // The solves of the current average so far: the last few you typed.
  const round = times.length % n === 0 && times.length ? times.slice(-n) : times.slice(times.length - (times.length % n));
  const toGo = n - round.length;
  const last = target !== null && toGo === 1 ? lastSolve(round, target) : null;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="avg-times" className="text-sm font-medium">
            Times
          </label>
          <Textarea
            id="avg-times"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            spellCheck={false}
            placeholder="12.34 11.02 DNF 1:02.50 10.98+"
            className="font-mono text-lg"
          />
          <p className={cn("text-sm", bad.length ? "text-missed" : "text-muted-foreground")}>
            {bad.length ? `Couldn't read ${bad.join(", ")}.` : "Separate times with spaces or new lines. Write a +2 as 12.34+ (the time on the clock) and a DNF as DNF."}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Format</span>
          <ToggleGroup value={[String(n)]} onValueChange={(v) => v[0] && setN(Number(v[0]))} variant="outline" spacing={0} aria-label="Format" className="self-start">
            {FORMATS.map((f) => (
              <ToggleGroupItem key={f.n} value={String(f.n)} className={TOGGLE_ITEM}>
                {f.n === 3 ? "mo3" : `ao${f.n}`}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="avg-target" className="text-sm font-medium">
            Target average
          </label>
          <Input id="avg-target" value={targetText} onChange={(e) => setTargetText(e.target.value)} placeholder="10.00" className="w-32 font-mono text-lg" />
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-3">
            <Figure label={`${format.label}${round.length < n ? ` (${round.length} of ${n} so far)` : ""}`} value={round.length === n ? formatMs(averageOf(round, n)) : "–"} strong />
          </div>
          <Figure label={`Average of all ${times.length}`} value={formatMs(times.length >= 3 ? averageAll(times) : null)} />
          <Figure label="Mean" value={formatMs(finite.length ? mean(finite) : null)} />
          <Figure label="Best" value={formatMs(best(times))} />
        </dl>

        {toGo === 1 && round.length >= 2 && (
          <section aria-label="Last solve" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-lg font-extrabold tracking-tight">One solve to go</h2>
            {(() => {
              const any = lastSolve(round, 0)!;
              return (
                <dl className="grid grid-cols-2 gap-2">
                  <Figure label="Best possible" value={formatMs(any.best)} />
                  <Figure label="Worst possible" value={formatMs(any.worst)} />
                </dl>
              );
            })()}
            {target === null ? (
              <p className="text-sm text-muted-foreground">Type a target average to see what you need.</p>
            ) : (
              last && (
                <p className="text-lg">
                  {last.needed === null ? (
                    <span className="text-missed">{formatMs(target)} is out of reach, even with a perfect last solve.</span>
                  ) : last.needed === Infinity ? (
                    <span className="text-learned">You have {formatMs(target)} whatever happens, even a DNF.</span>
                  ) : (
                    <>
                      You need <span className="font-extrabold">{formatMs(last.needed)}</span> or faster for {formatMs(target)}.
                    </>
                  )}
                </p>
              )
            )}
          </section>
        )}
      </div>
    </div>
  );
}
