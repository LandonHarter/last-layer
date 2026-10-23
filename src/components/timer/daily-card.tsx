"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DAILY_SIZES, DEFAULT_DAILY_SIZE, dailyBadges, dailyStreak, todayRun, type DailyRun } from "@/lib/daily";
import { formatMs, setSolvesDaily } from "@/lib/solves";
import { cn } from "@/lib/utils";

const ITEM = "px-2.5 aria-pressed:bg-foreground aria-pressed:text-background";

/** "−0.32 vs last daily", with faster in the Got it color and slower in Missed. */
function Change({ ms }: { ms: number }) {
  const faster = ms < 0;
  return (
    <span className={cn("font-semibold", faster ? "text-learned" : "text-missed")}>
      {faster ? "−" : "+"}
      {formatMs(Math.abs(ms))}
    </span>
  );
}

/**
 * Today's daily average for the current session: start one, watch it fill,
 * and see how it compares once it's done.
 */
export function DailyCard({
  runs,
  armed,
  onArm,
}: {
  /** This session's dailies, oldest first (`dailyRuns`). */
  runs: DailyRun[];
  /** Size of the daily the next solve starts, or null. */
  armed: number | null;
  onArm: (size: number | null) => void;
}) {
  const today = todayRun(runs);
  const streak = dailyStreak(runs);
  const [size, setSize] = useState<number | null>(null);
  const picked = size ?? runs.at(-1)?.size ?? DEFAULT_DAILY_SIZE;
  const badges = today?.done ? dailyBadges(runs) : null;

  function discard(run: DailyRun) {
    const ids = run.solves.map((s) => s.id);
    setSolvesDaily(ids, undefined);
    toast("Discarded today's daily", { action: { label: "Undo", onClick: () => setSolvesDaily(ids, run.size) } });
  }

  return (
    <section aria-labelledby="daily-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="daily-heading" className="text-base font-extrabold tracking-tight">
          Daily
        </h2>
        <p className="text-sm tabular-nums text-muted-foreground">{streak > 0 ? `${streak}-day streak` : "No streak yet"}</p>
      </div>

      {today?.done ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">Today&apos;s ao{today.size}</p>
          <p className="font-clock text-3xl leading-none">{formatMs(today.average)}</p>
          <p className="text-sm text-muted-foreground">
            {badges?.isBest ? (
              <span className="font-semibold text-learned">Best daily yet</span>
            ) : badges?.change !== null && badges?.change !== undefined ? (
              <>
                <Change ms={badges.change} /> vs last daily
              </>
            ) : (
              "Your first daily. Come back tomorrow to compare."
            )}
          </p>
        </div>
      ) : today ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 text-sm tabular-nums">
            <span>
              <span className="font-semibold">{today.solves.length}</span>
              <span className="text-muted-foreground"> of {today.size} solves</span>
            </span>
            <span className="text-muted-foreground">
              So far <span className="font-semibold text-foreground">{formatMs(today.soFar)}</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Daily progress" aria-valuemin={0} aria-valuemax={today.size} aria-valuenow={today.solves.length}>
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(today.solves.length / today.size) * 100}%` }} />
          </div>
          <Button variant="ghost" size="sm" className="-ml-2.5 self-start text-muted-foreground hover:text-missed" onClick={() => discard(today)}>
            Discard today&apos;s daily
          </Button>
        </div>
      ) : armed ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Your next solve starts today&apos;s ao{armed}.</p>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onArm(null)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm leading-relaxed text-muted-foreground">One average a day, any time of day. Warm up first if you like, then start it.</p>
          <div className="flex items-center justify-between gap-3">
            <ToggleGroup value={[String(picked)]} onValueChange={(v) => v[0] && setSize(Number(v[0]))} variant="outline" size="sm" spacing={0} aria-label="Daily size">
              {DAILY_SIZES.map((n) => (
                <ToggleGroupItem key={n} value={String(n)} className={ITEM}>
                  ao{n}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button size="sm" onClick={() => onArm(picked)}>
              Start daily
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
