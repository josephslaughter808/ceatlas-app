type HomeStats = {
  courses: number;
  providers: number;
  formatCount: number;
};

function formatStat(value: number) {
  return value > 0 ? value.toLocaleString() : "...";
}

export default function HomeStatsClient({ stats }: { stats: HomeStats }) {
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
