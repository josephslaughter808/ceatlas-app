import * as cheerio from 'cheerio';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeCourse } from '../../lib/normalize.js';

const execFileAsync = promisify(execFile);

const BASE_URL = 'https://www.worlddentalevents.com';
const SOURCE_URL = `${BASE_URL}/events`;
const MAX_ROWS = 5000;
const MAX_PAGES_PER_TYPE = 80;
const EVENT_TYPES = [
  '',
  'Conference',
  'Congress',
  'Convention',
  'Meeting',
  'Symposium',
  'Workshop',
  'Course',
  'Masterclass',
  'Seminar',
  'Training',
  'Annual Meeting',
  'Trade Show',
  'Exhibition',
  'Forum',
  'Lecture',
  'Study Club',
];

const MONTHS = {
  Jan: '01',
  Feb: '02',
  Mar: '03',
  Apr: '04',
  May: '05',
  Jun: '06',
  Jul: '07',
  Aug: '08',
  Sep: '09',
  Oct: '10',
  Nov: '11',
  Dec: '12',
};

const REMOTE_PATTERN = /\b(webinar|online|virtual|livestream|remote|on[-\s]?demand)\b/i;
const WEAK_TITLE_PATTERN = /^(read more|learn more|click here)$/i;

function cleanText(value = '', max = 1200) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function providerSlug(provider = '') {
  return cleanText(provider)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'world-dental-events';
}

function absoluteUrl(value = '') {
  try {
    return new URL(value, BASE_URL).href;
  } catch {
    return SOURCE_URL;
  }
}

function parseDate(day = '', month = '', year = '') {
  const monthNumber = MONTHS[month];
  if (!day || !monthNumber || !year) return '';
  return `${year}-${monthNumber}-${String(day).padStart(2, '0')}`;
}

function inferTopic(title = '', eventType = '') {
  const value = `${title} ${eventType}`.toLowerCase();
  if (/implant|osseointegration/.test(value)) return 'Implants';
  if (/endo|root canal/.test(value)) return 'Endodontics';
  if (/ortho|aligner/.test(value)) return 'Orthodontics';
  if (/periodont|hygien/.test(value)) return 'Periodontics & Hygiene';
  if (/pediatric|children/.test(value)) return 'Pediatric Dentistry';
  if (/maxillofacial|oral surgery|oms/.test(value)) return 'Oral Surgery';
  if (/esthetic|aesthetic|cosmetic|smile/.test(value)) return 'Esthetics & Facial Esthetics';
  if (/digital|3d|ai|cbct|cad.?cam/.test(value)) return 'Digital Dentistry & Technology';
  if (/sleep|airway|orofacial/.test(value)) return 'Sleep & Airway';
  return eventType || 'Dental Event';
}

function keepEvent({ title, eventType, location, organisation }) {
  const combined = `${title} ${eventType} ${location} ${organisation}`;
  if (!title || WEAK_TITLE_PATTERN.test(title)) return false;
  if (REMOTE_PATTERN.test(combined)) return false;
  if (/^online$/i.test(location)) return false;
  return true;
}

async function fetchPage(url, attempt = 1) {
  try {
    const { stdout } = await execFileAsync('curl', [
      '-L',
      '--max-time',
      '30',
      '-A',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      url,
    ], {
      maxBuffer: 10 * 1024 * 1024,
    });

    return stdout;
  } catch (error) {
    if (attempt >= 3) throw error;
    await new Promise((resolve) => {
      setTimeout(resolve, attempt * 1000);
    });
    return fetchPage(url, attempt + 1);
  }
}

function parsePage(html = '') {
  const $ = cheerio.load(html);
  const rows = [];
  const maxPageText = $('.page-jump-input').attr('max') || $('.page-info strong').first().text();
  const maxPage = Number.parseInt(maxPageText, 10);

  $('a.event-card').each((_, card) => {
    const item = $(card);
    const title = cleanText(item.find('.ec-title').first().text(), 300);
    const eventType = cleanText(item.find('.ec-tag').first().text(), 80);
    const organisation = cleanText(item.find('.ec-org').first().text(), 200);
    const location = cleanText(item.find('.ec-meta span').first().text(), 200);
    const duration = cleanText(item.find('.ec-meta span').eq(2).text(), 80);
    const day = cleanText(item.find('.ec-day').first().text(), 2);
    const month = cleanText(item.find('.ec-month').first().text(), 3);
    const year = cleanText(item.find('.ec-year').first().text(), 4);
    const startDate = parseDate(day, month, year);
    const url = absoluteUrl(item.attr('href'));

    if (!startDate || !keepEvent({ title, eventType, location, organisation })) return;

    const provider = organisation || 'World Dental Events';

    rows.push(normalizeCourse({
      provider,
      provider_slug: providerSlug(provider),
      source_url: SOURCE_URL,
      url,
      title,
      description: `${title} is a public, in-person ${eventType || 'dental event'} listed by World Dental Events.`,
      course_type: eventType || 'Dental Event',
      format: 'In Person',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(title, eventType),
      credits_text: '',
      price: '',
      start_date: startDate,
      end_date: startDate,
      date_text: [startDate, duration].filter(Boolean).join(' • '),
      location,
      city: '',
      state: '',
      country: location,
      accreditation: provider,
      tags: ['In Person', eventType, 'World Dental Events', inferTopic(title, eventType)].filter(Boolean),
      metadata: {
        extracted_from: 'world-dental-events-listing',
        organisation,
        duration,
      },
    }));
  });

  return {
    rows,
    maxPage: Number.isFinite(maxPage) && maxPage > 0 ? maxPage : 1,
  };
}

export async function scrapeWorldDentalEventsInPerson() {
  console.log('   • Scraping World Dental Events in-person listings');
  const rows = [];
  const seen = new Set();

  for (const eventType of EVENT_TYPES) {
    if (rows.length >= MAX_ROWS) break;

    const firstUrl = eventType ? `${SOURCE_URL}?type=${encodeURIComponent(eventType)}` : SOURCE_URL;
    const eventTypeLabel = eventType || 'All Events';
    let parsed;

    try {
      parsed = parsePage(await fetchPage(firstUrl));
    } catch (error) {
      console.log(`      ⚠️ ${eventType} skipped: ${error.message}`);
      continue;
    }

    const maxPage = Math.min(parsed.maxPage, MAX_PAGES_PER_TYPE);
    const pageRows = [];

    function collect(parsedRows) {
      for (const row of parsedRows) {
        if (rows.length >= MAX_ROWS) break;
        const key = row.url || `${row.provider}:${row.title}:${row.start_date}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(row);
        pageRows.push(row);
      }
    }

    collect(parsed.rows);

    for (let page = 2; page <= maxPage && rows.length < MAX_ROWS; page += 1) {
      const pageUrl = eventType
        ? `${SOURCE_URL}?type=${encodeURIComponent(eventType)}&page=${page}`
        : `${SOURCE_URL}?page=${page}`;
      try {
        collect(parsePage(await fetchPage(pageUrl)).rows);
      } catch (error) {
        console.log(`      ⚠️ ${eventTypeLabel} page ${page} skipped: ${error.message}`);
      }
    }

    console.log(`      • ${eventTypeLabel}: ${pageRows.length} in-person rows`);
  }

  console.log(`   • Extracted ${rows.length} World Dental Events in-person rows`);
  return rows;
}
