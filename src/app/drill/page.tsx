import type { Metadata } from "next";
import { DrillView } from "@/components/drill-view";

export const metadata: Metadata = { title: "Drill | Last Layer" };

export default function DrillPage() {
  return <DrillView />;
}
