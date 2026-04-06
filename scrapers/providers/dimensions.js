import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const PROVIDER = 'Dimensions of Dental Hygiene CE';
const PROVIDER_SLUG = 'dimensions-of-dental-hygiene-ce';
const BASE_URL = 'https://dimensionsofdentalhygiene.com';
const START_URL = `${BASE_URL}/ce/ce-courses/`;

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
  if (/access/.test(value)) return 'Access to Care';
  if (/anesthesia/.test(value)) return 'Anesthesia';
  if (/antimicrobial/.test(value)) return 'Infection Control';
  if (/caries|fluoride|remineral/.test(value)) return 'Preventive Dentistry';
  if (/endo/.test(value)) return 'Endodontics';
  if (/ergonomic/.test(value)) return 'Ergonomics';
  if (/esthetic/.test(value)) return 'Esthetics & Facial Esthetics';
  if (/ethic/.test(value)) return 'Ethics';
  if (/forensic/.test(value)) return 'Forensic Odontology';
  if (/infection/.test(value)) return 'Infection Control';
  if (/instrument|ultrasonic|polishing/.test(value)) return 'Dental Hygiene';
  if (/oral pathology/.test(value)) return 'Oral Pathology';
  if (/systemic|alzheimer|sickle/.test(value)) return 'Oral Systemic Health';
  if (/ortho/.test(value)) return 'Orthodontics';
  if (/pediatric/.test(value)) return 'Pediatric Dentistry';
  if (/periodont/.test(value)) return 'Periodontics';
  if (/pharmacology|drug/.test(value)) return 'Pharmacology';
  if (/radiograph/.test(value)) return 'Radiology';
  if (/xerostomia/.test(value)) return 'Oral Medicine';
  return 'Dental Hygiene';
}

function extractCredits(text = '') {
  const match = cleanText(text, 3000).match(/\b\d+(?:\.\d+)?\s*(?:CEU|CEUs|credit|credits|hour|hours)\b/i);
  return match ? cleanText(match[0], 60) : '';
}

function extractPrice(text = '') {
  const match = cleanText(text, 3000).match(/\$\s?\d+(?:\.\d{2})?/);
  if (match) return cleanText(match[0], 40);
  return /\bfree\b/i.test(text) ? 'Free' : '';
}

async function collectCourseUrls() {
  const seeds = new Set([START_URL, `${BASE_URL}/ce/ce-courses-2/`]);
  const firstPage = await loadHTML(START_URL);

  firstPage('a[href*="/ce/"]')
    .map((_, link) => absoluteUrl(firstPage(link).attr('href') || '', START_URL))
    .get()
    .filter((url) => /-ces\/?$/i.test(url))
    .forEach((url) => seeds.add(url));

  const courseUrls = new Set();
  for (const pageUrl of seeds) {
    try {
      const dom = pageUrl === START_URL ? firstPage : await loadHTML(pageUrl);
      dom('a[href*="/courses/"]')
        .map((_, link) => absoluteUrl(dom(link).attr('href') || '', pageUrl))
        .get()
        .filter((url) => /\/courses\/[^/]+\/?$/i.test(url))
        .forEach((url) => courseUrls.add(url));
    } catch (error) {
      console.warn(`      ⚠️ Failed to load Dimensions category ${pageUrl}: ${error.message}`);
    }
  }

  return [...courseUrls];
}

async function scrapeDetail(url) {
  const dom = await loadHTML(url);
  const title = cleanText(dom('h1').first().text() || dom('title').first().text(), 250)
    .replace(/\s*-\s*Dimensions.*$/i, '');
  const bodyText = cleanText(dom('body').text(), 5000);
  const description = dom('article p, main p, .entry-content p')
    .map((_, p) => cleanText(dom(p).text(), 700))
    .get()
    .filter((text) => text.length > 50 && !/cookie|privacy|login|cart|checkout/i.test(text))
    .slice(0, 3)
    .join(' ');
  const credits = extractCredits(bodyText);
  const price = extractPrice(bodyText);

  if (!title) return null;

  return normalizeCourse({
    provider: PROVIDER,
    provider_slug: PROVIDER_SLUG,
    source_url: START_URL,
    url,
    title,
    description: description || `${title} is available in the Dimensions of Dental Hygiene CE library.`,
    course_type: 'Online Course',
    format: 'Online',
    audience: 'Dental Hygienists and Dental Team',
    topic: inferTopic(`${title} ${description}`),
    credits,
    credits_text: credits,
    price,
    location: 'Online',
    country: 'USA',
    accreditation: 'Dimensions of Dental Hygiene',
    tags: ['Dimensions of Dental Hygiene', 'Online', 'Dental Hygiene'],
    metadata: {
      extracted_from: 'dimensions-ce-courses',
    },
  });
}

export async function scrapeDimensions() {
  console.log(`   • Scraping ${PROVIDER}`);
  const urls = await collectCourseUrls();
  const rows = [];

  for (const url of urls) {
    try {
      const row = await scrapeDetail(url);
      if (row) rows.push(row);
    } catch (error) {
      console.warn(`      ⚠️ Failed to load Dimensions course ${url}: ${error.message}`);
    }
  }

  console.log(`   • Extracted ${rows.length} ${PROVIDER} rows`);
  return rows;
}
