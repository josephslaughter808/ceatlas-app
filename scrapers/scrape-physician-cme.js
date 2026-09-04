import { writeFile } from 'node:fs/promises';
import { scrapeAccmePhysicianCme } from './providers/accme-cme-passport.js';

const target = Math.max(1, Number(process.argv.find((arg) => arg.startsWith('--target='))?.split('=')[1]) || 10000);
const outputUrl = new URL('../data/physician-courses.json', import.meta.url);
const reportUrl = new URL('../data/physician-scrape-report.json', import.meta.url);

console.log(`Scraping at least ${target.toLocaleString()} active, accredited physician CME activities from ACCME CME Passport…`);
const { courses, report } = await scrapeAccmePhysicianCme({
  target,
  onProgress: ({ page, scanned, accepted }) => {
    if (page === 1 || page % 10 === 0 || accepted >= target) {
      console.log(`  page ${page}: ${scanned.toLocaleString()} scanned, ${accepted.toLocaleString()} accepted`);
    }
  },
});

if (courses.length < target) {
  throw new Error(`Only ${courses.length.toLocaleString()} qualifying physician CME activities were found; target was ${target.toLocaleString()}.`);
}

await writeFile(outputUrl, `${JSON.stringify({ generated_at: report.scraped_at, count: courses.length, courses })}\n`);
await writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${courses.length.toLocaleString()} physician CME activities to ${outputUrl.pathname}`);
console.log(`Validation report: ${reportUrl.pathname}`);
