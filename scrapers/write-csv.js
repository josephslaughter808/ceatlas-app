import fs from 'fs';
import path from 'path';
import { filterCurrentOrFutureCourses } from '../lib/course-eligibility.js';

const COLUMNS = [
  'provider',
  'provider_slug',
  'source_url',
  'url',
  'title',
  'description',
  'course_type',
  'format',
  'audience',
  'topic',
  'credits_text',
  'credits',
  'price',
  'price_amount',
  'currency',
  'start_date',
  'end_date',
  'date_text',
  'location',
  'city',
  'state',
  'country',
  'instructors',
  'accreditation',
  'registration_deadline',
  'requirements',
  'tags',
  'metadata',
];

function serializeValue(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function rowKey(row) {
  return [
    row.provider_slug || row.provider,
    row.title,
    row.url,
    row.course_type,
    row.format,
  ].join('|');
}

export function writeCSV(rows, options = {}) {
  const baseName = options.baseName || 'pending_courses';
  const skippedName = options.skippedName || 'skipped_past_courses';
  const csvPath = path.join(process.cwd(), 'data', `${baseName}.csv`);
  const jsonPath = path.join(process.cwd(), 'data', `${baseName}.json`);
  const skippedPath = path.join(process.cwd(), 'data', `${skippedName}.json`);

  const filtered = filterCurrentOrFutureCourses(rows);
  const seen = new Set();
  const deduped = filtered.rows.filter((row) => {
    const key = rowKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const header = COLUMNS.join(',');

  const lines = deduped.map((row) => COLUMNS
    .map((column) => `"${serializeValue(row[column]).replace(/"/g, '""')}"`)
    .join(','));

  fs.writeFileSync(csvPath, [header, ...lines].join('\n'), 'utf8');
  fs.writeFileSync(jsonPath, JSON.stringify(deduped, null, 2), 'utf8');
  fs.writeFileSync(skippedPath, JSON.stringify(filtered.skipped, null, 2), 'utf8');

  console.log(`✅ Wrote ${deduped.length} rows to ${csvPath}`);
  console.log(`✅ Wrote ${deduped.length} rows to ${jsonPath}`);
  if (filtered.skipped.length) {
    console.log(`🧹 Skipped ${filtered.skipped.length} past dated rows before CSV/upload review (${filtered.today}); details in ${skippedPath}`);
  }

  return {
    rows: deduped,
    skipped: filtered.skipped,
    today: filtered.today,
  };
}
