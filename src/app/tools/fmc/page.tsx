import type { Metadata } from "next";
import { FmcView } from "@/components/tools/fmc-view";
import { ToolPage } from "@/components/tools/tool-page";

export const metadata: Metadata = { title: "Fewest moves | Last Layer" };

export default function FmcPage() {
  return (
    <ToolPage title="Fewest moves" description="A random-state scramble with WCA padding and an hour on the clock. Type your solution as you go: it's counted in HTM and checked on a simulator.">
      <FmcView />
    </ToolPage>
  );
}
