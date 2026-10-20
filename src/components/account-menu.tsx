"use client";

import { LogInIcon, LogOutIcon } from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "@/components/account-provider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { signInWithGoogle, signOut } from "@/lib/auth-client";
import { flush, useSyncStatus, type SyncStatus } from "@/lib/storage";
import { cn } from "@/lib/utils";

const STATUS: Record<SyncStatus, string> = {
  saved: "Saved to your account",
  saving: "Saving…",
  retrying: "Couldn't save. Trying again…",
};

const trigger =
  "flex size-9 items-center justify-center overflow-hidden rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

export function AccountMenu() {
  const user = useAccount();
  const status = useSyncStatus();

  if (!user) {
    return (
      <Popover>
        <PopoverTrigger aria-label="Sign in" className={trigger}>
          <LogInIcon className="size-4" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-80 gap-3 p-3">
          <p className="font-semibold">Sign in</p>
          <p className="text-muted-foreground">Save your progress, algorithms and solves to an account, and carry on from any device.</p>
          <Button
            size="sm"
            onClick={() =>
              signInWithGoogle().catch(() => toast("Couldn't sign in", { description: "Check your connection and try again." }))
            }
          >
            Continue with Google
          </Button>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover>
      <PopoverTrigger aria-label={`Account: ${user.name}`} className={trigger}>
        {user.image ? (
          // Google's avatar host isn't configured for next/image, and it's 36px anyway.
          <img src={user.image} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
        ) : (
          <span className="text-sm font-bold text-foreground">{user.name.slice(0, 1).toUpperCase()}</span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 gap-3 p-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{user.name}</p>
          <p className="truncate text-muted-foreground">{user.email}</p>
        </div>
        <p className={cn("text-sm", status === "retrying" ? "text-missed" : "text-muted-foreground")} aria-live="polite">
          {STATUS[status]}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await flush();
            await signOut();
          }}
        >
          <LogOutIcon data-icon="inline-start" />
          Sign out
        </Button>
      </PopoverContent>
    </Popover>
  );
}
