"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Grid3x3Icon, TimerIcon } from "lucide-react";
import { BackupMenu } from "@/components/backup-menu";
import { ThemeSelector } from "@/components/theme-selector";
import { MODE_HOME, modeForPath, setStoredMode, useStoredMode, type Mode } from "@/lib/mode";
import { cn } from "@/lib/utils";

const NAV: Record<Mode, { href: string; label: string }[]> = {
  algs: [
    { href: "/", label: "Library" },
    { href: "/learn", label: "Learn" },
    { href: "/drill", label: "Drill" },
    { href: "/analyze", label: "Analyze" },
  ],
  timer: [
    { href: "/timer", label: "Timer" },
    { href: "/analyze", label: "Analyze" },
  ],
};

const MODES: { id: Mode; label: string; Icon: typeof TimerIcon }[] = [
  { id: "algs", label: "Algorithms", Icon: Grid3x3Icon },
  { id: "timer", label: "Timer", Icon: TimerIcon },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const stored = useStoredMode();
  const pathMode = modeForPath(pathname);
  const mode = pathMode ?? stored;

  // Opening a page of one mode switches to it, so Analyze shows what you were last doing.
  useEffect(() => {
    if (pathMode && pathMode !== stored) setStoredMode(pathMode);
  }, [pathMode, stored]);

  function choose(next: Mode) {
    if (next === mode) return;
    setStoredMode(next);
    if (pathMode) router.push(MODE_HOME[next]);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur transition-opacity duration-200 in-data-timing:pointer-events-none in-data-timing:opacity-0">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-1.5 px-3 sm:gap-4 sm:px-6">
        <Link href={MODE_HOME[mode]} className="mr-1 hidden text-lg font-extrabold tracking-tight sm:block">
          Last Layer
        </Link>
        <div role="radiogroup" aria-label="Mode" className="flex shrink-0 rounded-lg border border-border bg-card p-0.5">
          {MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mode === id}
              aria-label={label}
              onClick={() => choose(id)}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-md px-1.5 text-sm font-semibold transition-colors",
                mode === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
        </div>
        <nav className="flex items-center gap-0.5 sm:gap-1">
          {NAV[mode].map((item) => {
            // Case pages belong to the Library.
            const active = item.href === "/" ? pathname === "/" || pathname.startsWith("/algs") : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-1.5 py-1.5 text-[0.8125rem] font-medium transition-colors sm:px-3 sm:text-sm",
                  active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <BackupMenu />
          <ThemeSelector />
        </div>
      </div>
    </header>
  );
}
