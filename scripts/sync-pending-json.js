import fs from 'fs';
import path from 'path';
import { syncProviderCatalog, getCatalogStats } from '../lib/db.js';
import { runVenueBackfill } from './lib/run-venue-backfill.js';

const dataDir = path.resolve('data');

function getPendingFiles() {
  return fs.readdirSync(dataDir)
    .filter((file) => /^pending_.*_courses\.json$/.test(file))
    .sort();
}

async function main() {
  const targets = process.argv.slice(2);
  const allFiles = getPendingFiles();
  const files = targets.length
    ? allFiles.filter((file) => targets.includes(file.replace(/^pending_/, '').replace(/_courses\.json$/, '')))
    : allFiles;

  if (!files.length) {
    throw new Error('No pending JSON files matched.');
  }

  const before = await getCatalogStats();
  const summary = [];

  for (const file of files) {
    const fullPath = path.join(dataDir, file);
    const rows = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    if (!Array.isArray(rows) || rows.length === 0) {
      summary.push({ file, rows: 0, skipped: true });
      continue;
    }

    console.log(`▶️ Syncing ${file} (${rows.length} rows)`);
    const result = await syncProviderCatalog(rows);
    summary.push({
      file,
      rows: rows.length,
      result,
    });
  }

  await runVenueBackfill();

  const after = await getCatalogStats();

  console.log(JSON.stringify({
    importedFiles: files.length,
    before,
    after,
    delta: {
      providers: after.providers - before.providers,
      courses: after.courses - before.courses,
      sessions: after.sessions - before.sessions,
    },
    summary,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
