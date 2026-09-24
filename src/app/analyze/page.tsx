import type { Metadata } from "next";
import { AnalyzeView } from "@/components/analyze/analyze-view";

export const metadata: Metadata = { title: "Analyze | Last Layer" };

export default function AnalyzePage() {
  return <AnalyzeView />;
}
