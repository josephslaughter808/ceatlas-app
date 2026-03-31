import axios from 'axios';
import { normalizeCourse } from '../../lib/normalize.js';

const YANKEE_PROVIDER = 'Yankee Dental Congress';
const YANKEE_PROVIDER_SLUG = 'yankee-dental-congress';
const YANKEE_BASE_URL = 'https://www.yankeedental.com/';
const YANKEE_EVENTS_URL = 'https://www.yankeedental.com/wp-json/wp/v2/event';

function cleanText(value = '', max = 500) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanMultiline(value = '', max = 2000) {
  return String(value)
    .replace(/\r/g, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, max);
}

function parseEventDate(value = '') {
  const text = cleanText(value, 120);
  if (!text) return '';

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function parsePrice(value = '') {
  const text = cleanText(value, 80);
  if (!text) return '';
  if (text === '0' || text === '0.00') return 'Free';
  return text.startsWith('$') ? text : `$${text}`;
}

function buildInstructor(post = {}) {
  const embedded = Array.isArray(post?._embedded?.['acf:post']) ? post._embedded['acf:post'] : [];
  const names = embedded
    .filter((item) => item?.type === 'speakers')
    .map((item) => cleanText(item?.title?.rendered, 160))
    .filter(Boolean);

  return [...new Set(names)].join('\n');
}

function looksLikeEducationalEvent(post = {}) {
  const acf = post?.acf || {};
  const title = cleanText(post?.title?.rendered, 250).toLowerCase();
  if (!title) return false;
  if (/\b(reception|luncheon|breakfast|meeting|ceremony|reunion|mixer|showdown|happening|student day|awards)\b/i.test(title)) {
    return false;
  }

  const ceu = Number(acf.ceu || 0);
  if (ceu > 0) return true;

  return Boolean(
    cleanText(acf.course_code, 80)
    || cleanText(acf.keywords, 240)
    || cleanText(acf.course_objectives, 400)
    || cleanText(acf.description, 400),
  );
}

export async function scrapeYankee(startUrl = YANKEE_BASE_URL) {
  console.log('   • Scraping Yankee Dental Congress public catalog');

  const firstPage = await axios.get(YANKEE_EVENTS_URL, {
    params: {
      per_page: 100,
      page: 1,
      _embed: true,
    },
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CEAtlasBot/1.0)',
      Accept: 'application/json, text/plain, */*',
    },
  });

  const totalPages = Number(firstPage.headers['x-wp-totalpages'] || 1);
  const pages = [firstPage.data];

  for (let page = 2; page <= totalPages; page += 1) {
    const { data } = await axios.get(YANKEE_EVENTS_URL, {
      params: {
        per_page: 100,
        page,
        _embed: true,
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CEAtlasBot/1.0)',
        Accept: 'application/json, text/plain, */*',
      },
    });
    pages.push(data);
  }

  const results = [];

  for (const pageItems of pages) {
    for (const post of Array.isArray(pageItems) ? pageItems : []) {
      if (!looksLikeEducationalEvent(post)) continue;

      const acf = post?.acf || {};
      const title = cleanText(post?.title?.rendered, 250);
      const url = cleanText(post?.link, 500);
      if (!title || !url) continue;

      const startDate = parseEventDate(acf.event_start);
      const endDate = parseEventDate(acf.event_end);
      const price = parsePrice(acf.list_price);
      const topic = cleanText(acf.keywords, 160)
        || cleanText(Array.isArray(post.categories) ? post.categories.join(', ') : '', 160);

      results.push(normalizeCourse({
        provider: YANKEE_PROVIDER,
        provider_slug: YANKEE_PROVIDER_SLUG,
        source_url: startUrl,
        url,
        title,
        description: cleanMultiline(acf.description || post?.content?.rendered || '', 2500),
        course_type: 'Conference Session',
        format: 'In Person',
        topic,
        credits_text: cleanText(acf.ceu, 80),
        price,
        start_date: startDate,
        end_date: endDate || startDate,
        date_text: [cleanText(acf.event_start, 160), cleanText(acf.time_slot, 120)].filter(Boolean).join('\n'),
        location: cleanText(acf.room, 200) || 'Boston, MA',
        city: 'Boston',
        state: 'MA',
        country: 'USA',
        instructors: buildInstructor(post),
        accreditation: 'Yankee Dental Congress',
        requirements: cleanMultiline(acf.course_objectives || acf.supplies || '', 1200),
        tags: ['Conference', 'Yankee Dental Congress', 'In Person', topic].filter(Boolean),
        metadata: {
          extracted_from: 'wordpress-event-api',
          event_id: post.id,
          course_code: cleanText(acf.course_code, 80),
          room: cleanText(acf.room, 160),
          registration_url: cleanText(acf.registration_button_url, 500),
          external_pk: cleanText(acf.external_pk, 120),
        },
      }));
    }
  }

  console.log(`   • Extracted ${results.length} Yankee Dental Congress sessions`);
  return results;
}
