import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as cheerio from 'cheerio';
import { normalizeCourse } from '../../lib/normalize.js';

const execFileAsync = promisify(execFile);
const SOURCE_URL = 'https://events.gidedental.com/master-clinician-2026/europe/';
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

const MONTHS = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

const FALLBACK_SESSIONS = [
  {
    session: 'Session I',
    duration: '5 Days',
    label: 'Nov 24-28, 2026',
    city: 'Florence',
    country: 'Italy',
  },
  {
    session: 'Session II',
    duration: '4 Days',
    label: 'March 11-14, 2026',
    city: 'Vienna',
    country: 'Austria',
  },
  {
    session: 'Session III',
    duration: '4 Days',
    label: 'Jun 3-6, 2026',
    city: 'Amsterdam',
    country: 'Netherlands',
  },
  {
    session: 'Session IV',
    duration: '5 Days',
    label: 'Sept 14-18, 2026',
    city: 'Los Angeles',
    state: 'CA',
    country: 'USA',
  },
];

function cleanText(value = '', max = 2000) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#8211;|&ndash;/gi, '–')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function toIsoDate(monthName, day, year) {
  const month = MONTHS[String(monthName || '').toLowerCase().replace(/\.$/, '')];
  if (!month) return '';
  return `${year}-${month}-${String(day).padStart(2, '0')}`;
}

function parseDateRange(label = '') {
  const compact = cleanText(label, 80).replace(/\s*[–-]\s*/g, '-');
  const match = compact.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:-(\d{1,2}))?,\s*(20\d{2})$/);
  if (!match) return { startDate: '', endDate: '' };

  const [, month, startDay, endDay, year] = match;
  return {
    startDate: toIsoDate(month, startDay, year),
    endDate: toIsoDate(month, endDay || startDay, year),
  };
}

function extractSessionsFromText(text) {
  const sessionPattern = /Session\s+([IVX]+)\s+–\s+\(([^)]+)\)\s+((?:Master Clinician Symposium\s+)?[A-Za-z]{3,9}\.?\s+\d{1,2}\s*[–-]\s*\d{1,2},\s*20\d{2})\s+–\s+(.+?)(?=\s+Session\s+[IVX]+\s+–|$)/gi;
  const rows = [];
  let match;

  while ((match = sessionPattern.exec(text))) {
    const [, roman, duration, label, rawLocation] = match;
    const location = cleanText(rawLocation, 120);
    const [city = '', region = ''] = location.split(',').map((part) => cleanText(part, 80));

    rows.push({
      session: `Session ${roman}`,
      duration: cleanText(duration, 40),
      label: cleanText(label.replace(/^Master Clinician Symposium\s+/i, ''), 80),
      city,
      state: region && region.length <= 3 ? region : '',
      country: region && region.length > 3 ? region : 'USA',
    });
  }

  return rows;
}

async function loadGideHTML() {
  const { stdout } = await execFileAsync('curl', [
    '-L',
    '--max-time',
    '45',
    '-A',
    BROWSER_USER_AGENT,
    '-H',
    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    SOURCE_URL,
  ], {
    maxBuffer: 24 * 1024 * 1024,
  });

  return stdout;
}

export async function scrapeGIDE() {
  console.log('   • Scraping gIDE Europe 2025-26 program sessions');

  let sessions = [];
  try {
    const html = await loadGideHTML();
    const $ = cheerio.load(html);
    const pageText = cleanText($.root().text(), 50000);
    sessions = extractSessionsFromText(pageText);
  } catch (error) {
    console.warn(`   ⚠️ gIDE live page fetch failed; using official current program fallback: ${error.message}`);
  }

  if (!sessions.length) {
    sessions = FALLBACK_SESSIONS;
  }

  const rows = sessions.map((session) => {
    const { startDate, endDate } = parseDateRange(session.label);
    const location = [session.city, session.state || session.country].filter(Boolean).join(', ');

    return normalizeCourse({
      provider: 'gIDE Europe',
      provider_slug: 'gide-europe',
      source_url: SOURCE_URL,
      url: SOURCE_URL,
      title: `gIDE Europe Master Clinician Program in Implant Dentistry - ${session.session}`,
      description: 'Current 2025-26 gIDE Europe Master Clinician Program session in implant dentistry, with in-person training, live surgery demonstrations, hands-on workshops, case reviews, and diploma curriculum.',
      course_type: 'Master Clinician Program',
      format: 'In Person',
      audience: 'Dentists',
      topic: 'Implants',
      credits_text: '300+ Hours CE across full program',
      price: 'Program deposit listed by provider',
      start_date: startDate,
      end_date: endDate,
      date_text: `${session.label} • ${session.duration}`,
      location,
      city: session.city,
      state: session.state || '',
      country: session.country || 'International',
      accreditation: 'gIDE Dental Institute',
      tags: ['gIDE', 'Europe', 'Implants', 'Master Clinician Program'],
      metadata: {
        program_year: '2025-26',
        session: session.session,
        past_date_filter_required: true,
      },
    });
  });

  console.log(`   • Extracted ${rows.length} gIDE session rows before current/future filtering`);
  return rows;
}
