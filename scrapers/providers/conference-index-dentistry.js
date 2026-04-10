import * as cheerio from 'cheerio';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeCourse } from '../../lib/normalize.js';

const execFileAsync = promisify(execFile);

const SOURCE_URL = 'https://conferenceindex.org/conferences/dentistry';
const SOURCE_PAGES = [
  SOURCE_URL,
  `${SOURCE_URL}?page=2`,
  `${SOURCE_URL}?page=3`,
  'https://conferenceindex.org/conferences/oral-health',
  'https://conferenceindex.org/conferences/oral-surgery',
  'https://conferenceindex.org/conferences/dental-science',
  'https://conferenceindex.org/conferences/prosthodontics',
  'https://conferenceindex.org/conferences/oral-medicine',
  'https://conferenceindex.org/conferences/oral-pathology',
  'https://conferenceindex.org/conferences/dental-public-health',
  'https://conferenceindex.org/conferences/pediatric-dentistry',
  'https://conferenceindex.org/conferences/cosmetic-dentistry',
  'https://conferenceindex.org/conferences/dental-implantology',
  'https://conferenceindex.org/conferences/dental-materials',
  'https://conferenceindex.org/conferences/dental-hygiene',
  'https://conferenceindex.org/conferences/orthodontics',
  'https://conferenceindex.org/conferences/endodontics',
  'https://conferenceindex.org/conferences/endodontics?page=2',
  'https://conferenceindex.org/conferences/endodontics?page=3',
  'https://conferenceindex.org/conferences/periodontology',
  'https://conferenceindex.org/conferences/periodontology?page=2',
  'https://conferenceindex.org/conferences/periodontology?page=3',
  'https://conferenceindex.org/conferences/implantology',
  'https://conferenceindex.org/conferences/implantology?page=2',
];

const MONTHS = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

const DENTAL_TITLE_PATTERN = /\b(dent|oral|odont|endodont|orthodont|periodont|maxillofacial|prosthodont|implant|dentistry|dental)\b/i;
const REJECT_TITLE_PATTERN = /\b(medical and health sciences|biology and medical|biological and medical|allied health|medical futures|medical intelligence|clinical sciences|healthcare and medical|biosciences)\b/i;
const REMOTE_PATTERN = /\b(webinar|online|virtual|remote|hybrid|digital event|on[-\s]?demand)\b/i;

function cleanText(value = '', max = 1200) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function slugify(value = '') {
  return cleanText(value, 220)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'conference-index-dentistry';
}

function inferTopic(title = '') {
  const value = title.toLowerCase();
  if (/endodont|root canal/.test(value)) return 'Endodontics';
  if (/orthodont|aligner/.test(value)) return 'Orthodontics';
  if (/periodont/.test(value)) return 'Periodontics & Hygiene';
  if (/implant|osseointegration/.test(value)) return 'Implants';
  if (/maxillofacial|oral surgery|pathology|radiology/.test(value)) return 'Oral Surgery';
  if (/prosthodont/.test(value)) return 'Prosthodontics';
  if (/dental science|dentistry|oral health|dental/.test(value)) return 'General Dentistry';
  return 'Dental Conference';
}

function parseYearFromUrl(url = '') {
  return url.match(/-(20\d{2})-[a-z]+-/i)?.[1] || '';
}

function parseStartDate(text = '', url = '') {
  const match = cleanText(text, 80).match(/\b([A-Z][a-z]{2})\s+(\d{1,2})\b/);
  const year = parseYearFromUrl(url);
  if (!match || !year) return '';
  const month = MONTHS[match[1].toLowerCase()];
  return month ? `${year}-${month}-${match[2].padStart(2, '0')}` : '';
}

function parseLocation(text = '') {
  const parts = cleanText(text, 500).split(' - ');
  return cleanText(parts.at(-1) || '', 200);
}

function parseCityCountry(location = '') {
  const parts = location.split(',').map((part) => cleanText(part, 80)).filter(Boolean);
  return {
    city: parts[0] || '',
    country: parts.at(-1) || '',
  };
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
    maxBuffer: 12 * 1024 * 1024,
  });

  return stdout;
}

export async function scrapeConferenceIndexDentistry() {
  console.log('   • Scraping Conference Index dentistry in-person listings');
  const rows = [];
  const seen = new Set();

  for (const pageUrl of SOURCE_PAGES) {
    const html = await fetchHtml(pageUrl);
    const $ = cheerio.load(html);

    $('li').each((_, item) => {
      const node = $(item);
      const link = node.find('a[href*="conferenceindex.org/event/"]').first();
      if (!link.length) return;

      const url = cleanText(link.attr('href'), 500);
      const title = cleanText(link.attr('title') || link.text(), 300);
      const text = cleanText(node.text(), 600);
      const startDate = parseStartDate(text, url);
      const location = parseLocation(text);
      const combined = `${title} ${text} ${location} ${url}`;

      if (!title || !url || seen.has(url)) return;
      if (!DENTAL_TITLE_PATTERN.test(combined) || REJECT_TITLE_PATTERN.test(title)) return;
      if (REMOTE_PATTERN.test(combined) || !startDate || !location) return;
      seen.add(url);

      const { city, country } = parseCityCountry(location);
      const topic = inferTopic(title);
      const provider = `${title} - ${location}`;

      rows.push(normalizeCourse({
        provider,
        provider_slug: slugify(provider),
        source_url: SOURCE_URL,
        url,
        title: provider,
        description: `${provider} is a public, physical-location dental conference listing from Conference Index.`,
        course_type: 'Dental Conference / Event',
        format: 'In Person',
        audience: 'Dentists and Dental Team',
        topic,
        credits_text: '',
        price: '',
        start_date: startDate,
        end_date: startDate,
        date_text: cleanText(text.split(title)[0], 100),
        location,
        city,
        state: '',
        country,
        accreditation: provider,
        tags: ['In Person', 'Conference Index', topic].filter(Boolean),
        metadata: {
          extracted_from: 'conference-index-dentistry',
        },
      }));
    });
  }

  console.log(`   • Extracted ${rows.length} Conference Index dentistry in-person rows`);
  return rows;
}
