"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpenIcon, ChartLineIcon, GraduationCapIcon, Grid3x3Icon, TargetIcon, TimerIcon, WrenchIcon, type LucideIcon } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { BackupMenu } from "@/components/backup-menu";
import { ThemeSelector } from "@/components/theme-selector";
import { MODE_HOME, modeForPath, setStoredMode, useStoredMode, type Mode } from "@/lib/mode";
import { cn } from "@/lib/utils";

// From md the nav sits in the header; below it, in the tab bar at the bottom of the screen.
const NAV: Record<Mode, { href: string; label: string; Icon: LucideIcon }[]> = {
  algs: [
    { href: "/", label: "Library", Icon: BookOpenIcon },
    { href: "/learn", label: "Learn", Icon: GraduationCapIcon },
    { href: "/drill", label: "Drill", Icon: TargetIcon },
    { href: "/analyze", label: "Analyze", Icon: ChartLineIcon },
    { href: "/tools", label: "Tools", Icon: WrenchIcon },
  ],
  timer: [
    { href: "/timer", label: "Timer", Icon: TimerIcon },
    { href: "/analyze", label: "Analyze", Icon: ChartLineIcon },
    { href: "/tools", label: "Tools", Icon: WrenchIcon },
  ],
};

const MODES: { id: Mode; label: string; Icon: typeof TimerIcon }[] = [
  { id: "algs", label: "Algorithms", Icon: Grid3x3Icon },
  { id: "timer", label: "Timer", Icon: TimerIcon },
];

// Fades out with the header while the timer runs.
const HIDE_WHILE_TIMING = "transition-opacity duration-200 in-data-timing:pointer-events-none in-data-timing:opacity-0";

function useNav() {
  const pathname = usePathname();
  const stored = useStoredMode();
  const pathMode = modeForPath(pathname);
  const mode = pathMode ?? stored;
  // Case pages belong to the Library.
  const isActive = (href: string) => (href === "/" ? pathname === "/" || pathname.startsWith("/algs") : pathname.startsWith(href));
  return { mode, pathMode, stored, items: NAV[mode], isActive };
}

export function SiteHeader() {
  const router = useRouter();
  const { mode, pathMode, stored, items, isActive } = useNav();

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
    <header className={cn("sticky top-0 z-40 border-b border-border bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur", HIDE_WHILE_TIMING)}>
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6 md:gap-4">
        <Link href={MODE_HOME[mode]} className="mr-1 hidden text-lg font-extrabold tracking-tight md:block">
          Last Layer
        </Link>
        <div role="radiogroup" aria-label="Mode" className="flex shrink-0 rounded-lg border border-border bg-card p-0.5">
          {MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mode === id}
              onClick={() => choose(id)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold transition-colors md:h-7 md:px-1.5",
                mode === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
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
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

/** Phones get the nav as a tab bar at the bottom, in thumb reach, with a label under each icon. */
export function TabBar() {
  const { items, isActive } = useNav();
  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden",
        HIDE_WHILE_TIMING,
      )}
    >
      <ul className="mx-auto flex h-16 max-w-lg items-stretch px-2">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href} className="flex flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[0.6875rem] font-semibold transition-colors focus-visible:outline-none",
                  active ? "text-foreground" : "text-muted-foreground active:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring",
                    active ? "bg-foreground text-background" : "group-active:bg-muted",
                  )}
                >
                  <item.Icon className="size-[1.125rem]" aria-hidden="true" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
