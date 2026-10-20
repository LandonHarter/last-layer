"use client";

import { useEffect, useRef, useState } from "react";
import { HardDriveIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parseBackup, replaceAccountData } from "@/lib/backup";
import { localItems } from "@/lib/storage";
import { DRILL_KEY, TIMER_KEY } from "@/lib/user-data";

const PROGRESS_KEY = "last-layer:progress:v1";

/** "12 cases, 340 solves", or null when there's nothing worth bringing over. */
function describe(data: Record<string, unknown>): string | null {
  const cases = Object.keys((data[PROGRESS_KEY] as object | undefined) ?? {}).length;
  const solves = ((data[TIMER_KEY] as { solves?: unknown[] } | undefined)?.solves ?? []).length;
  const drills = ((data[DRILL_KEY] as unknown[] | undefined) ?? []).length;
  const parts = [
    cases && `${cases} ${cases === 1 ? "case" : "cases"}`,
    solves && `${solves} ${solves === 1 ? "solve" : "solves"}`,
    drills && `${drills} drill ${drills === 1 ? "answer" : "answers"}`,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/** Shown once for a new account: load a backup, bring this browser's data, or start fresh. */
export function OnboardingDialog() {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<{ data: Record<string, unknown>; summary: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // localStorage only exists in the browser, so look once mounted.
  useEffect(() => {
    const data = localItems();
    const summary = describe(data);
    if (summary) setLocal({ data, summary });
  }, []);

  async function use(data: Record<string, unknown>) {
    setBusy(true);
    try {
      await replaceAccountData(data);
      window.location.reload();
    } catch {
      setBusy(false);
      toast("Couldn't save to your account", { description: "Check your connection and try again." });
    }
  }

  async function load(file: File) {
    let data: Record<string, unknown>;
    try {
      data = parseBackup(await file.text()).data;
    } catch {
      return toast("Couldn't load that file", { description: "Pick a file saved with Save backup." });
    }
    await use(data);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bring your data with you</DialogTitle>
          <DialogDescription>
            Your progress, algorithms, solves and drill log are now saved to your account, so you can pick up on any device. Load a backup file to carry on
            where you left off.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button size="lg" disabled={busy} onClick={() => fileRef.current?.click()}>
            <UploadIcon data-icon="inline-start" />
            Load backup file
          </Button>
          {local && (
            <Button size="lg" variant="outline" className="h-auto min-h-9 whitespace-normal py-2" disabled={busy} onClick={() => use(local.data)}>
              <HardDriveIcon data-icon="inline-start" />
              Use this browser&apos;s data ({local.summary})
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => use({})}>
            Start fresh
          </Button>
        </DialogFooter>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) load(f);
            e.target.value = "";
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
