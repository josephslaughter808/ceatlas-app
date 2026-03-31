"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCompare } from "./compare-provider";

function formatRating(value: number | null | undefined, count: number | null | undefined) {
  if (typeof value !== "number") return "No ratings yet";
  return `${value.toFixed(1)}★${count ? ` (${count})` : ""}`;
}

export default function ComparePageClient() {
  const { items, clearAll, clearKind } = useCompare();
  const [kind, setKind] = useState<"course" | "cruise" | "flight" | "hotel" | "car">("course");

  const grouped = useMemo(() => ({
    course: items.filter((item) => item.kind === "course"),
    cruise: items.filter((item) => item.kind === "cruise"),
    flight: items.filter((item) => item.kind === "flight"),
    hotel: items.filter((item) => item.kind === "hotel"),
    car: items.filter((item) => item.kind === "car"),
  }), [items]);

  const visibleItems = grouped[kind];
  const kinds = [
    { key: "course", label: "Courses", count: grouped.course.length },
    { key: "cruise", label: "Cruises", count: grouped.cruise.length },
    { key: "flight", label: "Flights", count: grouped.flight.length },
    { key: "hotel", label: "Hotels", count: grouped.hotel.length },
    { key: "car", label: "Cars", count: grouped.car.length },
  ] as const;

  return (
    <div className="compare-shell">
      <section className="page-header">
        <h1>Compare Side by Side</h1>
        <p>
          Build shortlists across courses and travel options, then compare the details that actually drive the decision.
        </p>
      </section>

      <section className="compare-toolbar">
        <div className="compare-tabs">
          {kinds.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={kind === entry.key ? "compare-tab compare-tab--active" : "compare-tab"}
              onClick={() => setKind(entry.key)}
            >
              {entry.label} {entry.count ? `(${entry.count})` : ""}
            </button>
          ))}
        </div>

        <div className="account-actions">
          <button type="button" className="travel-secondary" onClick={() => clearKind(kind)}>
            Clear this view
          </button>
          <button type="button" className="travel-primary" onClick={clearAll}>
            Clear all
          </button>
        </div>
      </section>

      {visibleItems.length === 0 ? (
        <div className="card compare-empty">
          <h2>Nothing selected yet</h2>
          <p>Add up to four items from the catalog or travel flows, then come back here to compare them.</p>
          <p>
            <Link href="/courses">Browse courses</Link>
          </p>
        </div>
      ) : (
        <section className="compare-grid">
          {visibleItems.map((item) => (
            <article key={`${item.kind}-${item.id}`} className="card compare-card">
              <div className="compare-card__eyebrow">
                <span>{item.kind}</span>
                {item.topic ? <span>{item.topic}</span> : null}
              </div>
              <h2>{item.title}</h2>
              {item.providerName ? <p><strong>Provider:</strong> {item.providerName}</p> : null}
              {item.priceText ? <p><strong>Price:</strong> {item.priceText}</p> : null}
              {item.location ? <p><strong>Location:</strong> {item.location}</p> : null}
              {item.dateText ? <p><strong>When:</strong> {item.dateText}</p> : null}
              <p><strong>Rating:</strong> {formatRating(item.ratingAverage, item.ratingCount)}</p>
              {item.details?.length ? (
                <div className="compare-card__details">
                  {item.details.map((detail) => (
                    <span key={detail}>{detail}</span>
                  ))}
                </div>
              ) : null}
              {item.description ? <p className="compare-card__description">{item.description}</p> : null}
              {item.href ? (
                item.href.startsWith("/") ? (
                  <Link href={item.href} className="button">Open</Link>
                ) : (
                  <a href={item.href} className="button" target="_blank" rel="noreferrer">Open</a>
                )
              ) : null}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
