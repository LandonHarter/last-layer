"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addSession, deleteSession, setCurrentSession, useTimerData } from "@/lib/solves";

/** Pick the session new solves go into, or start a new one. */
export function SessionPicker() {
  const data = useTimerData();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const items = data.sessions.map((s) => ({ value: s.id, label: s.name }));
  const current = data.sessions.find((s) => s.id === data.current);
  const count = data.solves.filter((s) => s.session === data.current).length;

  function create(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    addSession(trimmed);
    setName("");
    setOpen(false);
    toast(`Started ${trimmed}`);
  }

  return (
    <div className="flex items-center gap-1">
      <Select items={items} value={data.current} onValueChange={(v) => v && setCurrentSession(v)}>
        <SelectTrigger size="sm" className="min-w-28" aria-label="Session">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          setConfirming(false);
        }}
      >
        <PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Sessions" className="text-muted-foreground" />}>
          <PlusIcon />
        </PopoverTrigger>
        <PopoverContent className="w-72 gap-4 p-4">
          <form onSubmit={create} className="flex flex-col gap-2">
            <label htmlFor="session-name" className="text-sm font-medium">
              New session
            </label>
            <div className="flex gap-2">
              <Input id="session-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="One-handed, practice…" />
              <Button type="submit" disabled={!name.trim()}>
                Start
              </Button>
            </div>
          </form>
          {data.sessions.length > 1 && current && (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <p className="text-sm text-muted-foreground">
                {current.name} has {count} {count === 1 ? "solve" : "solves"}.
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="self-start"
                onClick={() => {
                  if (!confirming) return setConfirming(true);
                  deleteSession(current.id);
                  setOpen(false);
                }}
              >
                {confirming ? `Delete ${current.name} and its solves` : `Delete ${current.name}`}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
