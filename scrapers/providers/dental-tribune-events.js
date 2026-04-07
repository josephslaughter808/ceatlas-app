import * as cheerio from 'cheerio';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeCourse } from '../../lib/normalize.js';

const execFileAsync = promisify(execFile);

const SOURCE_URL = 'https://us.dental-tribune.com/topic/';
const PROVIDER = 'Dental Tribune Events';
const PROVIDER_SLUG = 'dental-tribune-events';

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

function absoluteUrl(value = '') {
  try {
    return new URL(value, SOURCE_URL).href;
  } catch {
    return SOURCE_URL;
  }
}

function parseStartDate(value = '') {
  const text = cleanText(value).toLowerCase();
  const match = text.match(/\b(\d{1,2})\s*(?:-|to)\s*(?:\d{1,2}\s+)?([a-z]+)\s+(\d{4})\b/);
  if (!match) return '';
  const month = MONTHS[match[2]];
  const day = match[1].padStart(2, '0');
  return month ? `${match[3]}-${month}-${day}` : '';
}

function inferTopic(title = '') {
  const value = title.toLowerCase();
  if (/endo|aae/.test(value)) return 'Endodontics';
  if (/ortho|aao/.test(value)) return 'Orthodontics';
  if (/implant|aaid|icoi/.test(value)) return 'Implants';
  if (/pediatric|aapd/.test(value)) return 'Pediatric Dentistry';
  if (/periodont|aap /.test(value)) return 'Periodontics & Hygiene';
  if (/oral|maxillofacial|aaoms/.test(value)) return 'Oral Surgery';
  return 'Dental Conference';
}

async function fetchHtml() {
  const { stdout } = await execFileAsync('curl', [
    '-L',
    '--max-time',
    '45',
    '-A',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    SOURCE_URL,
  ], {
    maxBuffer: 10 * 1024 * 1024,
  });

  return stdout;
}

export async function scrapeDentalTribuneEvents() {
  console.log('   • Scraping Dental Tribune current in-person event listings');
  const html = await fetchHtml();
  const $ = cheerio.load(html);
  const rows = [];
  const seen = new Set();

  $('.item.event-row').each((_, item) => {
    const node = $(item);
    const title = cleanText(node.find('a.name').first().text(), 300);
    const url = absoluteUrl(node.find('a.name').first().attr('href'));
    const dateText = cleanText(node.find('.meta strong').first().text(), 80);
    const location = cleanText(node.find('div:contains("Location:")').last().text().replace('Location:', ''), 160);
    const startDate = parseStartDate(dateText);
    const combined = `${title} ${dateText} ${location}`;

    if (!title || !startDate || seen.has(url) || REMOTE_PATTERN.test(combined)) return;
    seen.add(url);

    const [city = '', country = ''] = location.split(',').map((part) => cleanText(part, 80));

    rows.push(normalizeCourse({
      provider: PROVIDER,
      provider_slug: PROVIDER_SLUG,
      source_url: SOURCE_URL,
      url,
      title,
      description: `${title} is an in-person dental event listed by Dental Tribune.`,
      course_type: 'Dental Event',
      format: 'In Person',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(title),
      credits_text: '',
      price: '',
      start_date: startDate,
      end_date: startDate,
      date_text: dateText,
      location,
      city,
      state: '',
      country,
      accreditation: PROVIDER,
      tags: ['In Person', 'Dental Tribune', inferTopic(title)].filter(Boolean),
      metadata: {
        extracted_from: 'dental-tribune-topic-events',
      },
    }));
  });

  console.log(`   • Extracted ${rows.length} Dental Tribune in-person event rows`);
  return rows;
}
