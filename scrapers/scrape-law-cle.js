import { writeFile } from 'node:fs/promises';
import { scrapeLawlineCle } from './providers/lawline-cle.js';
console.log('Scraping current jurisdiction-aware CLE catalogs…');
const { courses, report } = await scrapeLawlineCle({ onProgress: ({ source, sourceCount, accepted }) => console.log(`  ${source}: ${sourceCount.toLocaleString()} listings; ${accepted.toLocaleString()} total`) });
await writeFile(new URL('../data/law-courses.json', import.meta.url), `${JSON.stringify({ generated_at: report.scraped_at, count: courses.length, courses })}\n`);
await writeFile(new URL('../data/law-scrape-report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${courses.length.toLocaleString()} current CLE courses.`);
