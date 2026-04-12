import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | CEAtlas",
  description: "CEAtlas privacy policy covering accounts, saved planning data, and checkout-related information.",
};

export default function PrivacyPage() {
  return (
    <main className="container legal-page">
      <section className="legal-hero card">
        <p className="hero__eyebrow">Privacy Policy</p>
        <h1>Privacy Policy</h1>
        <p>Last updated April 12, 2026. This policy explains what CEAtlas collects and how we use it to support course discovery, travel planning, and account features.</p>
      </section>

      <section className="legal-stack">
        <article className="card legal-card">
          <h2>Information we collect</h2>
          <p>
            CEAtlas may collect account information such as your email address, saved courses, selected practice
            state, saved planning preferences, home airport, provider connections you choose to add, payment-method
            references supplied by Stripe, and basic usage events that help us improve the product.
          </p>
        </article>
        <article className="card legal-card">
          <h2>How we use information</h2>
          <p>
            We use your information to provide the course catalog, saved-course tools, comparison tools, state
            planning context, itinerary planning, account support, data-quality improvements, and beta launch
            communications.
          </p>
        </article>
        <article className="card legal-card">
          <h2>Provider account connections</h2>
          <p>
            If you connect a provider account, CEAtlas uses those credentials only to support account-scoped
            provider access and related planning features. Do not connect provider accounts you are not authorized
            to use.
          </p>
        </article>
        <article className="card legal-card">
          <h2>Payments and travel</h2>
          <p>
            CEAtlas may route payment setup and checkout through third-party payment providers such as Stripe. Card
            details are intended to stay with the payment processor rather than being stored directly by CEAtlas.
          </p>
        </article>
        <article className="card legal-card">
          <h2>Contact</h2>
          <p>
            Questions, deletion requests, or privacy concerns can be sent through the <Link href="/contact">contact page</Link>
            or directly to <a href="mailto:support@ceatlas.co">support@ceatlas.co</a>.
          </p>
        </article>
      </section>
    </main>
  );
}
