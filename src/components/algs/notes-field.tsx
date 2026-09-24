"use client";

import { useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { setNotes } from "@/lib/progress";
import { cn } from "@/lib/utils";

/** Your notes for a case, saved as you type. Drill shows them as a hint. */
export function NotesField({
  id,
  notes,
  onDone,
  autoFocus,
  className,
}: {
  id: string;
  notes: string | undefined;
  /** Called on Escape, for inline editors that close. */
  onDone?: () => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const placed = useRef(false);
  return (
    <Textarea
      value={notes ?? ""}
      onChange={(e) => setNotes(id, e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && onDone) {
          e.preventDefault();
          onDone();
        }
      }}
      autoFocus={autoFocus}
      onFocus={(e) => {
        // Opened to edit: carry on from the end of what you wrote.
        if (!autoFocus || placed.current) return;
        placed.current = true;
        e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length);
      }}
      placeholder="What helps you remember it, like “Sune from the back, then the sexy move”"
      aria-label="Your notes"
      className={cn(className)}
    />
  );
}
