import axios from 'axios';
import { normalizeCourse } from '../../lib/normalize.js';

const SPEAR_PROVIDER = 'Spear Education';
const SPEAR_START_URL = 'https://campus.speareducation.com/calendar/';

function cleanText(value = '') {
  return String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractEventsFromHtml(html = '') {
  const endMarker = '];myCampus.arrEventRegistrations';
  const endIndex = html.indexOf(endMarker);
  if (endIndex < 0) return [];

  const prefix = html.slice(0, endIndex + 1);
  const startIndex = prefix.lastIndexOf('[{"id":');
  if (startIndex < 0) return [];

  try {
    const parsed = JSON.parse(prefix.slice(startIndex, endIndex + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function inferFormat(type = '') {
  const normalized = cleanText(type).toLowerCase();
  if (normalized.includes('virtual')) return 'Online';
  if (normalized.includes('workshop')) return 'In Person';
  if (normalized.includes('seminar')) return 'In Person';
  return 'In Person';
}

function inferCourseType(type = '') {
  const normalized = cleanText(type).toLowerCase();
  if (!normalized) return 'Course';
  return normalized
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildDetailUrl(event = {}) {
  const slug = cleanText(event.slug);
  const type = cleanText(event.type).toLowerCase();
  if (!slug) return SPEAR_START_URL;
  if (type === 'workshop') return `https://campus.speareducation.com/workshops/${slug}`;
  if (type === 'in-person-seminar') return `https://campus.speareducation.com/in-person-seminars/${slug}`;
  if (type === 'virtual-seminar') return `https://campus.speareducation.com/seminars/${slug}`;
  return `${SPEAR_START_URL}#${slug}`;
}

export async function scrapeSpear(startUrl = SPEAR_START_URL) {
  console.log('   • Scraping Spear Education campus calendar');

  const { data: html } = await axios.get(startUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CEAtlasBot/1.0)',
    },
  });
  const events = extractEventsFromHtml(html);
  const seenKeys = new Set();
  const results = [];

  for (const event of events) {
    const title = cleanText(event.title, 250);
    const startDate = cleanText(event.start_date, 40);
    const dedupeKey = `${title}|${startDate}|${cleanText(event.location, 120)}`;
    if (!title || !startDate || seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    const credits = cleanText(event.credits);
    const creditsText = credits ? `${credits} CE Credits` : '';
    const format = inferFormat(event.type);
    const courseType = inferCourseType(event.type);
    const location = cleanText(event.location, 180);
    const description = [
      cleanText(event.event_item, 180),
      cleanText(event.length, 120),
      location,
    ].filter(Boolean).join(' • ');

    results.push(normalizeCourse({
      provider: SPEAR_PROVIDER,
      provider_slug: 'spear',
      source_url: startUrl,
      url: buildDetailUrl(event),
      title,
      description,
      course_type: courseType,
      format,
      topic: cleanText(event.event_item, 180).replace(/^Spear\s+(Workshops|Seminars)\s*:\s*/i, ''),
      credits_text: creditsText,
      start_date: startDate,
      end_date: cleanText(event.end_date, 40),
      date_text: cleanText(event.date_range, 120),
      location,
      city: location.includes('Charlotte') ? 'Charlotte' : (location.includes('Scottsdale') ? 'Scottsdale' : ''),
      state: location.includes('AZ') ? 'AZ' : (location.includes('NC') ? 'NC' : ''),
      country: 'USA',
      accreditation: 'Spear Education',
      tags: ['Spear', format, courseType],
      metadata: {
        extracted_from: 'spear-campus-calendar',
        spear_id: event.spear_id || event.id,
        event_id: event.id,
        slug: cleanText(event.slug, 160),
        event_type: cleanText(event.type, 80),
        availability: cleanText(`${event.available ?? ''}/${event.allocated ?? ''}`, 40),
        timezone: cleanText(event.timezone, 80),
      },
    }));
  }

  console.log(`   • Extracted ${results.length} Spear Education events`);
  return results;
}
