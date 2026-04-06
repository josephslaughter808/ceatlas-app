import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as cheerio from 'cheerio';
import { normalizeCourse } from '../../lib/normalize.js';

const execFileAsync = promisify(execFile);
const SOURCE_URL = 'https://www.ihs.gov/dentalcde/index.cfm/index.cfm?fuseaction=catalog.printcatalog&year=2026';
const PROVIDER = 'Indian Health Service Dental CDE';
const PROVIDER_SLUG = 'indian-health-service-dental-cde';
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

const FIELD_LABELS = [
  'Date(s):',
  'Facility:',
  'Location:',
  'Instructor(s):',
  'Director:',
  'Audience:',
  'Level:',
  'Quota:',
  'Tuition:',
  'Hours:',
  'Summary:',
  'Learning Objectives:',
  'Prerequisites:',
  'Travel:',
  'Payment Address:',
];

function cleanText(value = '', max = 2000) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function extractField(text, label) {
  const labelPattern = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nextLabels = FIELD_LABELS
    .filter((candidate) => candidate !== label)
    .map((candidate) => candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const match = text.match(new RegExp(`${labelPattern}\\s*(.*?)(?=\\s*(?:${nextLabels})\\s*|$)`, 'i'));
  return cleanText(match?.[1] || '', 1800);
}

function toIsoDate(value = '') {
  const match = cleanText(value, 80).match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
  if (!match) return '';
  const [, month, day, year] = match;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDateRange(value = '') {
  const text = cleanText(value, 120);
  const [start = '', end = ''] = text.split(/\s*-\s*/);
  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end || start),
  };
}

function parseLocation(value = '') {
  const text = cleanText(value, 180);
  if (!text || /^online$/i.test(text)) {
    return { location: text || 'Online', city: '', state: '', country: 'USA' };
  }

  const [city = '', state = ''] = text.split(',').map((part) => cleanText(part, 80));
  return {
    location: text,
    city,
    state,
    country: 'USA',
  };
}

function inferFormat(text = '') {
  const value = cleanText(text, 1000).toLowerCase();
  if (/online|recorded webinar|webinar|virtual|self[- ]paced/.test(value)) return 'Online';
  return 'In Person';
}

function inferTopic(text = '') {
  const value = cleanText(text, 1800).toLowerCase();
  if (/implant|sinus lift|bone graft|osseointegration/.test(value)) return 'Implants';
  if (/endo|root canal|pulp/.test(value)) return 'Endodontics';
  if (/pediatric|child|children|stainless steel|sealant/.test(value)) return 'Pediatric Dentistry';
  if (/periodont|hygiene|scaling|gingiv|oral hygiene/.test(value)) return 'Periodontics';
  if (/oral surgery|extraction|surgical|third molar/.test(value)) return 'Oral Surgery';
  if (/radiograph|radiology|x-ray|imaging/.test(value)) return 'Radiology';
  if (/infection control|osha|hazard|nitrous oxide|safety|opioid|pharmacology/.test(value)) return 'Compliance & Safety';
  if (/prostho|crown|bridge|restorative|composite|amalgam|ceramic|denture/.test(value)) return 'Restorative Dentistry';
  if (/management|clinic management|leadership|coding|billing|documentation|practice/.test(value)) return 'Practice Management & Business';
  if (/diabetes|medical|systemic|elder|geriatric|special needs/.test(value)) return 'Oral Medicine & Systemic Health';
  return 'General Dentistry';
}

async function loadCatalogHTML() {
  const { stdout } = await execFileAsync('curl', [
    '-L',
    '--max-time',
    '75',
    '-A',
    BROWSER_USER_AGENT,
    '-H',
    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    SOURCE_URL,
  ], {
    maxBuffer: 30 * 1024 * 1024,
  });

  return stdout;
}

function parseCatalog(html) {
  const $ = cheerio.load(html);
  const rows = [];

  $('strong').each((_, el) => {
    const heading = cleanText($(el).text(), 300);
    const titleMatch = heading.match(/^([A-Z]{2}\d{4}):\s*(.+)$/);
    if (!titleMatch) return;

    const [, courseCode, title] = titleMatch;
    const detailText = cleanText($(el).nextAll('table').first().text(), 8000);
    if (!detailText) return;

    const dateText = extractField(detailText, 'Date(s):');
    const facility = extractField(detailText, 'Facility:');
    const locationField = extractField(detailText, 'Location:');
    const instructors = extractField(detailText, 'Instructor(s):');
    const director = extractField(detailText, 'Director:');
    const audience = extractField(detailText, 'Audience:');
    const level = extractField(detailText, 'Level:');
    const quota = extractField(detailText, 'Quota:');
    const tuition = extractField(detailText, 'Tuition:');
    const hours = extractField(detailText, 'Hours:');
    const summary = extractField(detailText, 'Summary:');
    const objectives = extractField(detailText, 'Learning Objectives:');
    const prerequisites = extractField(detailText, 'Prerequisites:');
    const travel = extractField(detailText, 'Travel:');
    const { startDate, endDate } = parseDateRange(dateText);
    const location = parseLocation(locationField || facility);
    const combinedText = `${title} ${summary} ${objectives} ${dateText} ${facility} ${locationField}`;
    const format = inferFormat(combinedText);

    rows.push(normalizeCourse({
      provider: PROVIDER,
      provider_slug: PROVIDER_SLUG,
      source_url: SOURCE_URL,
      url: `${SOURCE_URL}#${courseCode.toLowerCase()}`,
      title,
      description: [summary, objectives ? `Learning objectives: ${objectives}` : ''].filter(Boolean).join('\n\n'),
      course_type: format === 'Online' ? 'Online CE Course' : 'Live Course',
      format,
      audience: audience || 'Dentists',
      topic: inferTopic(combinedText),
      credits_text: hours,
      price: tuition,
      start_date: startDate,
      end_date: endDate,
      date_text: dateText,
      location: format === 'Online' ? 'Online' : location.location,
      city: format === 'Online' ? '' : location.city,
      state: format === 'Online' ? '' : location.state,
      country: location.country,
      instructors: [instructors, director ? `Director: ${director}` : ''].filter(Boolean).join('\n'),
      accreditation: 'Indian Health Service Division of Oral Health',
      requirements: prerequisites && !/^none$/i.test(prerequisites) ? prerequisites : '',
      tags: ['IHS', courseCode, inferTopic(combinedText), format],
      metadata: {
        course_code: courseCode,
        facility: facility || null,
        director: director || null,
        level: level || null,
        quota: quota || null,
        travel: travel || null,
        extracted_from: 'ihs-fy-2026-print-catalog',
      },
    }));
  });

  return rows;
}

export async function scrapeIHS() {
  console.log('   • Scraping Indian Health Service Dental CDE FY 2026 catalog');
  const html = await loadCatalogHTML();
  const rows = parseCatalog(html);
  console.log(`   • Extracted ${rows.length} IHS Dental CDE rows before current/future filtering`);
  return rows;
}
