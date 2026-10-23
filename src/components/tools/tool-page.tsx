import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Page frame shared by every tool: a link back to Tools, the title, a line on what it does. */
export function ToolPage({ title, description, children, className }: { title: string; description: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 md:py-12", className)}>
      <div>
        <Link href="/tools" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
          Tools
        </Link>
        <h1 className="mt-2 text-[2rem] font-extrabold leading-[1.05] tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
