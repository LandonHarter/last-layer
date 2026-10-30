import type { Alg } from "@/data/algs";
import { cn } from "@/lib/utils";
import { isLastSlotSet } from "@/lib/cfop-sets";

export function CaseImage({ alg, className }: { alg: Alg; className?: string }) {
  return (
    // Static SVGs from VisualCube; next/image adds nothing for these.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/cases/${alg.id}.svg`}
      alt={`${alg.name} case, ${isLastSlotSet(alg.set) ? "front-right slot view" : "top view"}`}
      width={240}
      height={240}
      loading="lazy"
      decoding="async"
      className={cn("aspect-square select-none", className)}
      draggable={false}
    />
  );
}
