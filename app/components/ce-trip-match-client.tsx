"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Discipline } from "@/lib/disciplines";

type MatchEvent = {
  id: string;
  title: string;
  provider_name: string;
  start_date: string;
  end_date: string;
  location: string;
  itinerary: string;
  audience: string;
  credits_text: string;
  card_price: string | null;
  url: string;
};

const audiencePatterns: Record<string, RegExp> = {
  dentistry: /dentist|dental hygienist|dental staff/i,
  medicine: /physician|psychiatrist|medical provider/i,
  nursing: /nurse|nurse practitioner|aprn|rn\b/i,
  pharmacy: /pharmacist|pharmacy technician/i,
  "mental-health": /psychologist|counselor|social worker|psychiatrist/i,
  "physical-therapy": /physical therapist|occupational therapist|\bpt\b|\bot\b/i,
  veterinary: /veterinar/i,
  law: /attorney|lawyer|legal professional/i,
  accounting: /accountant|finance professional|\bcpa\b/i,
};

function formatDateRange(start: string, end: string) {
  const format = (value: string) => new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
  return start === end ? format(start) : `${format(start)} – ${format(end)}`;
}

function matchesDiscipline(event: MatchEvent, slug: string) {
  return audiencePatterns[slug]?.test(event.audience || "") ?? false;
}

export default function CeTripMatchClient({ disciplines, events }: { disciplines: Discipline[]; events: MatchEvent[] }) {
  const [firstDiscipline, setFirstDiscipline] = useState("dentistry");
  const [secondDiscipline, setSecondDiscipline] = useState("medicine");
  const [destination, setDestination] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [searched, setSearched] = useState(false);

  const matches = useMemo(() => {
    if (!searched) return [];
    return events.filter((event) => {
      if (!matchesDiscipline(event, firstDiscipline) || !matchesDiscipline(event, secondDiscipline)) return false;
      const place = `${event.location} ${event.itinerary}`.toLowerCase();
      if (destination.trim() && !place.includes(destination.trim().toLowerCase())) return false;
      if (dateStart && event.end_date < dateStart) return false;
      if (dateEnd && event.start_date > dateEnd) return false;
      return true;
    });
  }, [dateEnd, dateStart, destination, events, firstDiscipline, searched, secondDiscipline]);

  const first = disciplines.find((item) => item.slug === firstDiscipline);
  const second = disciplines.find((item) => item.slug === secondDiscipline);

  function swapDisciplines() {
    setFirstDiscipline(secondDiscipline);
    setSecondDiscipline(firstDiscipline);
    setSearched(false);
  }

  return (
    <div className="match-workspace">
      <section className="match-form card" aria-label="CE trip match search">
        <div className="match-people">
          <label>
            <span>Professional one</span>
            <select value={firstDiscipline} onChange={(event) => { setFirstDiscipline(event.target.value); setSearched(false); }}>
              {disciplines.map((discipline) => <option value={discipline.slug} key={discipline.slug}>{discipline.name}</option>)}
            </select>
          </label>
          <button type="button" className="match-swap" onClick={swapDisciplines} aria-label="Swap disciplines">⇄</button>
          <label>
            <span>Professional two</span>
            <select value={secondDiscipline} onChange={(event) => { setSecondDiscipline(event.target.value); setSearched(false); }}>
              {disciplines.map((discipline) => <option value={discipline.slug} key={discipline.slug}>{discipline.name}</option>)}
            </select>
          </label>
        </div>

        <div className="match-where-when">
          <label>
            <span>Destination or region</span>
            <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Anywhere, Hawaii, Alaska…" />
          </label>
          <label>
            <span>Earliest departure</span>
            <input type="date" value={dateStart} onChange={(event) => setDateStart(event.target.value)} />
          </label>
          <label>
            <span>Latest return</span>
            <input type="date" value={dateEnd} onChange={(event) => setDateEnd(event.target.value)} />
          </label>
          <button type="button" className="button match-search" onClick={() => setSearched(true)}>Find our CE overlap</button>
        </div>
      </section>

      {!searched ? (
        <section className="match-empty">
          <div className="match-visual" aria-hidden="true">
            <span>{first?.shortName.slice(0, 2)}</span><i /><b>+</b><i /><span>{second?.shortName.slice(0, 2)}</span>
          </div>
          <h2>One destination. Two professional goals.</h2>
          <p>Search the current multidisciplinary inventory for an event window that works for both of you.</p>
        </section>
      ) : matches.length ? (
        <section className="match-results" aria-live="polite">
          <div className="section-heading">
            <div>
              <p className="featured-discipline-label">{matches.length} shared-program {matches.length === 1 ? "match" : "matches"}</p>
              <h2>{first?.shortName} + {second?.shortName}</h2>
            </div>
            <p className="match-results__note">Both audiences are named by the provider.</p>
          </div>
          <div className="match-result-grid">
            {matches.map((event) => (
              <article className="match-result card" key={event.id}>
                <div className="match-result__badges">
                  <span>Shared program</span>
                  <span>{event.credits_text}</span>
                </div>
                <div>
                  <p className="match-result__provider">{event.provider_name}</p>
                  <h3>{event.title}</h3>
                </div>
                <dl>
                  <div><dt>When</dt><dd>{formatDateRange(event.start_date, event.end_date)}</dd></div>
                  <div><dt>Starts in</dt><dd>{event.location}</dd></div>
                  <div><dt>For</dt><dd>{event.audience}</dd></div>
                </dl>
                <div className="match-result__actions">
                  <a className="button" href={event.url} target="_blank" rel="noreferrer">View provider details</a>
                  {event.card_price ? <strong>{event.card_price}</strong> : null}
                </div>
              </article>
            ))}
          </div>
          <div className="launch-note">
            <strong>Eligibility note:</strong>
            <span>Audience and credit language come from the provider. Each traveler must confirm that the program satisfies their own board and specialty requirements.</span>
          </div>
        </section>
      ) : (
        <section className="match-empty match-empty--no-results" aria-live="polite">
          <p className="featured-discipline-label">No verified overlap yet</p>
          <h2>We don’t have a confident match for that pair and window.</h2>
          <p>Try a broader destination or date range. Paired-course matching will expand as each discipline’s catalog comes online.</p>
          <div className="hero__actions">
            <button type="button" className="button" onClick={() => { setDestination(""); setDateStart(""); setDateEnd(""); setSearched(false); }}>Broaden the search</button>
            <Link href="/#disciplines" className="button button-secondary">Explore disciplines</Link>
          </div>
        </section>
      )}

      <section className="match-explainer">
        <div className="card">
          <span>1</span><h3>Choose both disciplines</h3><p>Start with each traveler’s licensed profession. Specialty-level matching comes next.</p>
        </div>
        <div className="card">
          <span>2</span><h3>Find the overlap</h3><p>We compare audiences, destination, and dates—not just course keywords.</p>
        </div>
        <div className="card">
          <span>3</span><h3>Verify and plan together</h3><p>Confirm individual eligibility with each provider, then build the shared trip.</p>
        </div>
      </section>
    </div>
  );
}
