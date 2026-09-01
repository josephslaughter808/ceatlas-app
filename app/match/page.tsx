import type { Metadata } from "next";
import CeTripMatchClient from "../components/ce-trip-match-client";
import { disciplines } from "@/lib/disciplines";
import { getCruises } from "@/lib/cruises";

export const metadata: Metadata = {
  title: "CE Trip Match",
  description: "Find continuing education for two professional disciplines in the same destination and date window.",
};

export default async function MatchPage() {
  const events = await getCruises();
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
      <CeTripMatchClient disciplines={disciplines} events={events} />
    </div>
  );
}
