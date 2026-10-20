import type { Metadata } from "next";
import { SolverView } from "@/components/tools/solver-view";
import { ToolPage } from "@/components/tools/tool-page";

export const metadata: Metadata = { title: "Solver | Last Layer" };

export default function SolverPage() {
  return (
    <ToolPage title="Solver" description="Type a 3x3 scramble and get a solution of 22 moves or fewer.">
      <SolverView />
    </ToolPage>
  );
}
