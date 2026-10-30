import type { Metadata } from "next";
import { F2LTrainerView } from "@/components/f2l/trainer-view";

export const metadata: Metadata = {
  title: "F2L solution lab | Last Layer",
  description: "Practice efficient F2L in every slot. Check your moves, compare verified solutions and target your weak spots.",
};

export default function F2LTrainerPage() {
  return <F2LTrainerView />;
}
