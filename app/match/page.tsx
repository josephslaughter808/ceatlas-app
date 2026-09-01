import type { Metadata } from "next";
import CeTripMatchClient from "../components/ce-trip-match-client";
import { disciplines } from "@/lib/disciplines";
import { getCruises } from "@/lib/cruises";

export const metadata: Metadata = {
  title: "CE Trip Match",
  description: "Find continuing education for two professional disciplines in the same destination and date window.",
};

type MatchPageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function MatchPage({ searchParams }: MatchPageProps) {
  const events = await getCruises();
  const params = (await searchParams) || {};
  const requestedFirst = Array.isArray(params.first) ? params.first[0] : params.first;
  const requestedSecond = Array.isArray(params.second) ? params.second[0] : params.second;
  const validSlugs = new Set(disciplines.map((discipline) => discipline.slug));
  const initialFirst = requestedFirst && validSlugs.has(requestedFirst) ? requestedFirst : "dentistry";
  const initialSecond = requestedSecond && validSlugs.has(requestedSecond) ? requestedSecond : "medicine";
  return (
    <div className="container match-page">
      <section className="match-hero">
        <p className="hero__eyebrow">CE Trip Match</p>
        <h1>Build one trip around two careers.</h1>
        <p>
          Pair two professional disciplines and find CE that brings you to the same place at the same time—without
          making either person’s education an afterthought.
        </p>
      </section>
      <CeTripMatchClient disciplines={disciplines} events={events} initialFirst={initialFirst} initialSecond={initialSecond} />
    </div>
  );
}
