import Link from "next/link";

export const metadata = {
  title: "List Your Dental CE | CEAtlas",
  description: "Partner with CEAtlas to list dental CE courses, conferences, cruises, and provider catalogs.",
};

const placementOptions = [
  {
    title: "Catalog listing cleanup",
    copy: "Send us your official CE catalog URL and we will prioritize provider-name cleanup, duplicate review, and accurate course linking.",
  },
  {
    title: "Featured provider beta slot",
    copy: "Get early access to featured provider placements for high-intent dentists searching by topic, state, format, and destination.",
  },
  {
    title: "Conference and travel visibility",
    copy: "Promote live courses, hands-on programs, cruises, and destination CE to dentists who are already comparing travel-friendly options.",
  },
];

export default function ListYourCEPage() {
  return (
    <main className="container legal-page">
      <section className="legal-hero provider-hero card">
        <p className="hero__eyebrow">For CE Providers</p>
        <h1>Put your dental CE in front of dentists who are ready to plan.</h1>
        <p>
          CEAtlas is building the searchable map of dental continuing education: online catalogs,
          in-person conferences, hands-on workshops, cruises, and destination CE. Provider partnerships
          will open during beta.
        </p>
        <div className="legal-actions">
          <a
            className="button"
            href="mailto:josephslaughter13@gmail.com?subject=List%20my%20CE%20on%20CEAtlas"
          >
            Request provider review
          </a>
          <Link className="auth-button auth-button--ghost" href="/courses">
            View catalog
          </Link>
        </div>
      </section>

      <section className="provider-pitch-grid">
        {placementOptions.map((item) => (
          <article className="card legal-card" key={item.title}>
            <h2>{item.title}</h2>
            <p>{item.copy}</p>
          </article>
        ))}
      </section>

      <section className="card provider-checklist">
        <div>
          <p className="hero__eyebrow">What to send</p>
          <h2>Help us verify your provider profile faster.</h2>
        </div>
        <ul>
          <li>Official course catalog, event, or registration URL</li>
          <li>Provider display name and preferred contact email</li>
          <li>Whether the catalog is public, member-only, or registration-gated</li>
          <li>Any priority courses, conferences, cruises, or destination CE programs</li>
        </ul>
      </section>
    </main>
  );
}
