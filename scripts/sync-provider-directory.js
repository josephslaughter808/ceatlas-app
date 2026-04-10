import { getCatalogStats, syncProviderDirectory } from '../lib/db.js';
import { scrapeWorldDentalOrganisations } from '../scrapers/providers/world-dental-organisations.js';

const DIRECTORIES = {
  'world-dental-organisations': {
    label: 'World Dental Events organisation directory',
    scrape: () => scrapeWorldDentalOrganisations(),
  },
};

async function main() {
  const providerKey = process.argv[2];
  const directory = DIRECTORIES[providerKey];

  if (!directory) {
    throw new Error(`Usage: node scripts/sync-provider-directory.js ${Object.keys(DIRECTORIES).join(' ')}`);
  }

  console.log(`🔎 Scraping ${directory.label}`);
  const providers = await directory.scrape();
  console.log(`✅ Scraped ${providers.length} providers`);

  const result = await syncProviderDirectory(providers);
  const stats = await getCatalogStats();

  console.log(JSON.stringify({
    providerKey,
    result,
    stats: {
      providers: stats.providers,
      courses: stats.courses,
      sessions: stats.sessions,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
