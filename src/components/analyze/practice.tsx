"use client";

import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { CalendarHeatmap, GroupBarChart, type CalendarDay, type GroupBar } from "@/components/analyze/charts";
import { Figures, Panel } from "@/components/analyze/tests";
import { Button } from "@/components/ui/button";
import { dayKey, dayStart, shiftDay } from "@/lib/daily";
import { formatDuration, GAP_MS, practiceDays, practiceStretches, practiceSummary, type Stretch } from "@/lib/practice";
import type { Solve } from "@/lib/solves";

const longDate = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const clock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const DAY_MS = 86400000;
const BAR_DAYS = 30;
const HOURS = [0, 6, 12, 18, 24];

const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

/** How long you spend cubing: stretches of solves split by breaks of more than 5 minutes. */
export function PracticeSection({ solves, sessionName }: { solves: Solve[]; sessionName: string }) {
  const stretches = useMemo(() => practiceStretches(solves), [solves]);
  const days = useMemo(() => practiceDays(stretches), [stretches]);
  const now = Date.now();
  const sum = practiceSummary(days, stretches, now);

  const bars: GroupBar[] = useMemo(() => {
    const byDay = new Map(days.map((d) => [d.day, d]));
    const today = dayKey(Date.now());
    return Array.from({ length: BAR_DAYS }, (_, i) => {
      const key = shiftDay(today, i - BAR_DAYS + 1);
      const d = byDay.get(key);
      return { label: shortDate.format(dayStart(key)), value: (d?.ms ?? 0) / 60000, count: d?.stretches ?? 0 };
    });
  }, [days]);
  const calendar: CalendarDay[] = days.map((d) => ({
    at: dayStart(d.day),
    value: d.ms,
    title: longDate.format(dayStart(d.day)),
    detail: `${plural(d.stretches, "stretch", "stretches")}, ${plural(d.solves, "solve")}`,
  }));

  if (!stretches.length) return null;
  const minutes = (m: number) => formatDuration(m * 60000);

  return (
    <section aria-labelledby="time-cubing" className="flex flex-col gap-4">
      <div>
        <h2 id="time-cubing" className="text-2xl font-extrabold tracking-tight">
          Time cubing
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          How long you spend at it in {sessionName}. A stretch starts with a solve and ends after {GAP_MS / 60000} minutes without one.
        </p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
        <Panel title="Time spent">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-4xl font-extrabold tracking-tight tabular-nums">{formatDuration(sum.today)}</span>
            <span className="text-sm text-muted-foreground">today</span>
          </div>
          <Figures
            items={[
              ["Last 7 days", formatDuration(sum.week)],
              ["Last 30 days", formatDuration(sum.month)],
              ["All time", formatDuration(sum.total)],
              ["Per day you cubed", formatDuration(sum.perDay)],
              ["Longest stretch", sum.longest ? formatDuration(sum.longest.end - sum.longest.start) : "–"],
              ["Streak", plural(sum.streak, "day")],
              ["On the clock", sum.onClock == null ? "–" : `${Math.round(sum.onClock * 100)}%`],
              ["Stretches", String(stretches.length)],
            ]}
          />
          <GroupBarChart
            groups={bars}
            valueFormat={minutes}
            yFormat={(m) => `${Number(m.toFixed(1))}m`}
            countLabel="stretches"
            height={200}
            label={`Minutes cubing a day, last ${BAR_DAYS} days`}
          />
        </Panel>
        <div className="flex min-w-0 flex-col gap-4">
          <DayStrip stretches={stretches} activeDays={days.map((d) => d.day)} />
          <Panel title="Calendar">
            <CalendarHeatmap days={calendar} end={now} valueFormat={formatDuration} label="Time cubing by day" higher="darker" />
          </Panel>
        </div>
      </div>
    </section>
  );
}

/** One day on a 24-hour line, each stretch a block. Starts on today, or the latest day you cubed. */
function DayStrip({ stretches, activeDays }: { stretches: Stretch[]; activeDays: string[] }) {
  const today = dayKey(Date.now());
  const [picked, setPicked] = useState<string | null>(null);
  const day = picked ?? (activeDays.includes(today) ? today : (activeDays.at(-1) ?? today));
  const before = activeDays.findLast((d) => d < day);
  const after = activeDays.find((d) => d > day);
  const from = dayStart(day);
  const to = dayStart(shiftDay(day, 1));
  const span = to - from || DAY_MS;
  const shown = stretches.filter((s) => s.end > from && s.start < to);
  const total = shown.reduce((t, s) => t + Math.min(s.end, to) - Math.max(s.start, from), 0);
  const pct = (at: number) => ((Math.min(to, Math.max(from, at)) - from) / span) * 100;

  return (
    <Panel
      title={day === today ? "Today" : longDate.format(from)}
      controls={
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Day before" disabled={!before} onClick={() => before && setPicked(before)}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Day after" disabled={!after} onClick={() => after && setPicked(after)}>
            <ChevronRightIcon />
          </Button>
        </div>
      }
    >
      <p className="text-sm text-muted-foreground">
        {shown.length ? `${formatDuration(total)} over ${plural(shown.length, "stretch", "stretches")}` : "No cubing this day yet."}
      </p>
      <div>
        <div className="relative h-10 overflow-hidden rounded-md bg-muted" role="img" aria-label={`Stretches on ${longDate.format(from)}`}>
          {HOURS.slice(1, -1).map((h) => (
            <div key={h} className="absolute inset-y-0 w-px bg-border" style={{ left: `${(h / 24) * 100}%` }} />
          ))}
          {shown.map((s) => (
            <div
              key={s.start}
              className="absolute inset-y-1.5 min-w-1 rounded-sm bg-chart-1"
              style={{ left: `${pct(s.start)}%`, width: `${pct(s.end) - pct(s.start)}%` }}
              title={`${clock.format(s.start)} to ${clock.format(s.end)}: ${formatDuration(s.end - s.start)}, ${plural(s.solves, "solve")}`}
            />
          ))}
        </div>
        <div className="relative mt-1 h-4 text-[11px] text-muted-foreground tabular-nums">
          {HOURS.map((h) => (
            <span
              key={h}
              className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
              style={{ left: `${(h / 24) * 100}%` }}
            >
              {clock.format(from + h * 3600000).replace(":00", "")}
            </span>
          ))}
        </div>
      </div>
      {shown.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm tabular-nums">
          {shown.map((s) => (
            <li key={s.start} className="flex justify-between gap-4">
              <span>
                {clock.format(s.start)} to {clock.format(s.end)}
              </span>
              <span className="text-muted-foreground">
                {formatDuration(s.end - s.start)}, {plural(s.solves, "solve")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
