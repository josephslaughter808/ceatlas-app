"use client";

import { useEffect, useState } from "react";

type HomeStats = {
  courses: number;
  providers: number;
  formatCount: number;
};

const fallbackStats: HomeStats = {
  courses: 0,
  providers: 0,
  formatCount: 0,
};

function formatStat(value: number) {
  return value > 0 ? value.toLocaleString() : "...";
}

export default function HomeStatsClient() {
  const [stats, setStats] = useState<HomeStats>(fallbackStats);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      const response = await fetch("/api/home-stats");
      if (!response.ok) return;
      const nextStats = await response.json();
      if (!cancelled) {
        setStats(nextStats);
      }
    }

    loadStats();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="hero__stats">
      <div className="card hero-stat-card">
        <p className="hero-stat-card__value">{formatStat(stats.courses)}</p>
        <p className="hero-stat-card__label">Courses and events to compare</p>
      </div>
      <div className="card hero-stat-card">
        <p className="hero-stat-card__value">{formatStat(stats.providers)}</p>
        <p className="hero-stat-card__label">Providers, societies, and event hosts</p>
      </div>
      <div className="card hero-stat-card">
        <p className="hero-stat-card__value">{formatStat(stats.formatCount)}</p>
        <p className="hero-stat-card__label">Formats to browse, compare, and plan around</p>
      </div>
    </div>
  );
}
