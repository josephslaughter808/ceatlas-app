const skeletonCards = Array.from({ length: 6 }, (_, index) => index);

export default function CoursesLoading() {
  return (
    <div className="container">
      <section className="page-header">
        <h1>All CE Courses</h1>
        <p>Loading the latest CE catalog...</p>
      </section>

      <div className="catalog-loading-panel" role="status" aria-live="polite">
        <div>
          <span className="loading-kicker">Fetching courses</span>
          <h2>Building your course list</h2>
          <p>CEAtlas is loading current courses, providers, formats, and topic filters.</p>
        </div>
        <div className="loading-orbit" aria-hidden="true" />
      </div>

      <div className="course-list">
        {skeletonCards.map((item) => (
          <article className="course-card course-card--skeleton" key={item}>
            <div className="course-card__content">
              <div className="skeleton-line skeleton-line--pill" />
              <div className="skeleton-line skeleton-line--title" />
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-line--short" />
            </div>
            <div className="course-card__actions">
              <div className="skeleton-line skeleton-line--button" />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
