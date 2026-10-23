import type { Metadata } from "next";
import Link from "next/link";
import { TOOLS } from "@/components/tools/tool-list";

export const metadata: Metadata = { title: "Tools | Last Layer" };

export default function ToolsPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 md:py-12">
      <div>
        <h1 className="text-[2rem] font-extrabold leading-[1.05] tracking-tight sm:text-5xl">Tools</h1>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-muted-foreground">Helpers for blindfolded, fewest moves and everything around a solve.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map(({ href, name, description, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-lg font-extrabold tracking-tight">{name}</span>
              <span className="text-sm leading-relaxed text-muted-foreground">{description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
