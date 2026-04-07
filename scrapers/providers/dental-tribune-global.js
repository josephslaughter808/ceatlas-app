import * as cheerio from 'cheerio';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeCourse } from '../../lib/normalize.js';

const execFileAsync = promisify(execFile);

const BASE_URL = 'https://www.dental-tribune.com';
const SOURCE_URL = `${BASE_URL}/event/`;
const PROVIDER_SLUG_PREFIX = 'dental-tribune-global';
const SOURCE_PAGES = [
  SOURCE_URL,
  `${SOURCE_URL}page/2/`,
];

const MONTHS = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
};

const REMOTE_PATTERN = /\b(webinar|online|virtual|remote|on[-\s]?demand)\b/i;

function cleanText(value = '', max = 1200) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function slugify(value = '') {
  return cleanText(value, 180)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || PROVIDER_SLUG_PREFIX;
}

function absoluteUrl(value = '') {
  try {
    return new URL(value, BASE_URL).href;
  } catch {
    return SOURCE_URL;
  }
}

function parseStartDate(value = '') {
  const text = cleanText(value, 120).toLowerCase();
  let match = text.match(/\b(\d{1,2})\s+([a-z]+)\s*[-–]\s*\d{1,2}\s+[a-z]+\s+(20\d{2})\b/);
  if (match) {
    const [, day, monthName, year] = match;
    const month = MONTHS[monthName];
    return month ? `${year}-${month}-${day.padStart(2, '0')}` : '';
  }

  match = text.match(/\b(\d{1,2})\s*[-–]\s*\d{1,2}\s+([a-z]+)\s+(20\d{2})\b/);
  if (match) {
    const [, day, monthName, year] = match;
    const month = MONTHS[monthName];
    return month ? `${year}-${month}-${day.padStart(2, '0')}` : '';
  }

  match = text.match(/\b(\d{1,2})\s+([a-z]+)\s+(20\d{2})\b/);
  if (match) {
    const [, day, monthName, year] = match;
    const month = MONTHS[monthName];
    return month ? `${year}-${month}-${day.padStart(2, '0')}` : '';
  }

  return '';
}

function inferTopic(title = '') {
  const value = title.toLowerCase();
  if (/endo|aae|if(ea|ea )/.test(value)) return 'Endodontics';
  if (/ortho|aao|eos|aligner/.test(value)) return 'Orthodontics';
  if (/implant|aaid|icoi|iti|osseointegration|perio/.test(value)) return 'Implants';
  if (/pediatric|aapd/.test(value)) return 'Pediatric Dentistry';
  if (/oral|maxillofacial|aaoms/.test(value)) return 'Oral Surgery';
  if (/digital|ids|technology|dental show|expo/.test(value)) return 'Digital Dentistry & Technology';
  if (/esthetic|aesthetic|cosmetic|smile/.test(value)) return 'Esthetics & Facial Esthetics';
  return 'Dental Conference';
}

async function fetchHtml(url) {
  const { stdout } = await execFileAsync('curl', [
    '-L',
    '--max-time',
    '45',
    '-A',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    url,
  ], {
    maxBuffer: 15 * 1024 * 1024,
  });

  return stdout;
}

export async function scrapeDentalTribuneGlobalEvents() {
  console.log('   • Scraping Dental Tribune International in-person event listings');
  const rows = [];
  const seen = new Set();

  for (const pageUrl of SOURCE_PAGES) {
    const html = await fetchHtml(pageUrl);
    const $ = cheerio.load(html);

    $('.item.event-row').not('.to-sidebar').each((_, item) => {
      const node = $(item);
      const title = cleanText(node.find('a.name').first().text(), 300);
      const url = absoluteUrl(node.find('a.name').first().attr('href'));
      const dateText = cleanText(node.find('.meta strong').first().text(), 100);
      const location = cleanText(node.find('div:contains("Location:")').last().text().replace('Location:', ''), 200);
      const startDate = parseStartDate(dateText);
      const combined = `${title} ${dateText} ${location}`;

      if (!title || !url || seen.has(url) || !startDate || REMOTE_PATTERN.test(combined)) return;
      seen.add(url);

      const parts = location.split(',').map((part) => cleanText(part, 80)).filter(Boolean);
      const city = parts[0] || '';
      const country = parts.at(-1) || '';
      const topic = inferTopic(title);

      rows.push(normalizeCourse({
        provider: title,
        provider_slug: slugify(title),
        source_url: SOURCE_URL,
        url,
        title,
        description: `${title} is a public, in-person dental event listed by Dental Tribune International.`,
        course_type: 'Dental Event',
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
        state: '',
        country,
        accreditation: title,
        tags: ['In Person', 'Conference', 'Dental Tribune International', topic].filter(Boolean),
        metadata: {
          extracted_from: 'dental-tribune-global-events',
        },
      }));
    });
  }

  console.log(`   • Extracted ${rows.length} Dental Tribune International in-person event rows`);
  return rows;
}
