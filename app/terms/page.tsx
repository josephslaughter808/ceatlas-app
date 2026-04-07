import Link from "next/link";

export const metadata = {
  title: "Terms of Use | CEAtlas",
  description: "CEAtlas beta terms of use and CE catalog disclaimer.",
};

export default function TermsPage() {
  return (
    <main className="container legal-page">
      <section className="legal-hero card">
        <p className="hero__eyebrow">Terms of Use</p>
        <h1>Terms of Use</h1>
        <p>Last updated April 7, 2026. These beta terms are written for early use and should be reviewed before paid launch.</p>
      </section>

      <section className="legal-stack">
        <article className="card legal-card">
          <h2>CEAtlas is a discovery tool</h2>
          <p>
            CEAtlas helps users find, compare, save, and plan around continuing education listings. CEAtlas does not
            guarantee that a course satisfies a specific license, specialty, state-board, employer, or renewal requirement.
          </p>
        </article>
        <article className="card legal-card">
          <h2>Verify with the provider</h2>
          <p>
            Course details can change. Before registering, users should confirm credits, accreditation, dates,
            location, pricing, cancellation rules, accessibility, and eligibility directly with the original provider.
          </p>
        </article>
        <article className="card legal-card">
          <h2>Travel planning</h2>
          <p>
            Travel tools are for planning and search during beta. Travel inventory, fares, hotel rates, taxes, fees,
            policies, and availability must be confirmed on the travel provider site before booking.
          </p>
        </article>
        <article className="card legal-card">
          <h2>Provider and member accounts</h2>
          <p>
            If CEAtlas supports provider-account connections, users are responsible for connecting only accounts they
            are authorized to use and for complying with the provider&apos;s own terms.
          </p>
        </article>
        <article className="card legal-card">
          <h2>Contact</h2>
          <p>
            Data corrections, takedown requests, and support requests can be sent through the{" "}
            <Link href="/contact">contact page</Link>.
          </p>
        </article>
      </section>
    </main>
  );
}
