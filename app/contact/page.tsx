import Link from "next/link";

export const metadata = {
  title: "Contact CEAtlas",
  description: "Contact CEAtlas about course data, provider updates, partnerships, and launch feedback.",
};

export default function ContactPage() {
  return (
    <main className="container legal-page">
      <section className="legal-hero card">
        <p className="hero__eyebrow">Contact</p>
        <h1>Help us make CEAtlas more useful before launch.</h1>
        <p>
          Send provider corrections, missing course catalogs, partnership ideas, and beta feedback here.
          We are prioritizing data quality, discoverability, and launch readiness first.
        </p>
        <div className="legal-actions">
          <a className="button" href="mailto:josephslaughter13@gmail.com?subject=CEAtlas%20feedback">
            Email CEAtlas
          </a>
          <Link className="auth-button auth-button--ghost" href="/courses">
            Back to catalog
          </Link>
        </div>
      </section>

      <section className="legal-grid">
        <article className="card legal-card">
          <h2>Provider updates</h2>
          <p>
            If a course is missing, stale, duplicated, or listed under the wrong provider, send the course URL and
            a short note. Provider-confirmed corrections get prioritized.
          </p>
        </article>
        <article className="card legal-card">
          <h2>Partnerships</h2>
          <p>
            CEAtlas is preparing beta sponsorship, featured placement, and provider-profile options for CE
            organizations that want to reach dentists planning their education calendar.
          </p>
        </article>
        <article className="card legal-card">
          <h2>Support</h2>
          <p>
            For now, CEAtlas is discovery and planning software. Registration, CE credit issuance, refunds, and
            attendance records remain with the original course provider.
          </p>
        </article>
      </section>
    </main>
  );
}
