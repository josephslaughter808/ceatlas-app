"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import AtlasHomeMap from "./atlas-home-map";

const quickFilters = ["This month", "In-person", "Weekend", "Under $500"];

export default function HomeExplorer() {
  const router = useRouter();
  const [discipline, setDiscipline] = useState("Dentistry");
  const [location, setLocation] = useState("");
  const [when, setWhen] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (location.trim()) params.set("location", location.trim());
    if (when) params.set("date", when);
    if (discipline !== "Dentistry") params.set("discipline", discipline.toLowerCase());
    router.push(`/courses${params.size ? `?${params}` : ""}`);
  }

  return (
    <section className="atlas-explorer" aria-labelledby="explorer-title">
      <div className="atlas-explorer__copy">
        <span className="atlas-kicker">CE that takes you places</span>
        <h1 id="explorer-title">Learn somewhere <em>worth going.</em></h1>
        <p>Find accredited continuing education, see it on the map, and plan the trip around it—all in one place.</p>

        <form className="atlas-search" onSubmit={submit}>
          <label>
            <span>Profession</span>
            <select value={discipline} onChange={(event) => setDiscipline(event.target.value)}>
              <option>Dentistry</option>
              <option>Medicine</option>
              <option>Nursing</option>
              <option>Veterinary</option>
              <option>Law</option>
            </select>
          </label>
          <label>
            <span>Where</span>
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City, state, or anywhere" />
          </label>
          <label>
            <span>When</span>
            <input type="month" value={when} onChange={(event) => setWhen(event.target.value)} aria-label="Travel month" />
          </label>
          <button type="submit" aria-label="Search continuing education">Explore courses <span>→</span></button>
        </form>

        <div className="atlas-quick" aria-label="Popular filters">
          <span>Popular:</span>
          {quickFilters.map((filter) => <button type="button" key={filter} onClick={() => router.push("/courses")}>{filter}</button>)}
        </div>
      </div>

      <div className="atlas-map-card">
        <div className="atlas-map-card__top">
          <div><span className="live-dot" /> Live course map</div>
          <a href="/courses">Open full map ↗</a>
        </div>
        <AtlasHomeMap />
        <div className="atlas-map-card__legend"><strong>100+ destinations</strong><span>Click a pin to explore</span></div>
      </div>
    </section>
  );
}
