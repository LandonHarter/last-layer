"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseTypedTime } from "@/lib/average";
import { formatSolve, type Penalty } from "@/lib/solves";
import { cn } from "@/lib/utils";

export type TypedTime = { ms: number; penalty: Penalty };

const HINT = "Like 12.34, 11:02.34, 1234 or DNF. Add + for a +2.";

/** What a typed time will be saved as, or why it can't be. */
function preview(text: string) {
  if (!text.trim()) return { time: null, line: HINT };
  const time = parseTypedTime(text);
  return { time, line: time ? `Saves as ${formatSolve(time)}` : `Not a time. ${HINT}` };
}

/** Typing mode: the clock face is a field, and Enter saves what's in it. */
export function TypedClock({ onAdd, last, className }: { onAdd: (t: TypedTime) => void; last: string; className?: string }) {
  const [text, setText] = useState("");
  const { time, line } = preview(text);
  return (
    <form
      className="flex flex-col items-center"
      onSubmit={(e) => {
        e.preventDefault();
        if (!time) return;
        onAdd(time);
        setText("");
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        inputMode="decimal"
        autoComplete="off"
        autoFocus
        aria-label="Time"
        aria-invalid={!!text.trim() && !time}
        placeholder={last}
        className={cn(
          "w-[min(90vw,9ch)] rounded-lg border-b-2 border-border bg-transparent text-center outline-none placeholder:text-muted-foreground/50 focus-visible:border-ring aria-invalid:border-missed",
          className,
        )}
      />
      <p className={cn("mt-3 text-sm", text.trim() && !time ? "text-missed" : "text-muted-foreground")} aria-live="polite">
        {time ? <>{line}. Press <kbd className="font-sans font-medium">Enter</kbd>.</> : line}
      </p>
    </form>
  );
}

/** Add a time the clock didn't catch, whatever the timer is set to. */
export function AddTimeButton({ onAdd }: { onAdd: (t: TypedTime) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const { time, line } = preview(text);
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setText("");
      }}
    >
      <PopoverTrigger render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}>
        <PlusIcon data-icon="inline-start" />
        Add time
      </PopoverTrigger>
      <PopoverContent className="w-80 gap-3 p-4">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!time) return;
            onAdd(time);
            setOpen(false);
            setText("");
          }}
        >
          <label htmlFor="add-time" className="text-sm font-medium">
            Time
          </label>
          <div className="flex gap-2">
            <Input
              id="add-time"
              value={text}
              onChange={(e) => setText(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              aria-invalid={!!text.trim() && !time}
              placeholder="11:02.34"
              className="h-9 font-mono"
            />
            <Button type="submit" className="h-9" disabled={!time}>
              Add
            </Button>
          </div>
          <p className={cn("text-xs leading-relaxed", text.trim() && !time ? "text-missed" : "text-muted-foreground")} aria-live="polite">
            {line}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">Saved to this session with the scramble above, then you get a new one.</p>
        </form>
      </PopoverContent>
    </Popover>
  );
}
