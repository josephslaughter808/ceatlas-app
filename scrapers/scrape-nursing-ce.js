import { writeFile } from 'node:fs/promises';
import { scrapeNursingCe } from './providers/cebroker-nursing.js';

console.log('Scraping current Florida Board-approved nursing CE from CE Broker…');
const { courses, report } = await scrapeNursingCe({
  onProgress: ({ audience, providers, providerTotal, total, accepted }) => {
    if (providers === providerTotal || providers % 120 === 0) console.log(`  ${audience}: ${providers}/${providerTotal} providers, ${accepted.toLocaleString()} of ${total.toLocaleString()} catalog results captured`);
  },
});
await writeFile(new URL('../data/nursing-courses.json', import.meta.url), `${JSON.stringify({ generated_at: report.scraped_at, count: courses.length, courses })}\n`);
await writeFile(new URL('../data/nursing-scrape-report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${courses.length.toLocaleString()} unique current board-approved nursing activities.`);
