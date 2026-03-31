import { scrapeFromList } from './universal-scraper.js';
import { writeCSV } from './write-csv.js';

(async () => {
  const rows = await scrapeFromList('scrapers/providers.txt');
  writeCSV(rows);
})();
