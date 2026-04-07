import * as cheerio from 'cheerio';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeCourse } from '../../lib/normalize.js';
import { getTodayISO } from '../../lib/course-eligibility.js';

const execFileAsync = promisify(execFile);

const SOURCE_URL = 'https://allconferencealert.net/topics/dentistry.php';
const AJAX_URL = 'https://allconferencealert.net/topics/topicAjaxHandler.php';
const ROWS_PER_PAGE = 300;
const MAX_ROWS = 2100;

const MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const DENTAL_TITLE_PATTERN = /\b(dent|oral|odont|endodont|orthodont|periodont|maxillofacial|prosthodont|implant|dentistry|dental)\b/i;
const REMOTE_PATTERN = /\b(webinar|online|virtual|remote|hybrid|digital event|on[-\s]?demand)\b/i;
const REJECT_TITLE_PATTERN = /\b(journal|scopus|publication|paper submission|call for papers|medical and health sciences|allied health)\b/i;

function cleanText(value = '', max = 1200) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function slugify(value = '') {
  return cleanText(value, 240)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'all-conference-alert-dentistry';
}

function absolutizeUrl(url = '') {
  if (!url) return SOURCE_URL;
  return new URL(url, SOURCE_URL).href;
}

function inferTopic(title = '') {
  const value = title.toLowerCase();
  if (/pediatric|paediatric/.test(value)) return 'Pediatric Dentistry';
  if (/endodont|root canal/.test(value)) return 'Endodontics';
  if (/orthodont|aligner/.test(value)) return 'Orthodontics';
  if (/periodont|gum/.test(value)) return 'Periodontics & Hygiene';
  if (/implant/.test(value)) return 'Implants';
  if (/prosthodont/.test(value)) return 'Prosthodontics';
  if (/maxillofacial|oral surgery|pathology/.test(value)) return 'Oral Surgery';
  if (/oral hygiene|preventive|public health/.test(value)) return 'Preventive Dentistry';
  return 'Dental Conference';
}

function splitLocation(location = '') {
  const parts = cleanText(location, 200).split(',').map((part) => cleanText(part, 80)).filter(Boolean);
  return {
    city: parts[0] || '',
    state: parts.length > 2 ? parts[1] : '',
    country: parts.at(-1) || '',
  };
}

function datePartsFromRow(row) {
  const day = cleanText(row.find('.date h3').first().text(), 20).match(/\d{1,2}/)?.[0] || '';
  const monthLabel = cleanText(row.find('.date span').first().text(), 20).toLowerCase();
  const month = MONTHS[monthLabel] || MONTHS[monthLabel.slice(0, 3)];

  if (!day || !month) return { iso: '', label: cleanText(row.find('.date').text(), 80) };

  const today = getTodayISO();
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const year = month < currentMonth ? currentYear + 1 : currentYear;

  return {
    iso: `${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`,
    label: `${day} ${monthLabel.slice(0, 3).toUpperCase()} ${year}`,
  };
}

async function fetchHtml(url) {
  const { stdout } = await execFileAsync('curl', [
    '-L',
    '--max-time',
    '60',
    '-A',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    url,
  ], {
    maxBuffer: 16 * 1024 * 1024,
  });

  return stdout;
}

async function fetchAjaxRows(offset) {
  const { stdout } = await execFileAsync('curl', [
    '-L',
    '--max-time',
    '60',
    '-A',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    '-H',
    'Content-Type: application/x-www-form-urlencoded; charset=UTF-8',
    '-H',
    'X-Requested-With: XMLHttpRequest',
    '--data',
    `row=${offset}&search=dentistry&filter=&rowperpage=${ROWS_PER_PAGE}&append=true`,
    AJAX_URL,
  ], {
    maxBuffer: 24 * 1024 * 1024,
  });

  const jsonStart = stdout.indexOf('{');
  const payload = JSON.parse(jsonStart >= 0 ? stdout.slice(jsonStart) : stdout);
  return {
    html: payload.html || '',
    allcount: Number(payload.allcount || 0),
  };
}

function rowsFromHtml(html) {
  const $ = cheerio.load(`<table><tbody>${html}</tbody></table>`);
  return $('tr.aevent').toArray().map((row) => $(row));
}

function courseFromRow(row, seen) {
  const link = row.find('.name a[href]').first();
  const title = cleanText(link.text(), 260);
  const url = absolutizeUrl(cleanText(link.attr('href'), 500));
  const location = cleanText(row.find('.venue b').first().text(), 220);
  const { iso: startDate, label: dateText } = datePartsFromRow(row);
  const combined = `${title} ${location} ${url}`;

  if (!title || !url || !location || !startDate || seen.has(url)) return null;
  if (!DENTAL_TITLE_PATTERN.test(combined) || REMOTE_PATTERN.test(combined) || REJECT_TITLE_PATTERN.test(combined)) return null;
  if (/^(online|virtual|remote)$/i.test(location)) return null;

  seen.add(url);
  const { city, state, country } = splitLocation(location);
  const topic = inferTopic(title);
  const provider = `${title} - ${location} - ${dateText}`;

  return normalizeCourse({
    provider,
    provider_slug: slugify(provider),
    source_url: SOURCE_URL,
    url,
    title: provider,
    description: `${title} is a public, physical-location dentistry conference listing from All Conference Alert.`,
    course_type: 'Dental Conference / Event',
    format: 'In Person',
    audience: 'Dentists and Dental Team',
    topic,
    credits_text: '',
    price: '',
    start_date: startDate,
    end_date: startDate,
    date_text: dateText,
    location,
    city,
    state,
    country,
    accreditation: provider,
    tags: ['In Person', 'All Conference Alert', topic].filter(Boolean),
    metadata: {
      extracted_from: 'all-conference-alert-dentistry',
    },
  });
}

export async function scrapeAllConferenceAlertDentistry() {
  console.log('   • Scraping All Conference Alert dentistry in-person listings');
  const rows = [];
  const seen = new Set();

  const firstPageHtml = await fetchHtml(SOURCE_URL);
  const $ = cheerio.load(firstPageHtml);
  const total = Number($('#all').attr('value') || 0);

  for (const row of rowsFromHtml(firstPageHtml)) {
    const course = courseFromRow(row, seen);
    if (course) rows.push(course);
  }

  const totalRows = total || rows.length;
  for (let offset = ROWS_PER_PAGE; offset < Math.min(totalRows, MAX_ROWS); offset += ROWS_PER_PAGE) {
    const payload = await fetchAjaxRows(offset);
    for (const row of rowsFromHtml(payload.html)) {
      const course = courseFromRow(row, seen);
      if (course) rows.push(course);
    }
  }

  console.log(`   • Extracted ${rows.length} All Conference Alert dentistry in-person rows`);
  return rows;
}
