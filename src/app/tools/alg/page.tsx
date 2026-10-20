import type { Metadata } from "next";
import { AlgView } from "@/components/tools/alg-view";
import { ToolPage } from "@/components/tools/tool-page";

export const metadata: Metadata = { title: "Algorithm toolkit | Last Layer" };

export default function AlgPage() {
  return (
    <ToolPage title="Algorithm toolkit" description="Paste a 3x3 algorithm to get its inverse, mirrors, a cleaned-up version and its move counts, and see what it does to a solved cube.">
      <AlgView />
    </ToolPage>
  );
}
