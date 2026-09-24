"use client";

import { useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FlatFace, IsoCube } from "@/components/cube-art";
import { THEMES, themeById } from "@/lib/themes";
import { cn } from "@/lib/utils";

const useMounted = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState<string | null>(null);
  const current = themeById(mounted ? theme : undefined);

  function choose(id: string, event: React.MouseEvent<HTMLButtonElement>) {
    if (id === theme) return setOpen(false);
    setSpinning(id);
    const rect = event.currentTarget.getBoundingClientRect();
    const root = document.documentElement;
    root.style.setProperty("--wipe-x", `${rect.left + rect.width / 2}px`);
    root.style.setProperty("--wipe-y", `${rect.top + rect.height / 2}px`);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const apply = () => flushSync(() => setTheme(id));
    // Let the cube finish its turn before the page changes underneath it.
    window.setTimeout(
      () => {
        if (!reduced && document.startViewTransition) document.startViewTransition(apply);
        else apply();
        setSpinning(null);
        setOpen(false);
      },
      reduced ? 0 : 260,
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Theme: ${current.name}. Change theme`}
        className="group flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-1.5 pr-3 text-sm font-medium transition-colors hover:bg-muted"
      >
        <FlatFace stickers={current.stickers} className="size-6 transition-transform duration-300 group-hover:rotate-90 motion-reduce:transition-none" />
        <span className="hidden sm:inline">{current.name}</span>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(94vw,46rem)] gap-3 p-3">
        <p className="px-1 text-sm font-semibold">Pick a cube</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {THEMES.map((t) => {
            const active = mounted && t.id === theme;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                onClick={(e) => choose(t.id, e)}
                className={cn(
                  "group/theme flex flex-col items-start gap-2 rounded-lg border p-2 text-left transition-colors",
                  active ? "border-ring ring-2 ring-ring/40" : "border-border hover:border-foreground/30",
                )}
              >
                <span
                  className="flex h-24 w-full items-center justify-center rounded-md"
                  style={{ background: t.surface }}
                >
                  <IsoCube
                    stickers={t.stickers}
                    className={cn(
                      "h-20 transition-transform duration-300 ease-out group-hover/theme:-translate-y-0.5 motion-reduce:transition-none",
                      spinning === t.id && "rotate-90 scale-110",
                    )}
                  />
                </span>
                <span className="px-0.5">
                  <span className="block text-sm font-semibold leading-tight">{t.name}</span>
                  <span className="block text-xs leading-snug text-muted-foreground">{t.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
