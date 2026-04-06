import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const KURARAY_PROVIDER = 'Kuraray Dental CE';
const KURARAY_PROVIDER_SLUG = 'kuraray-dental-ce';
const KURARAY_SITEMAP_URL = 'https://kuraraydental.com/mec-events-sitemap.xml';

function cleanText(value = '', max = 500) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanMultilineText(value = '', max = 1800) {
  return String(value)
    .replace(/\r/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, max);
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function toIsoDate(value = '') {
  const text = cleanText(value, 80);
  if (!text) return '';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function inferTopic(text = '') {
  const value = cleanText(text, 250).toLowerCase();
  if (!value) return 'General Dentistry';
  if (/zirconia|ceramic|veneer|cement|composite|restorat|anterior|posterior/.test(value)) return 'Restorative Dentistry';
  if (/cad\/cam|cerec|digital|milling/.test(value)) return 'Digital Dentistry & Technology';
  if (/adhesion|adhesive|bond/.test(value)) return 'Restorative Dentistry';
  if (/practice|entrepreneur/.test(value)) return 'Practice Management & Business';
  return 'General Dentistry';
}

function extractJsonLdEvent($) {
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const script of scripts) {
    const raw = $(script).contents().text();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const candidate of candidates) {
        if (candidate?.['@type'] === 'Event' || candidate?.name) {
          return candidate;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      const value = await mapper(items[currentIndex], currentIndex);
      if (value) results.push(value);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function collectEventUrls() {
  const $ = await loadHTML(KURARAY_SITEMAP_URL);
  const urls = $('loc')
    .map((_, el) => cleanText($(el).text(), 500))
    .get()
    .filter((url) => /^https:\/\/kuraraydental\.com\/events\/.+/.test(url))
    .filter((url) => url !== 'https://kuraraydental.com/events/');

  return [...new Set(urls)];
}

async function scrapeEvent(url) {
  try {
    const $ = await loadHTML(url);
    const event = extractJsonLdEvent($);
    const title = cleanText(event?.name || $('.mec-single-title').text(), 250);
    if (!title) return null;

    const rawDescription = decodeHtml(event?.description || '');
    const pageDescription = $('.mec-single-event-description').html() || rawDescription;
    const description = cleanMultilineText(pageDescription, 1800);
    const performerNames = Array.isArray(event?.performer)
      ? event.performer.map((performer) => cleanText(performer?.name, 120)).filter(Boolean)
      : [cleanText(event?.performer?.name, 120)].filter(Boolean);
    const locationName = cleanText(event?.location?.name, 160);
    const locationAddress = cleanText(event?.location?.address, 220);
    const price = cleanText(event?.offers?.price, 80);
    const startDate = toIsoDate(event?.startDate || $('.mec-start-date-label').text());
    const endDate = toIsoDate(event?.endDate || startDate);
    const timeText = cleanText($('.mec-single-event-time dd').first().text(), 120);
    const audience = cleanText(
      (description.match(/Intended Audience:\s*([^\n]+)/i) || [])[1] || '',
      180,
    );

    return normalizeCourse({
      provider: KURARAY_PROVIDER,
      provider_slug: KURARAY_PROVIDER_SLUG,
      source_url: KURARAY_SITEMAP_URL,
      url,
      title,
      description,
      course_type: /online|webinar/i.test(description) ? 'Live Webinar' : 'Live Course',
      format: event?.eventAttendanceMode?.includes('Offline') ? 'In Person' : 'Online',
      audience: audience || 'Dentists',
      topic: inferTopic(`${title} ${description}`),
      price: price ? `$${price}` : cleanText($('.mec-events-event-cost').text(), 80),
      price_amount: price,
      start_date: startDate,
      end_date: endDate,
      date_text: [startDate, timeText].filter(Boolean).join(' • '),
      location: [locationName, locationAddress].filter(Boolean).join(' • '),
      instructors: performerNames.join('\n'),
      country: 'USA',
      accreditation: 'Kuraray Dental',
      tags: ['Kuraray Dental', inferTopic(`${title} ${description}`), event?.eventAttendanceMode?.includes('Offline') ? 'In Person' : 'Online'].filter(Boolean),
      metadata: {
        extracted_from: 'kuraray-mec-sitemap',
        image_url: cleanText(event?.image, 500),
        location_name: locationName || null,
        location_address: locationAddress || null,
      },
    });
  } catch (error) {
    console.log(`      ⚠️ Failed to load Kuraray event ${url}: ${error.message}`);
    return null;
  }
}

export async function scrapeKuraray() {
  console.log('   • Scraping Kuraray Dental event catalog');
  const urls = await collectEventUrls();
  const results = await mapWithConcurrency(urls, 4, scrapeEvent);
  console.log(`   • Extracted ${results.length} Kuraray Dental CE courses`);
  return results;
}
