import { formatMs } from "@/lib/solves";
import { averageOf, best, bestAverage, mean, stdev } from "@/lib/stats";

const ROWS: { label: string; n: number }[] = [
  { label: "mo3", n: 3 },
  { label: "ao5", n: 5 },
  { label: "ao12", n: 12 },
  { label: "ao50", n: 50 },
  { label: "ao100", n: 100 },
];

/** Current and best single and averages for a list of times (ms, DNF = Infinity). */
export function SessionStats({ times }: { times: number[] }) {
  const finite = times.filter(Number.isFinite);
  const dnfs = times.length - finite.length;
  return (
    <section aria-labelledby="stats-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="stats-heading" className="text-base font-extrabold tracking-tight">
          Stats
        </h2>
        <p className="text-sm tabular-nums text-muted-foreground">
          {times.length} {times.length === 1 ? "solve" : "solves"}
          {dnfs > 0 && `, ${dnfs} DNF`}
        </p>
      </div>
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th scope="col" className="pb-1 font-medium">
              <span className="sr-only">Stat</span>
            </th>
            <th scope="col" className="pb-1 text-right font-medium">
              Current
            </th>
            <th scope="col" className="pb-1 text-right font-medium">
              Best
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border">
            <th scope="row" className="py-1.5 text-left font-medium text-muted-foreground">
              Single
            </th>
            <td className="py-1.5 text-right font-semibold">{formatMs(times.at(-1) ?? null)}</td>
            <td className="py-1.5 text-right font-semibold">{formatMs(best(times))}</td>
          </tr>
          {ROWS.map(({ label, n }) => (
            <tr key={label} className="border-t border-border">
              <th scope="row" className="py-1.5 text-left font-medium text-muted-foreground">
                {label}
              </th>
              <td className="py-1.5 text-right font-semibold">{formatMs(averageOf(times, n))}</td>
              <td className="py-1.5 text-right font-semibold">{formatMs(bestAverage(times, n)?.value ?? null)}</td>
            </tr>
          ))}
          <tr className="border-t border-border">
            <th scope="row" className="py-1.5 text-left font-medium text-muted-foreground">
              Mean
            </th>
            <td colSpan={2} className="py-1.5 text-right font-semibold">
              {formatMs(finite.length ? mean(finite) : null)}
              {finite.length > 1 && <span className="font-normal text-muted-foreground"> ± {formatMs(stdev(finite))}</span>}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
