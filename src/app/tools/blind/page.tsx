import type { Metadata } from "next";
import { BlindView } from "@/components/tools/blind-view";
import { ToolPage } from "@/components/tools/tool-page";

export const metadata: Metadata = { title: "Blindfolded memo | Last Layer" };

export default function BlindPage() {
  return (
    <ToolPage
      title="Blindfolded memo"
      description="Pick how you hold the cube, your buffers and your letters. Any scramble becomes the edge and corner targets in order, in pairs, with parity called out."
    >
      <BlindView />
    </ToolPage>
  );
}
