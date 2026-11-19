import { splitMoves, type Notation } from "@/lib/notation";
import { chunkAlg } from "@/lib/triggers";
import { cn } from "@/lib/utils";

/**
 * Algorithm in notation, one token per move so lines break between moves.
 * `grouped` splits it into triggers and chunks (`chunkAlg`), each underlined;
 * `"labeled"` also names the well-known triggers under them.
 */
export function MoveSequence({
  alg,
  grouped,
  notation,
  progress,
  className,
}: {
  alg: string;
  grouped?: boolean | "labeled";
  /** Which puzzle's notation, so megaminx algs don't get 3x3 trigger names. */
  notation?: Notation;
  /** Smart cube scramble guide: moves before `done` are made (dimmed), the next one is marked, half made when `half`. */
  progress?: { done: number; half?: boolean };
  className?: string;
}) {
  const chunks = grouped && !progress ? chunkAlg(alg, notation) : [];
  // One chunk is only worth drawing as a group when it has a name to show.
  if (chunks.length < 2 && !(grouped === "labeled" && chunks[0]?.name)) {
    return (
      <p className={cn("flex flex-wrap gap-x-[0.55em] gap-y-[0.15em] font-mono font-medium", className)}>
        {splitMoves(alg).map((move, i) => (
          <span
            key={i}
            className={cn(
              "whitespace-nowrap",
              progress && i < progress.done && "text-muted-foreground/45",
              progress && i === progress.done && "underline decoration-2 underline-offset-4",
              progress && i === progress.done && progress.half && "text-learning",
            )}
          >
            {move}
          </span>
        ))}
      </p>
    );
  }

  const labeled = grouped === "labeled" && chunks.some((c) => c.name);
  return (
    <p className={cn("flex flex-wrap items-start gap-x-[1.1em] gap-y-[0.4em] font-mono font-medium", className)}>
      {chunks.map((chunk, i) => (
        <span key={i} className="flex flex-col" title={chunk.name}>
          <span className="flex flex-wrap gap-x-[0.55em] border-b-2 border-foreground/20 pb-[0.1em]">
            {chunk.moves.map((move, j) => (
              <span key={j} className="whitespace-nowrap">
                {move}
              </span>
            ))}
          </span>
          {labeled && (
            <span className="mt-1 font-sans text-xs font-medium text-muted-foreground">{chunk.name ?? " "}</span>
          )}
        </span>
      ))}
    </p>
  );
}
