"use client";

import { useRef, useState } from "react";
import { DatabaseBackupIcon, DownloadIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "@/components/account-provider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { downloadBackup, parseBackup, restoreBackup, type Backup } from "@/lib/backup";

const dateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function BackupMenu() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Backup | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const user = useAccount();
  const where = user ? "your account" : "this browser";

  async function load(file: File) {
    try {
      setPending(parseBackup(await file.text()));
      setOpen(true);
    } catch {
      toast("Couldn't load that file", {
        description: "Pick a file saved here with Save backup.",
      });
    }
  }

  async function replace() {
    if (!pending) return;
    setBusy(true);
    try {
      await restoreBackup(pending);
      window.location.reload();
    } catch {
      setBusy(false);
      toast("Couldn't load the backup", { description: "Check your connection and try again." });
    }
  }

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setPending(null);
        }}
      >
        <PopoverTrigger
          aria-label="Backup and restore"
          className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <DatabaseBackupIcon className="size-4" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-80 gap-3 p-3">
          {pending ? (
            <>
              <p className="font-semibold">Replace {user ? "your account's" : "this browser's"} data?</p>
              <p className="text-muted-foreground">
                Your progress, algorithms, solves and drill log in {where} will be swapped for the backup saved{" "}
                {dateTime.format(new Date(pending.exportedAt))}. Save a backup first if you want to keep them.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" size="sm" disabled={busy} onClick={replace}>
                  Replace
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="font-semibold">Your data</p>
              <p className="text-muted-foreground">
                {user
                  ? "Everything is saved to your account. Save a backup to keep a copy of your own."
                  : "Everything is kept in this browser. Save a backup, then load it in another browser to carry on there, or sign in to save it to an account."}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={downloadBackup}>
                  <DownloadIcon data-icon="inline-start" />
                  Save backup
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}>
                  <UploadIcon data-icon="inline-start" />
                  Load backup
                </Button>
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
      {/* Outside the popover, which can close while the file picker is open. */}
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
    </>
  );
}
