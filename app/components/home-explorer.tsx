"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const quickFilters = [
  { label: "In-person", href: "/courses?format=In%20Person" },
  { label: "Online", href: "/courses?format=Online" },
  { label: "Cruises", href: "/cruises" },
  { label: "Trip Match", href: "/match" },
];

export default function HomeExplorer() {
  const router = useRouter();
  const [discipline, setDiscipline] = useState("Dentistry");
  const [location, setLocation] = useState("");
  const [when, setWhen] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (location.trim()) params.set("search", location.trim());
    if (when) params.set("search", [location.trim(), when].filter(Boolean).join(" "));
    if (discipline !== "Dentistry") {
      router.push(`/disciplines/${discipline.toLowerCase()}`);
      return;
    }
    router.push(`/courses${params.size ? `?${params}` : ""}`);
  }

  return (
    <section className="atlas-explorer atlas-explorer--photo" aria-labelledby="explorer-title">
      <div className="atlas-explorer__shade" aria-hidden="true" />
      <div className="atlas-explorer__copy">
        <span className="atlas-kicker atlas-kicker--pill">Learn somewhere unforgettable</span>
        <h1 id="explorer-title">Your next course comes with a view.</h1>
        <p>Curated continuing education in extraordinary places. Compare your course, credits, and travel options—all in one place.</p>

        <form className="atlas-search" onSubmit={submit}>
          <label>
            <span>Destination</span>
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Where do you want to go?" />
          </label>
          <label>
            <span>Specialty</span>
            <select value={discipline} onChange={(event) => setDiscipline(event.target.value)}>
              <option>Dentistry</option>
              <option>Medicine</option>
              <option>Nursing</option>
              <option>Veterinary</option>
              <option>Law</option>
            </select>
          </label>
          <label>
            <span>Travel dates</span>
            <input type="month" value={when} onChange={(event) => setWhen(event.target.value)} aria-label="Travel month" />
          </label>
          <button type="submit" aria-label="Search continuing education">Search <span>→</span></button>
        </form>

        <div className="atlas-quick" aria-label="Popular filters">
          {quickFilters.map((filter) => <button type="button" key={filter.label} onClick={() => router.push(filter.href)}>{filter.label}</button>)}
        </div>
      </div>
    </section>
  );
}
