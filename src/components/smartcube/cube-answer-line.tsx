import { BluetoothConnectedIcon } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { EXTRA_TURNS, PAUSE_MS, type AttemptResult } from "@/lib/smartcube/matcher";
import { formatMs } from "@/lib/solves";
import { cn } from "@/lib/utils";

/** What the smart cube is doing for this case: waiting for turns, or why it counted a miss. */
export function CubeAnswerLine({ turns, missed, className }: { turns?: number; missed?: AttemptResult; className?: string }) {
  if (missed) {
    return (
      <p className={cn("flex items-start gap-2 text-sm text-missed", className)} aria-live="polite">
        <BluetoothConnectedIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Not solved after {missed.moves.length} turn{missed.moves.length === 1 ? "" : "s"} ({formatMs(missed.execMs)} s). Press Missed <Kbd className="hidden sm:inline-flex">J</Kbd> to go on.
        </span>
      </p>
    );
  }
  return (
    <p className={cn("flex items-start gap-2 text-sm text-muted-foreground", className)} aria-live="polite">
      <BluetoothConnectedIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        {turns
          ? `${turns} turn${turns === 1 ? "" : "s"}…`
          : `Do the algorithm on your cube, in any state. Solving the case is Got it; ${EXTRA_TURNS} extra turns or a ${PAUSE_MS / 1000} s pause is a miss.`}
      </span>
    </p>
  );
}
