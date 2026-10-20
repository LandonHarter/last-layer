import type { Metadata } from "next";
import { AverageView } from "@/components/tools/average-view";
import { ToolPage } from "@/components/tools/tool-page";

export const metadata: Metadata = { title: "Average calculator | Last Layer" };

export default function AveragePage() {
  return (
    <ToolPage title="Average calculator" description="Type your times for a WCA average, and see the best and worst you can still get and what you need on the last solve.">
      <AverageView />
    </ToolPage>
  );
}
