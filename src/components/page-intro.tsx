"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** A page's explainer. Phones show its first lines and a More button, so the page itself starts on the first screen. */
export function PageIntro({ children, className }: { children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("mt-3 max-w-prose md:mt-4", className)}>
      <p className={cn("text-[0.9375rem] leading-relaxed text-muted-foreground md:line-clamp-none md:text-base", !open && "line-clamp-2")}>{children}</p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-1 text-sm font-semibold text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground md:hidden"
      >
        {open ? "Less" : "More"}
      </button>
    </div>
  );
}
