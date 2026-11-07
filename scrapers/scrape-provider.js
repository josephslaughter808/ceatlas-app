import fs from 'fs';
import path from 'path';
import { syncProviderCatalog } from '../lib/db.js';
import { filterCurrentOrFutureCourses } from '../lib/course-eligibility.js';
import {
  assessProviderRun,
  getPriorityProviderByKey,
  PRIORITY_PROVIDERS,
} from './provider-registry.js';

const key = process.argv[2];
const shouldSync = process.argv.includes('--sync');
const provider = getPriorityProviderByKey(key);

if (!provider) {
  console.error(`Unknown provider "${key || ''}". Available providers: ${PRIORITY_PROVIDERS.map((item) => item.key).join(', ')}`);
  process.exitCode = 1;
} else {
  const startedAt = Date.now();

  try {
    const scrapedRows = await provider.scrape(provider.urls[0]);
    const filtered = filterCurrentOrFutureCourses(scrapedRows);
    const health = assessProviderRun(provider, filtered.rows, Date.now() - startedAt);
    const outputDirectory = path.join(process.cwd(), 'data', 'provider-runs');
    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(outputDirectory, `${provider.key}.json`),
      JSON.stringify({ health, rows: filtered.rows, skipped: filtered.skipped }, null, 2),
      'utf8',
    );

    console.log(JSON.stringify(health, null, 2));

    if (!health.healthy) {
      console.error('Provider output was quarantined and was not synced. Existing catalogue records were preserved.');
      process.exitCode = 2;
    } else if (shouldSync) {
      const result = await syncProviderCatalog(filtered.rows);
      console.log(JSON.stringify({ sync: result }, null, 2));
    } else {
      console.log('Dry run complete. Add --sync to publish these verified rows.');
    }
  } catch (error) {
    console.error(`Provider ${provider.key} failed: ${error.message}`);
    console.error('Existing catalogue records were preserved.');
    process.exitCode = 1;
  }
}
