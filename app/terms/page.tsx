import Link from "next/link";

export const metadata = {
  title: "Terms of Use | CEAtlas",
  description: "CEAtlas terms of use covering course discovery, travel planning, and checkout-related tools.",
};

export default function TermsPage() {
  return (
    <main className="container legal-page">
      <section className="legal-hero card">
        <p className="hero__eyebrow">Terms of Use</p>
        <h1>Terms of Use</h1>
        <p>Last updated April 12, 2026. These terms explain how CEAtlas discovery, planning, and checkout tools are intended to be used.</p>
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
            Travel pricing, taxes, fees, availability, refund rules, and supplier policies can change. CEAtlas may
            display supplier-powered search and checkout tools, but final inventory and booking terms are governed by
            the travel provider and payment processor involved in the order.
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
            <Link href="/contact">contact page</Link> or to <a href="mailto:support@ceatlas.co">support@ceatlas.co</a>.
          </p>
        </article>
      </section>
    </main>
  );
}
