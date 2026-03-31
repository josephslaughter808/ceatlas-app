import axios from 'axios';
import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';
import { extractCourseDataFromPage } from '../lib/course-helpers.js';

const AAFE_PROVIDER = 'AAFE';
const AAFE_PROVIDER_SLUG = 'aafe';
const AAFE_BASE_URL = 'https://facialesthetics.org';
const AAFE_SOURCE_URL = 'https://facialesthetics.org/aafe-course-schedules/';
const AAFE_CONCURRENCY = 6;

function cleanText(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanMultiline(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function absoluteUrl(value = '') {
  if (!value) return '';
  try {
    return new URL(value, AAFE_BASE_URL).href;
  } catch {
    return '';
  }
}

function parseMonthDate(value = '') {
  const match = cleanText(value).match(/\b([A-Z][a-z]{2,8}\.?\s+\d{1,2})(?:\s*-\s*\d{1,2})?\b/);
  if (!match) return '';

  const normalized = match[1].replace('.', '');
  const parsed = new Date(`${normalized}, 2026`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function extractCityState(title = '') {
  const match = cleanText(title).match(/^([^,]+),\s*([A-Z]{2})\b/);
  if (!match) return { city: '', state: '' };
  return {
    city: cleanText(match[1], 80),
    state: cleanText(match[2], 10),
  };
}

function parseTicketPrice(meta = {}) {
  const rawPrice = cleanText(meta?._price || '', 40);
  if (rawPrice) return rawPrice.startsWith('$') ? rawPrice : `$${rawPrice}`;

  const rawTickets = meta?._tribe_tickets_list;
  if (!rawTickets) return '';

  try {
    const tickets = JSON.parse(rawTickets);
    const prices = tickets
      .map((ticket) => Number(ticket.price))
      .filter((price) => Number.isFinite(price));
    if (prices.length === 0) return '';
    const minPrice = Math.min(...prices);
    return `$${minPrice}`;
  } catch {
    return '';
  }
}

function eventTopic(event = {}) {
  const embeddedTerms = event?._embedded?.['wp:term'] || [];
  for (const group of embeddedTerms) {
    if (!Array.isArray(group)) continue;
    const term = group.find((entry) => entry?.taxonomy === 'tribe_events_cat');
    if (term?.name) return cleanText(term.name, 120);
  }
  return '';
}

function courseLikelyOnline(url = '', title = '') {
  const text = `${url} ${title}`.toLowerCase();
  return /\bvirtual\b|\bonline\b|\bon-demand\b|\bbruxism\b|\bsleep medicine\b/.test(text);
}

async function fetchPaged(endpoint, options = {}) {
  const {
    perPage = 100,
    timeout = 30000,
  } = options;
  const rows = [];
  let page = 1;

  while (true) {
    let data;

    try {
      ({ data } = await axios.get(`${AAFE_BASE_URL}${endpoint}`, {
        timeout,
        params: { per_page: perPage, page, _embed: 1 },
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CEAtlasBot/1.0)',
          Accept: 'application/json, text/plain, */*',
        },
      }));
    } catch (error) {
      console.log(`      ⚠️ Failed to load AAFE API page ${endpoint}?page=${page}: ${error.message}`);
      break;
    }

    if (!Array.isArray(data) || data.length === 0) break;
    rows.push(...data);
    if (data.length < 100) break;
    page += 1;
  }

  return rows;
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

async function scrapeCoursePage(url, fallback = {}) {
  const $ = await loadHTML(url);
  const extracted = extractCourseDataFromPage($, {
    provider: AAFE_PROVIDER,
    providerUrl: AAFE_SOURCE_URL,
    pageUrl: url,
  });

  return normalizeCourse({
    ...extracted,
    provider: AAFE_PROVIDER,
    provider_slug: AAFE_PROVIDER_SLUG,
    source_url: AAFE_SOURCE_URL,
    url,
    title: cleanText(extracted.title, 250) || cleanText(fallback.title, 250),
    format: cleanText(extracted.format, 80) || (courseLikelyOnline(url, fallback.title) ? 'Online' : 'In Person'),
    course_type: cleanText(extracted.course_type, 120) || 'Course',
    topic: cleanText(extracted.topic, 120) || cleanText(fallback.topic, 120),
    accreditation: cleanText(extracted.accreditation, 200) || 'American Academy of Facial Esthetics',
    tags: [...new Set([
      'AAFE',
      cleanText(extracted.format, 80) || (courseLikelyOnline(url, fallback.title) ? 'Online' : 'In Person'),
      cleanText(fallback.topic, 120),
    ].filter(Boolean))],
    metadata: {
      ...(extracted.metadata || {}),
      extracted_from: 'aafe-course-page',
    },
  });
}

async function scrapeEventPage(event = {}) {
  const url = absoluteUrl(event.link);
  const title = cleanText(event?.title?.rendered, 250);
  const cityState = extractCityState(title);
  const priceText = parseTicketPrice(event.meta);
  const topic = eventTopic(event);
  const isVirtual = cleanText(event?.meta?._tribe_events_is_virtual) === '1';
  const titleWithoutLocation = title.replace(/^[^–-]+[–-]\s*[A-Z][a-z]{2,8}\.?\s*\d{1,2}(?:-\d{1,2})?\s*[–-]\s*/u, '');
  const excerpt = cleanMultiline(event?.excerpt?.rendered || '');

  return normalizeCourse({
    provider: AAFE_PROVIDER,
    provider_slug: AAFE_PROVIDER_SLUG,
    source_url: AAFE_SOURCE_URL,
    url,
    title: titleWithoutLocation || title,
    description: excerpt,
    format: isVirtual ? 'Online' : 'In Person',
    course_type: 'Live Training',
    topic,
    price: priceText,
    start_date: parseMonthDate(title),
    end_date: parseMonthDate(title),
    date_text: title,
    city: cityState.city,
    state: cityState.state,
    country: 'USA',
    accreditation: 'American Academy of Facial Esthetics',
    tags: [...new Set([
      'AAFE',
      'Event',
      isVirtual ? 'Online' : 'In Person',
      topic,
    ].filter(Boolean))],
    metadata: {
      extracted_from: 'aafe-events-api',
      event_id: event.id,
      ticketed: Boolean(event.ticketed),
      category_count: Array.isArray(event.tribe_events_cat) ? event.tribe_events_cat.length : 0,
    },
  });
}

export async function scrapeAAFE() {
  console.log('   • Scraping AAFE public course and event catalog');

  const [coursePosts, events] = await Promise.all([
    fetchPaged('/wp-json/wp/v2/courses', { perPage: 50, timeout: 30000 }),
    fetchPaged('/wp-json/wp/v2/tribe_events', { perPage: 100, timeout: 60000 }),
  ]);

  const seenUrls = new Set();
  const courseTargets = [];
  const eventTargets = [];

  for (const course of coursePosts) {
    const title = cleanText(course?.title?.rendered, 250);
    const url = absoluteUrl(course?.link);
    if (!url || !title || /^test\b/i.test(title) || seenUrls.has(url)) continue;
    seenUrls.add(url);
    courseTargets.push({ url, title });
  }

  for (const event of events) {
    const title = cleanText(event?.title?.rendered, 250);
    const url = absoluteUrl(event?.link);
    if (!url || !title || seenUrls.has(url)) continue;
    seenUrls.add(url);
    eventTargets.push(event);
  }

  const courseRows = await mapWithConcurrency(courseTargets, AAFE_CONCURRENCY, async ({ url, title }) => {
    try {
      return await scrapeCoursePage(url, { title });
    } catch (error) {
      console.log(`      ⚠️ Failed to load AAFE course ${url}: ${error.message}`);
      return null;
    }
  });

  const eventRows = await mapWithConcurrency(eventTargets, AAFE_CONCURRENCY, async (event) => {
    try {
      return await scrapeEventPage(event);
    } catch (error) {
      console.log(`      ⚠️ Failed to load AAFE event ${absoluteUrl(event?.link)}: ${error.message}`);
      return null;
    }
  });

  const results = [...courseRows, ...eventRows];

  console.log(`   • Extracted ${results.length} AAFE rows`);
  return results;
}
