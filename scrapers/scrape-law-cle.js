import { writeFile } from 'node:fs/promises';
import { scrapeLawlineCle } from './providers/lawline-cle.js';
console.log('Scraping Lawline’s current CLE course catalog…');
const { courses, report } = await scrapeLawlineCle();
await writeFile(new URL('../data/law-courses.json', import.meta.url), `${JSON.stringify({ generated_at: report.scraped_at, count: courses.length, courses })}\n`);
await writeFile(new URL('../data/law-scrape-report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${courses.length.toLocaleString()} current CLE courses.`);
