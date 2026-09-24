import type { Metadata } from "next";
import { TimerView } from "@/components/timer/timer-view";

export const metadata: Metadata = { title: "Timer | Last Layer" };

export default function TimerPage() {
  return <TimerView />;
}
