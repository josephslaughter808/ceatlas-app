import { scrapeContinuingEducationCruises } from './providers/cruises-continuingeducation.js';
import { scrapeVetBolusCruises } from './providers/cruises-vetbolus.js';
import { writeCruises } from './write-cruises.js';

async function main() {
  const cruises = [...await scrapeContinuingEducationCruises(), ...await scrapeVetBolusCruises()];
  writeCruises(cruises);
}

main().catch((error) => {
  console.error('❌ Failed to scrape cruises:', error);
  process.exitCode = 1;
});
