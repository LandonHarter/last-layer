import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseView } from "@/components/case-view";
import { ALGS, ALGS_BY_ID } from "@/data/algs";

export const dynamicParams = false;

export function generateStaticParams() {
  return ALGS.map((a) => ({ id: a.id }));
}

export async function generateMetadata({ params }: PageProps<"/algs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const alg = ALGS_BY_ID.get(id);
  return { title: alg ? `${alg.name} | Last Layer` : "Last Layer" };
}

export default async function CasePage({ params }: PageProps<"/algs/[id]">) {
  const { id } = await params;
  if (!ALGS_BY_ID.has(id)) notFound();
  return <CaseView id={id} />;
}
