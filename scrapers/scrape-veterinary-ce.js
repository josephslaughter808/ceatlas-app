import { writeFile } from 'node:fs/promises';
import { scrapeVeterinaryCe } from './providers/cebroker-veterinary.js';

console.log('Scraping current AAVSB RACE-approved veterinary CE from CE Broker…');
const { courses, report } = await scrapeVeterinaryCe({
  onProgress: ({ audience, page, total, accepted }) => {
    if (page === 1 || page % 5 === 0 || page * 500 >= total) console.log(`  ${audience}: page ${page}, ${accepted.toLocaleString()} unique current activities`);
  },
});
await writeFile(new URL('../data/veterinary-courses.json', import.meta.url), `${JSON.stringify({ generated_at: report.scraped_at, count: courses.length, courses })}\n`);
await writeFile(new URL('../data/veterinary-scrape-report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${courses.length.toLocaleString()} unique current RACE-approved veterinary activities.`);
if (courses.length < 10000) console.warn(`Verified source inventory is below the 10,000-course goal (${courses.length.toLocaleString()} current unique activities).`);
