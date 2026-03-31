import { scrapeContinuingEducationCruises } from './providers/cruises-continuingeducation.js';
import { writeCruises } from './write-cruises.js';

async function main() {
  const cruises = await scrapeContinuingEducationCruises();
  writeCruises(cruises);
}

main().catch((error) => {
  console.error('❌ Failed to scrape cruises:', error);
  process.exitCode = 1;
});
