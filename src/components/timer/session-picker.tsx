"use client";

import { useState } from "react";
import { SlidersHorizontalIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIMER_PUZZLE_NAMES, TIMER_PUZZLES, type TimerPuzzle } from "@/lib/scramble";
import {
  addSession,
  deleteSession,
  renameSession,
  restoreSession,
  sessionPuzzle,
  setCurrentSession,
  setSessionPuzzle,
  useTimerData,
  type Session,
} from "@/lib/solves";
import { cn } from "@/lib/utils";

const PUZZLE_ITEMS = TIMER_PUZZLES.map((p) => ({ value: p, label: TIMER_PUZZLE_NAMES[p] }));

function PuzzleSelect({ value, onChange, id }: { value: TimerPuzzle; onChange: (p: TimerPuzzle) => void; id?: string }) {
  return (
    <Select items={PUZZLE_ITEMS} value={value} onValueChange={(v) => v && onChange(v as TimerPuzzle)}>
      <SelectTrigger id={id} className="w-32 shrink-0" aria-label="Puzzle">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {PUZZLE_ITEMS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Pick the session new solves go into, and manage sessions: rename, change puzzle, add, delete. */
export function SessionPicker() {
  const data = useTimerData();
  const [open, setOpen] = useState(false);
  const current = data.sessions.find((s) => s.id === data.current);
  const items = data.sessions.map((s) => ({ value: s.id, label: s.name }));

  return (
    <div className="flex items-center gap-1">
      <Select items={items} value={data.current} onValueChange={(v) => v && setCurrentSession(v as string)}>
        <SelectTrigger size="sm" className="min-w-28" aria-label="Session">
          <SelectValue />
          <span className="text-muted-foreground">{TIMER_PUZZLE_NAMES[sessionPuzzle(current)]}</span>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start" className="w-auto min-w-(--anchor-width)">
          {data.sessions.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
              <span className="ml-auto pl-4 text-muted-foreground">{TIMER_PUZZLE_NAMES[sessionPuzzle(s)]}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Manage sessions" className="text-muted-foreground" />}>
          <SlidersHorizontalIcon />
        </PopoverTrigger>
        <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] gap-5 p-4">
          {current && <CurrentSession key={current.id} session={current} />}
          <NewSession onDone={() => setOpen(false)} />
          <SessionList />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function CurrentSession({ session }: { session: Session }) {
  const [name, setName] = useState(session.name);
  const save = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== session.name) renameSession(session.id, trimmed);
    else setName(session.name);
  };
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label htmlFor="session-rename" className="text-sm font-medium">
        This session
      </label>
      <div className="flex gap-2">
        <Input id="session-rename" value={name} onChange={(e) => setName(e.target.value)} onBlur={save} aria-label="Session name" />
        <PuzzleSelect value={sessionPuzzle(session)} onChange={(p) => setSessionPuzzle(session.id, p)} />
      </div>
    </form>
  );
}

function NewSession({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [puzzle, setPuzzle] = useState<TimerPuzzle>("3x3");
  function create(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    addSession(trimmed, puzzle);
    setName("");
    onDone();
    toast(`Started ${trimmed}`);
  }
  return (
    <form onSubmit={create} className="flex flex-col gap-2 border-t border-border pt-4">
      <label htmlFor="session-name" className="text-sm font-medium">
        New session
      </label>
      <div className="flex gap-2">
        <Input id="session-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="One-handed, practice…" />
        <PuzzleSelect value={puzzle} onChange={setPuzzle} />
      </div>
      <Button type="submit" size="sm" className="self-start" disabled={!name.trim()}>
        Start
      </Button>
    </form>
  );
}

function SessionList() {
  const data = useTimerData();
  // The session waiting for a second click to confirm.
  const [confirming, setConfirming] = useState<string | null>(null);

  function remove(session: Session) {
    if (confirming !== session.id) return setConfirming(session.id);
    setConfirming(null);
    const solves = data.solves.filter((s) => s.session === session.id);
    const wasCurrent = data.current === session.id;
    const standIn = deleteSession(session.id);
    toast(`Deleted ${session.name}`, { action: { label: "Undo", onClick: () => restoreSession(session, solves, wasCurrent, standIn) } });
  }

  return (
    <div className="flex flex-col gap-1 border-t border-border pt-4">
      <p className="mb-1 text-sm font-medium">All sessions</p>
      <ul className="-mx-2 flex max-h-56 flex-col overflow-y-auto">
        {data.sessions.map((s) => {
          const count = data.solves.filter((x) => x.session === s.id).length;
          const asking = confirming === s.id;
          return (
            <li key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted">
              <button
                type="button"
                className={cn("min-w-0 flex-1 truncate text-left text-sm", s.id === data.current && "font-semibold")}
                onClick={() => setCurrentSession(s.id)}
                aria-current={s.id === data.current || undefined}
              >
                {s.name}
              </button>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {TIMER_PUZZLE_NAMES[sessionPuzzle(s)]} · {count} {count === 1 ? "solve" : "solves"}
              </span>
              <Button
                variant={asking ? "destructive" : "ghost"}
                size={asking ? "xs" : "icon-xs"}
                className={cn(!asking && "text-muted-foreground hover:text-missed")}
                aria-label={asking ? `Delete ${s.name} and its solves` : `Delete ${s.name}`}
                onClick={() => remove(s)}
                onBlur={() => asking && setConfirming(null)}
              >
                {asking ? "Delete?" : <Trash2Icon />}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
