import CruiseCatalogClient from "../components/cruise-catalog-client";
import { getCruises } from "@/lib/cruises";

const cruiseProviders = [
  {
    name: "Professional Education Society",
    url: "https://pestravel.com/",
    focus: "Medical and dental CE cruises",
    note: "High-potential cruise CE operator with public program pages worth expanding into the scraper next.",
  },
  {
    name: "Dental CE at Sea",
    url: "https://www.dentalceatsea.com/",
    focus: "Dental-focused cruise CE",
    note: "Strong brand fit for CEAtlas, but the public catalog structure needs a second pass before we automate it reliably.",
  },
  {
    name: "Seminars at Sea",
    url: "https://www.seminarsatsea.com/",
    focus: "Continuing education cruises",
    note: "Good marketplace-style source to investigate after the more structured cruise catalogs are in.",
  },
];

export default async function CruisesPage() {
  const cruises = await getCruises();

  return (
    <div className="container" style={{ paddingTop: "2rem" }}>
      <section className="page-header">
        <h1>Dental CE Cruises</h1>
        <p>
          Cruise CE is one of the strongest premium offers on the site, so this page now starts with live scraped
          cruise programs and then shows the next providers we can add to deepen the catalog.
        </p>
      </section>

      <section className="saved-overview">
        <div className="card saved-overview__card">
          <h2>Why Cruises Sell</h2>
          <p>They package CE, lodging, dining, and destination into one easy decision for doctors and their guests.</p>
        </div>
        <div className="card saved-overview__card">
          <h2>Live Catalog</h2>
          <p>{cruises.length} scraped cruise CE programs are now surfaced below as a real browseable catalog.</p>
        </div>
        <div className="card saved-overview__card">
          <h2>Next Layer</h2>
          <p>We can add cabins, airfare, and pre/post trip extensions once the cruise catalog gets broader.</p>
        </div>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <h2>Live Cruise Catalog</h2>
        </div>

        {cruises.length === 0 ? (
          <div className="card saved-overview__card">
            <h3>Cruise catalog not generated yet</h3>
            <p>Run `npm run scrape:cruises` and this page will populate with scraped cruise programs.</p>
          </div>
        ) : <CruiseCatalogClient cruises={cruises} />}
      </section>

      <section className="home-section">
        <div className="section-heading">
          <h2>Next Cruise Providers</h2>
        </div>

        <div className="home-grid">
          {cruiseProviders.map((provider) => (
            <article key={provider.name} className="card saved-overview__card">
              <h3>{provider.name}</h3>
              <p><strong>Focus:</strong> {provider.focus}</p>
              <p>{provider.note}</p>
              <p>
                <a href={provider.url} target="_blank" rel="noreferrer">
                  Visit website
                </a>
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
