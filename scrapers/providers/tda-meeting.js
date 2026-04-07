import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeCourse } from '../../lib/normalize.js';

const execFileAsync = promisify(execFile);

const PROVIDER = 'Texas Dental Association Meeting 2026';
const PROVIDER_SLUG = 'texas-dental-association-meeting-2026';
const API_URL = 'https://www.prereg.net/AppCFCs/appComponent.cfc?ReturnFormat=json&method=getEvents&dataSource=2026_tda&folderName=2026_tda';
const SOURCE_URL = 'https://www.prereg.net/qListPlugin/indexTDA.html?qDataSource=2026_tda';
const ACCREDITATION = 'Texas Dental Association Meeting 2026';
const LOCATION = 'Henry B. Gonzalez Convention Center, San Antonio, TX';

function cleanText(value = '', max = 1200) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function parseDate(value = '') {
  const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  return `${match[3]}-${match[1]}-${match[2]}`;
}

function inferTopic(event = {}) {
  const combined = cleanText(`${event.cat2 || ''} ${event.title || ''}`, 300).toLowerCase();
  if (/implant|graft/.test(combined)) return 'Implants';
  if (/endo|root canal|trauma/.test(combined)) return 'Endodontics';
  if (/ortho|aligner/.test(combined)) return 'Orthodontics';
  if (/pediatric|child/.test(combined)) return 'Pediatric Dentistry';
  if (/sleep|airway|apnea/.test(combined)) return 'Sleep & Airway';
  if (/digital|technology|3d|ai|cbct/.test(combined)) return 'Digital Dentistry & Technology';
  if (/hygiene|periodontal|prevention/.test(combined)) return 'Hygiene & Periodontics';
  if (/practice|business|billing|coding|finance|marketing/.test(combined)) return 'Practice Management & Business';
  return cleanText(event.cat2 || '', 80) || 'General Dentistry';
}

function buildDetailUrl(event = {}) {
  const id = encodeURIComponent(event.event_id || event.event_no || '');
  return id ? `${SOURCE_URL}#${id}` : SOURCE_URL;
}

async function fetchEvents() {
  const { stdout } = await execFileAsync('curl', [
    '-L',
    '--max-time',
    '30',
    '-A',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    API_URL,
  ], {
    maxBuffer: 10 * 1024 * 1024,
  });

  return JSON.parse(stdout);
}

export async function scrapeTDAMeeting2026() {
  console.log('   • Scraping Texas Dental Association Meeting 2026 in-person sessions');
  const events = await fetchEvents();
  const rows = [];
  const seen = new Set();

  for (const event of events) {
    const title = cleanText(event.title || '', 300);
    const startDate = parseDate(event.event_day);
    const credits = Number.parseFloat(event.ceus || event.ce_hours || event.ce || event.credit_hours || '');
    const fee = Number.parseFloat(event.course_fee1);
    const url = buildDetailUrl(event);

    if (!title || !startDate || seen.has(event.event_id || url)) continue;

    seen.add(event.event_id || url);

    rows.push(normalizeCourse({
      provider: PROVIDER,
      provider_slug: PROVIDER_SLUG,
      source_url: SOURCE_URL,
      url,
      title,
      description: cleanText(event.event_description || `${title} is an in-person Texas Dental Association Meeting 2026 session in San Antonio, Texas.`),
      course_type: /workshop|hands-on/i.test(title) ? 'Hands-On Workshop' : 'Conference Session',
      format: 'In Person',
      audience: cleanText(event.cat4 || 'Dentists and Dental Team', 200),
      topic: inferTopic(event),
      instructor: cleanText(event.speaker || '', 200),
      credits_text: Number.isFinite(credits) && credits > 0 ? `${credits} CE hours` : '',
      price: Number.isFinite(fee) && fee > 0 ? `$${fee.toFixed(2)}` : '',
      start_date: startDate,
      end_date: startDate,
      date_text: [event.event_day, `${event.start || ''}-${event.ends || ''}`].filter(Boolean).join(' • '),
      location: event.room_no ? `${LOCATION} • Room ${cleanText(event.room_no, 80)}` : LOCATION,
      city: 'San Antonio',
      state: 'TX',
      country: 'USA',
      accreditation: ACCREDITATION,
      tags: ['Conference', 'In Person', 'Texas Dental Association', inferTopic(event)].filter(Boolean),
      metadata: {
        extracted_from: 'tda-prereg-api',
        event_id: event.event_id || null,
      },
    }));
  }

  console.log(`   • Extracted ${rows.length} Texas Dental Association Meeting in-person rows`);
  return rows;
}
