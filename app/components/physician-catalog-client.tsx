"use client";

import { FormEvent, useState } from "react";
import type { PhysicianCourse } from "@/lib/physician-courses";

type CatalogResponse = {
  courses: PhysicianCourse[];
  total: number;
  page: number;
  pages: number;
  facets: { specialties: string[]; formats: string[] };
  generatedAt: string;
};

function readableDate(value: string) {
  if (!value) return "Available now";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function PhysicianCatalogClient({ initial, discipline = "physician" }: { initial: CatalogResponse; discipline?: "physician" | "veterinary" }) {
  const isVeterinary = discipline === "veterinary";
  const [result, setResult] = useState(initial);
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [format, setFormat] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(page: number, values = { query, specialty, format }) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "12" });
      if (values.query) params.set("q", values.query);
      if (values.specialty) params.set("specialty", values.specialty);
      if (values.format) params.set("format", values.format);
      const response = await fetch(`/api/${isVeterinary ? "veterinary" : "physician"}-courses?${params}`);
      if (!response.ok) throw new Error("Catalog search failed");
      setResult(await response.json());
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void load(1);
  }

  return (
    <section className="physician-catalog" aria-label={`${isVeterinary ? "Veterinary" : "Physician"} CE catalog`}>
      <div className="discipline-proof-catalog__heading">
        <div>
          <p className="hero__eyebrow hero__eyebrow--dark">Accredited {isVeterinary ? "veterinary" : "physician"} catalog</p>
          <h2>Search {initial.total.toLocaleString()} active {isVeterinary ? "veterinary CE" : "CME"} activities.</h2>
          <p>{isVeterinary ? "Every listing is current and comes from CE Broker’s official AAVSB RACE-approved catalog." : "Every listing below is active in ACCME CME Passport, has a future availability end date, and carries physician CME credit."}</p>
        </div>
        <span className="discipline-proof-catalog__refresh">Updated {readableDate(initial.generatedAt.slice(0, 10))}</span>
      </div>

      <form className="physician-catalog__filters card" onSubmit={submit}>
        <label><span>Search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Topic, course, or provider" /></label>
        <label><span>Specialty</span><select value={specialty} onChange={(event) => setSpecialty(event.target.value)}><option value="">All specialties</option>{initial.facets.specialties.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
        <label><span>Format</span><select value={format} onChange={(event) => setFormat(event.target.value)}><option value="">All formats</option>{initial.facets.formats.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
        <button className="button" disabled={loading}>{loading ? "Searching…" : `Search ${isVeterinary ? "CE" : "CME"}`}</button>
      </form>

      <div className="physician-catalog__status"><strong>{result.total.toLocaleString()} activities</strong><span>Page {result.page} of {result.pages}</span></div>
      <div className={`discipline-proof-grid physician-catalog__grid${loading ? " physician-catalog__grid--loading" : ""}`}>
        {result.courses.map((course) => (
          <article className="discipline-proof-card card" key={course.metadata?.accme_activity_id || `${course.provider}-${course.title}`}>
            <div className="discipline-proof-card__badges"><span>{course.format}</span>{course.metadata?.is_moc && <span>Counts for MOC</span>}{course.metadata?.registration && <span>{course.metadata.registration}</span>}</div>
            <div><p className="discipline-proof-card__provider">{course.provider}</p><h3>{course.title}</h3><p>{course.description}</p></div>
            <dl>
              <div><dt>Credit</dt><dd>{course.credits_text}</dd></div>
              <div><dt>Available</dt><dd>Through {readableDate(course.end_date)}</dd></div>
              <div><dt>Specialty</dt><dd>{course.topic}</dd></div>
              <div><dt>Where</dt><dd>{course.location}</dd></div>
            </dl>
            <a className="discipline-proof-card__link" href={course.url} target="_blank" rel="noreferrer">View accredited {isVeterinary ? "CE" : "CME"} <span aria-hidden="true">↗</span></a>
          </article>
        ))}
      </div>
      {!result.courses.length && <div className="card physician-catalog__empty"><h3>No CME matched those filters.</h3><p>Try a broader topic or clear one of the filters.</p></div>}
      <div className="physician-catalog__pagination">
        <button className="button button--light" disabled={loading || result.page <= 1} onClick={() => void load(result.page - 1)}>← Previous</button>
        <span>Page {result.page.toLocaleString()} of {result.pages.toLocaleString()}</span>
        <button className="button button--light" disabled={loading || result.page >= result.pages} onClick={() => void load(result.page + 1)}>Next →</button>
      </div>
      <p className="discipline-proof-catalog__note">Source: {isVeterinary ? "AAVSB RACE via CE Broker" : "ACCME CME Passport"}. Verify registration availability and jurisdiction requirements with the accredited provider before enrolling.</p>
    </section>
  );
}
