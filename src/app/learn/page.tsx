import type { Metadata } from "next";
import { LearnView } from "@/components/learn-view";

export const metadata: Metadata = { title: "Learn | Last Layer" };

export default function LearnPage() {
  return <LearnView />;
}
