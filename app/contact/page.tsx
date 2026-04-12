import Link from "next/link";

export const metadata = {
  title: "Contact CEAtlas",
  description: "Contact CEAtlas for support, provider updates, partnerships, and launch questions.",
};

export default function ContactPage() {
  return (
    <main className="container legal-page">
      <section className="legal-hero card">
        <p className="hero__eyebrow">Contact</p>
        <h1>Contact CEAtlas.</h1>
        <p>
          Reach out for support, provider corrections, missing course catalogs, partnership questions, and launch-related help.
          We route dentist support and provider requests separately so nothing gets lost.
        </p>
        <div className="legal-actions">
          <a className="button" href="mailto:support@ceatlas.co?subject=CEAtlas%20support">
            Email support
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
            a short note. Provider-confirmed corrections and listing changes get prioritized.
          </p>
          <a href="mailto:providers@ceatlas.co?subject=CEAtlas%20provider%20update">providers@ceatlas.co</a>
        </article>
        <article className="card legal-card">
          <h2>Partnerships</h2>
          <p>
            CEAtlas is preparing beta sponsorship, featured placement, and provider-profile options for CE
            organizations that want to reach dentists planning their education calendar.
          </p>
          <Link href="/list-your-ce">See provider options</Link>
        </article>
        <article className="card legal-card">
          <h2>Support</h2>
          <p>
            CEAtlas helps with discovery, trip planning, account support, and checkout questions. Course registration,
            CE credit issuance, refunds, attendance records, and provider-specific policies still remain with the original provider.
          </p>
          <a href="mailto:support@ceatlas.co?subject=CEAtlas%20support">support@ceatlas.co</a>
        </article>
      </section>
    </main>
  );
}
