import * as cheerio from 'cheerio';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeCourse } from '../../lib/normalize.js';

const execFileAsync = promisify(execFile);

const SOURCE_URL = 'https://am2026.perio.org/schedule-of-events-2/';
const PROVIDER = 'AAP Annual Meeting 2026';
const PROVIDER_SLUG = 'aap-annual-meeting-2026';
const LOCATION = 'Seattle, WA';

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

function parseDate(value = '') {
  const match = cleanText(value).match(/\b([A-Za-z]+),\s+([A-Za-z]{3})\s+(\d{1,2})\b/);
  if (!match) return '';
  const month = MONTHS[match[2].toLowerCase()];
  const day = match[3].padStart(2, '0');
  return month ? `2026-${month}-${day}` : '';
}

function inferTopic(title = '') {
  const value = title.toLowerCase();
  if (/implant|peri-implant|bone|graft|edentulous/.test(value)) return 'Implants';
  if (/periodont|furcation|gingival|soft tissue|root coverage/.test(value)) return 'Periodontics & Hygiene';
  if (/ortho|dentofacial/.test(value)) return 'Orthodontics';
  if (/sedation|anxiety/.test(value)) return 'Anesthesia & Sedation';
  if (/pathology|oral pathology/.test(value)) return 'Oral Medicine';
  if (/hygiene/.test(value)) return 'Hygiene & Periodontics';
  return 'Periodontics & Hygiene';
}

async function fetchHtml() {
  const { stdout } = await execFileAsync('curl', [
    '--http1.1',
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

export async function scrapeAAPAnnualMeeting2026() {
  console.log('   • Scraping AAP Annual Meeting 2026 in-person schedule');
  const html = await fetchHtml();
  const $ = cheerio.load(html);
  const rows = [];
  const seen = new Set();

  $('details').each((_, detail) => {
    const detailNode = $(detail);
    const dayLabel = cleanText(detailNode.children('summary').first().text().replace('+', ''), 80);
    const startDate = parseDate(dayLabel);
    if (!startDate) return;

    detailNode.find('.presentation_item').each((__, item) => {
      const sessionNode = $(item);
      const timeText = cleanText(sessionNode.find('.presentation_time').first().text(), 80);

      sessionNode.find('.presentation_title a[href*="/presentation/"]').each((___, anchor) => {
        const link = $(anchor);
        const title = cleanText(link.text(), 300);
        const url = absoluteUrl(link.attr('href'));
        if (!title || seen.has(url)) return;
        seen.add(url);

        rows.push(normalizeCourse({
          provider: PROVIDER,
          provider_slug: PROVIDER_SLUG,
          source_url: SOURCE_URL,
          url,
          title,
          description: `${title} is an in-person session at the American Academy of Periodontology Annual Meeting 2026 in Seattle.`,
          course_type: /ticketed|course|workshop/i.test(title) ? 'Conference Course' : 'Conference Session',
          format: 'In Person',
          audience: 'Dentists and Dental Team',
          topic: inferTopic(title),
          credits_text: '',
          price: '',
          start_date: startDate,
          end_date: startDate,
          date_text: [dayLabel, timeText].filter(Boolean).join(' • '),
          location: LOCATION,
          city: 'Seattle',
          state: 'WA',
          country: 'USA',
          accreditation: 'American Academy of Periodontology',
          tags: ['Conference', 'In Person', 'AAP Annual Meeting', inferTopic(title)].filter(Boolean),
          metadata: {
            extracted_from: 'aap-annual-meeting-schedule',
          },
        }));
      });
    });
  });

  console.log(`   • Extracted ${rows.length} AAP Annual Meeting in-person rows`);
  return rows;
}
