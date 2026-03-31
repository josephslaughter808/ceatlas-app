import fs from 'fs';
import path from 'path';

export function writeCruises(rows) {
  const jsonPath = path.join(process.cwd(), 'data', 'cruises.json');
  fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2), 'utf8');
  console.log(`✅ Wrote ${rows.length} rows to ${jsonPath}`);
}
