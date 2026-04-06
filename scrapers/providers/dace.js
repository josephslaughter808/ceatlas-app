import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const PROVIDER = 'Dental Academy of Continuing Education';
const PROVIDER_SLUG = 'dental-academy-of-continuing-education';
const BASE_URL = 'https://dentalacademyofce.com';

function cleanText(value = '', max = 1800) {
  return String(value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = BASE_URL) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function inferTopic(text = '') {
  const value = text.toLowerCase();
  if (/implant/.test(value)) return 'Implants';
  if (/endo/.test(value)) return 'Endodontics';
  if (/periodont|gum|biofilm/.test(value)) return 'Periodontics';
  if (/pediatric|children/.test(value)) return 'Pediatric Dentistry';
  if (/denture|prosthodont/.test(value)) return 'Prosthodontics';
  if (/orthodont/.test(value)) return 'Orthodontics';
  if (/infection|glove|contamination/.test(value)) return 'Infection Control';
  if (/pain|analgesic|drug|medication/.test(value)) return 'Pharmacology';
  if (/business|practice|valuation|dso|lead/.test(value)) return 'Practice Management & Business';
  if (/restor|ceramic|zirconia|adhesive|bond/.test(value)) return 'Restorative Dentistry';
  if (/hygiene|gum|oral care/.test(value)) return 'Dental Hygiene';
  return 'General Dentistry';
}

function extractCredits(text = '') {
  const match = cleanText(text, 2000).match(/\b\d+(?:\.\d+)?\s*(?:CEU|CEUs|CE|credit|credits|hour|hours)\b/i);
  return match ? cleanText(match[0], 60) : '';
}

function extractPrice(text = '') {
  const match = cleanText(text, 2000).match(/\$\s?\d+(?:\.\d{2})?/);
  if (match) return cleanText(match[0], 40);
  return /\bfree\b/i.test(text) ? 'Free' : '';
}

async function collectCourseUrls() {
  const courseUrls = new Set();
  const visitedPages = new Set();

  for (let page = 1; page <= 40; page += 1) {
    const pageUrl = page === 1
      ? `${BASE_URL}/course-library/`
      : `${BASE_URL}/course-library/?sf_paged=${page}`;

    const dom = await loadHTML(pageUrl);
    const urls = dom('a[href*="/courses/"]')
      .map((_, link) => absoluteUrl(dom(link).attr('href') || '', pageUrl))
      .get()
      .filter((url) => /\/courses\/[^/]+\/?$/i.test(url));

    const before = courseUrls.size;
    urls.forEach((url) => courseUrls.add(url));
    visitedPages.add(pageUrl);

    const hasNext = dom(`a[href*="sf_paged=${page + 1}"]`).length > 0;
    if (!hasNext && courseUrls.size === before) break;
  }

  return [...courseUrls];
}

async function scrapeDetail(url) {
  const dom = await loadHTML(url);
  const title = cleanText(dom('h1').first().text() || dom('title').first().text(), 250)
    .replace(/\s*-\s*Dental Academy.*$/i, '');
  const bodyText = cleanText(dom('main').text() || dom('body').text(), 4000);
  const description = dom('p')
    .map((_, p) => cleanText(dom(p).text(), 500))
    .get()
    .filter((text) => text.length > 50 && !/cookie|privacy|login|password/i.test(text))
    .slice(0, 3)
    .join(' ');
  const credits = extractCredits(bodyText);
  const price = extractPrice(bodyText);

  if (!title) return null;

  return normalizeCourse({
    provider: PROVIDER,
    provider_slug: PROVIDER_SLUG,
    source_url: `${BASE_URL}/course-library/`,
    url,
    title,
    description: description || `${title} is available in the Dental Academy of Continuing Education course library.`,
    course_type: /on-demand/i.test(`${title} ${bodyText}`) ? 'On-Demand Course' : 'Online Course',
    format: 'Online',
    audience: 'Dentists and Dental Team',
    topic: inferTopic(`${title} ${description}`),
    credits,
    credits_text: credits,
    price,
    location: 'Online',
    country: 'USA',
    accreditation: 'Dental Academy of Continuing Education',
    tags: ['Dental Academy of CE', 'Online', /on-demand/i.test(title) ? 'On-Demand' : ''].filter(Boolean),
    metadata: {
      extracted_from: 'dace-course-library',
    },
  });
}

export async function scrapeDACE() {
  console.log(`   • Scraping ${PROVIDER}`);
  const urls = await collectCourseUrls();
  const rows = [];

  for (const url of urls) {
    try {
      const row = await scrapeDetail(url);
      if (row) rows.push(row);
    } catch (error) {
      console.warn(`      ⚠️ Failed to load Dental Academy course ${url}: ${error.message}`);
    }
  }

  console.log(`   • Extracted ${rows.length} ${PROVIDER} rows`);
  return rows;
}
