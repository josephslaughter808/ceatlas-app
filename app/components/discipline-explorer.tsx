"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { Discipline } from "@/lib/disciplines";
import { getDisciplineLogo, getDisciplineLogoAlt } from "@/lib/discipline-logo";

type Filter = "All" | Discipline["group"];

export default function DisciplineExplorer({ disciplines }: { disciplines: Discipline[] }) {
  const [filter, setFilter] = useState<Filter>("All");
  const visible = useMemo(
    () => filter === "All" ? disciplines : disciplines.filter((discipline) => discipline.group === filter),
    [disciplines, filter]
  );

  return (
    <div className="discipline-explorer">
      <div className="discipline-filters" aria-label="Filter disciplines">
        {(["All", "Healthcare", "Professional"] as Filter[]).map((option) => (
          <button
            type="button"
            key={option}
            className={filter === option ? "discipline-filter discipline-filter--active" : "discipline-filter"}
            onClick={() => setFilter(option)}
            aria-pressed={filter === option}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="discipline-grid">
        {visible.map((discipline) => {
          const hasCatalog = discipline.live || discipline.slug === "medicine" || discipline.slug === "veterinary" || discipline.slug === "law" || discipline.slug === "nursing";
          const href = discipline.live ? `/courses?discipline=${discipline.slug}` : `/disciplines/${discipline.slug}`;
          return (
            <Link
              href={href}
              className={hasCatalog ? "discipline-card discipline-card--live" : "discipline-card"}
              style={{ "--discipline-accent": discipline.accent } as React.CSSProperties}
              key={discipline.slug}
            >
              <div className="discipline-card__topline">
                <span className="discipline-card__mark">
                  <Image src={getDisciplineLogo(discipline.slug)} alt={getDisciplineLogoAlt(discipline)} width={44} height={44} />
                </span>
                <span className={hasCatalog ? "discipline-status discipline-status--live" : "discipline-status"}>
                  {hasCatalog ? "Explore now" : "Preview"}
                </span>
              </div>
              <div>
                <p className="discipline-card__credential">{discipline.credential}</p>
                <h3>{discipline.name}</h3>
                <p>{discipline.description}</p>
              </div>
              <span className="discipline-card__link">
                {hasCatalog ? "Browse the catalog" : "Explore this discipline"}
                <span aria-hidden="true">→</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
