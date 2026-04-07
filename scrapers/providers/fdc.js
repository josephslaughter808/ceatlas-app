import * as cheerio from 'cheerio';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeCourse } from '../../lib/normalize.js';

const execFileAsync = promisify(execFile);

const SOURCE_URL = 'https://events.floridadental.org/index.cfm?do=expomap.sessResults&event_id=79&regs_id=0&search_type=all';
const BASE_URL = 'https://events.floridadental.org/';
const PROVIDER = 'Florida Dental Convention 2026';
const PROVIDER_SLUG = 'florida-dental-convention-2026';
const ACCREDITATION = 'Florida Dental Convention 2026';
const LOCATION = 'Gaylord Palms Resort & Convention Center, Orlando, FL';

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
    return new URL(value, BASE_URL).href;
  } catch {
    return SOURCE_URL;
  }
}

function parseFdcDate(value = '') {
  const match = cleanText(value).match(/\b([A-Za-z]{3})\.\,\s+([A-Za-z]{3})\.\s+(\d{1,2})\b/);
  if (!match) return '';
  const month = MONTHS[match[2].toLowerCase()];
  const day = match[3].padStart(2, '0');
  return month ? `2026-${month}-${day}` : '';
}

function inferTopic(title = '') {
  const value = title.toLowerCase();
  if (/implant|full-arch|graft/.test(value)) return 'Implants';
  if (/endo|root canal|trauma/.test(value)) return 'Endodontics';
  if (/tmj|tmd|orofacial|pain/.test(value)) return 'Orofacial Pain & TMD';
  if (/ortho|aligner/.test(value)) return 'Orthodontics';
  if (/pediatric|children/.test(value)) return 'Pediatric Dentistry';
  if (/sleep|airway|apnea/.test(value)) return 'Sleep & Airway';
  if (/digital|cbct|3d|printing|ai/.test(value)) return 'Digital Dentistry & Technology';
  if (/hygiene|periodontal|prevention|oral hygiene/.test(value)) return 'Hygiene & Periodontics';
  if (/coding|billing|marketing|practice|leadership|scheduling/.test(value)) return 'Practice Management & Business';
  if (/oral cancer|lesion|pathology|mucosal/.test(value)) return 'Oral Medicine';
  return 'General Dentistry';
}

async function fetchHtml() {
  const { stdout } = await execFileAsync('curl', [
    '-L',
    '--max-time',
    '30',
    '-A',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    SOURCE_URL,
  ], {
    maxBuffer: 10 * 1024 * 1024,
  });

  return stdout;
}

export async function scrapeFDC2026() {
  console.log('   • Scraping Florida Dental Convention 2026 in-person sessions');
  const html = await fetchHtml();
  const $ = cheerio.load(html);
  const rows = [];
  const seen = new Set();

  $('a.page_link[href*="do=expomap.sess"][href*="session_id="]').each((_, link) => {
    const anchor = $(link);
    const row = anchor.closest('.row');
    const columns = row.children('div');
    const title = cleanText(anchor.text(), 300);
    const detailUrl = absoluteUrl(anchor.attr('href'));
    const dayText = cleanText(columns.eq(1).text(), 80);
    const timeText = cleanText(columns.eq(2).text(), 80);
    const creditsText = cleanText(columns.eq(3).text(), 40);
    const credits = Number.parseFloat(creditsText);
    const startDate = parseFdcDate(dayText);

    if (!title || seen.has(detailUrl) || !startDate || !Number.isFinite(credits) || credits <= 0) return;
    seen.add(detailUrl);

    rows.push(normalizeCourse({
      provider: PROVIDER,
      provider_slug: PROVIDER_SLUG,
      source_url: SOURCE_URL,
      url: detailUrl,
      title,
      description: `${title} is an in-person Florida Dental Convention 2026 session in Orlando, Florida.`,
      course_type: /workshop|hands-on/i.test(title) ? 'Hands-On Workshop' : 'Conference Session',
      format: 'In Person',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(title),
      credits_text: `${creditsText} CE hours`,
      price: '',
      start_date: startDate,
      end_date: startDate,
      date_text: [dayText, timeText].filter(Boolean).join(' • '),
      location: LOCATION,
      city: 'Orlando',
      state: 'FL',
      country: 'USA',
      accreditation: ACCREDITATION,
      tags: ['Conference', 'In Person', 'Florida Dental Convention', inferTopic(title)].filter(Boolean),
      metadata: {
        extracted_from: 'fdc-session-directory',
      },
    }));
  });

  console.log(`   • Extracted ${rows.length} Florida Dental Convention in-person rows`);
  return rows;
}
