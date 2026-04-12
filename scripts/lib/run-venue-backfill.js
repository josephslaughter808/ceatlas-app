import path from 'path';
import { spawn } from 'child_process';

const DEFAULT_LIMIT = Number.parseInt(process.env.VENUE_BACKFILL_LIMIT || '10000', 10);

export async function runVenueBackfill(limit = DEFAULT_LIMIT) {
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_LIMIT;
  const scriptPath = path.resolve('scripts/backfill-session-addresses.mjs');

  console.log(`▶️ Running venue backfill (${normalizedLimit} session target)`);

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, String(normalizedLimit)], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Venue backfill exited with code ${code}`));
    });
  });
}
