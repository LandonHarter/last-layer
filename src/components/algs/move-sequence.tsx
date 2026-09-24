import { splitMoves } from "@/lib/notation";
import { cn } from "@/lib/utils";

/** Algorithm in notation, one token per move so lines break between moves. */
export function MoveSequence({ alg, className }: { alg: string; className?: string }) {
  return (
    <p className={cn("flex flex-wrap gap-x-[0.55em] gap-y-[0.15em] font-mono font-medium", className)}>
      {splitMoves(alg).map((move, i) => (
        <span key={i} className="whitespace-nowrap">
          {move}
        </span>
      ))}
    </p>
  );
}
