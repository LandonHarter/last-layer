import type { Metadata } from "next";
import { ScramblesView } from "@/components/tools/scrambles-view";
import { ToolPage } from "@/components/tools/tool-page";

export const metadata: Metadata = { title: "Scramble sheet | Last Layer" };

export default function ScramblesPage() {
  return (
    <ToolPage title="Scramble sheet" description="A numbered batch of scrambles for any puzzle. 3x3 scrambles are random-state, like the WCA's; copy or print the lot.">
      <ScramblesView />
    </ToolPage>
  );
}
