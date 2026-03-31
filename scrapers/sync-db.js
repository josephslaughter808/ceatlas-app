import { scrapeFromList } from './universal-scraper.js';
import { writeCSV } from './write-csv.js';
import { syncProviderCatalog, getCatalogStats } from '../lib/db.js';

async function main() {
  const rows = await scrapeFromList('scrapers/providers.txt');
  writeCSV(rows);

  const result = await syncProviderCatalog(rows);
  const stats = await getCatalogStats();

  console.log(`✅ Synced ${result.total} scraped rows`);
  console.log(`   • providers inserted: ${result.insertedProviders}`);
  console.log(`   • courses inserted: ${result.insertedCourses}`);
  console.log(`   • sessions inserted: ${result.insertedSessions}`);
  console.log(`   • providers total: ${stats.providers}`);
  console.log(`   • courses total: ${stats.courses}`);
  console.log(`   • sessions total: ${stats.sessions}`);
}

main()
  .catch((error) => {
    console.error('❌ Failed to sync courses:', error);
    process.exitCode = 1;
  });
