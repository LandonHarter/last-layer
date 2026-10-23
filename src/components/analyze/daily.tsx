"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { CalendarHeatmap, Legend, TrendChart, type CalendarDay, type TrendPoint } from "@/components/analyze/charts";
import { Panel } from "@/components/analyze/tests";
import { buttonVariants } from "@/components/ui/button";
import { dailyBadges, dailyRuns, dailyStreak, dailyTrend, dayStart, finishedRuns } from "@/lib/daily";
import { formatMs, type Solve } from "@/lib/solves";
import { mean } from "@/lib/stats";

const longDate = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const ROLLING = 7;

/** "1.20 s faster", "0.40 s slower". */
function change(ms: number, unit = "") {
  return `${formatMs(Math.abs(ms))} s ${ms < 0 ? "faster" : "slower"}${unit}`;
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

/** One average a day for a session: the trend over dates, a calendar, the streak. */
export function DailySection({ solves, session, sessionName }: { solves: Solve[]; session: string; sessionName: string }) {
  const runs = useMemo(() => dailyRuns(solves, session), [solves, session]);
  const done = useMemo(() => finishedRuns(runs), [runs]);
  const trend = useMemo(() => dailyTrend(runs), [runs]);
  const badges = dailyBadges(runs);
  const streak = dailyStreak(runs);

  const points: TrendPoint[] = done.map((r) => ({ x: dayStart(r.day), y: r.average, title: `${longDate.format(dayStart(r.day))}, ao${r.size}` }));
  const rolling = done.map((_, i) => (i < 2 ? null : mean(done.slice(Math.max(0, i + 1 - ROLLING), i + 1).map((r) => r.average))));
  const days: CalendarDay[] = runs.map((r) => ({
    at: dayStart(r.day),
    value: r.average,
    partial: !r.done,
    title: longDate.format(dayStart(r.day)),
    detail: r.done ? `ao${r.size}` : `${r.solves.length} of ${r.size} solves`,
  }));

  return (
    <section aria-labelledby="daily" className="flex flex-col gap-4">
      <div>
        <h2 id="daily" className="text-2xl font-extrabold tracking-tight">
          Daily
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">One average a day in {sessionName}, by date, so a long session doesn&apos;t outweigh a short one.</p>
      </div>
      {!runs.length ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6">
          <p className="text-base text-muted-foreground">No dailies in this session yet. Start one on the Timer and it&apos;ll show up here.</p>
          <Link href="/timer" className={buttonVariants({ variant: "outline" })}>
            Open the Timer
          </Link>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
          <Panel title="Daily averages">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              <Figure label="Latest">{formatMs(badges?.latest.average)}</Figure>
              <Figure label="Best daily">{formatMs(done.length ? Math.min(...done.map((r) => r.average)) : null)}</Figure>
              <Figure label="Streak">
                {streak} {streak === 1 ? "day" : "days"}
              </Figure>
              <Figure label="Vs last daily">{badges?.change == null ? "–" : change(badges.change)}</Figure>
              <Figure label="Trend">{trend ? change(trend.perWeek, " a week") : "–"}</Figure>
              <Figure label="In 30 days">{trend && trend.projected > 0 ? formatMs(trend.projected) : "–"}</Figure>
            </dl>
            {done.length < 2 ? (
              <p className="text-sm text-muted-foreground">Finish dailies on a few different days to see a line.</p>
            ) : (
              <>
                <Legend
                  items={[
                    { label: "Daily average", swatch: "bg-chart-1", kind: "dot" },
                    { label: `Mean of last ${ROLLING}`, swatch: "bg-chart-2" },
                    ...(trend ? [{ label: "Trend", swatch: "bg-foreground/50" }] : []),
                  ]}
                />
                <TrendChart
                  points={points}
                  lines={[{ id: "rolling", label: `Mean of last ${ROLLING}`, stroke: "stroke-chart-2", swatch: "bg-chart-2", values: rolling }]}
                  trend={trend}
                  xMode="date"
                  height={260}
                  valueFormat={formatMs}
                  label="Daily averages by date"
                />
              </>
            )}
            {trend && (
              <p className="text-sm leading-relaxed">
                {Math.abs(trend.perWeek) < 50
                  ? "Your dailies are holding steady."
                  : trend.perWeek < 0
                    ? `You're getting faster: about ${formatMs(-trend.perWeek)} s a week over ${done.length} dailies.`
                    : `Your dailies are slowing by about ${formatMs(trend.perWeek)} s a week over ${done.length} dailies.`}
                {trend.p >= 0.05 && " It's early to tell: the days still vary more than the trend."}
              </p>
            )}
          </Panel>
          <Panel title="Calendar">
            <CalendarHeatmap days={days} end={Date.now()} valueFormat={formatMs} label="Dailies by day" />
          </Panel>
        </div>
      )}
    </section>
  );
}
