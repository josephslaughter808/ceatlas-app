import { scrapeFromList } from './universal-scraper.js';
import { writeCSV } from './write-csv.js';
import { syncProviderCatalog, getCatalogStats } from '../lib/db.js';

async function main() {
  const rows = await scrapeFromList('scrapers/providers.txt');
  const review = writeCSV(rows);

  const result = await syncProviderCatalog(review.rows);
  const stats = await getCatalogStats();

  console.log(`✅ Synced ${result.total} current/future scraped rows`);
  if (review.skipped.length) {
    console.log(`   • skipped past rows before upload: ${review.skipped.length}`);
  }
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
