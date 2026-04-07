import * as cheerio from 'cheerio';
import { normalizeCourse } from '../../lib/normalize.js';

const PROVIDER = 'Dental CE Academy';
const PROVIDER_SLUG = 'dental-ce-academy';
const SITEMAP_URL = 'https://www.dentalceacademy.com/pages-sitemap.xml';
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';
const DETAIL_CONCURRENCY = 8;

const EXCLUDED_PATHS = [
  'contact-us',
  'terms-and-conditions',
  'reviews-free-dental-ce-webinars',
  'ceverification',
  'quiz',
  'confirmation-live-webinar',
];

function cleanText(value = '', max = 1800) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function extractSitemapUrls(xml = '') {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)]
    .map((match) => cleanText(match[1], 500))
    .filter((url) => /^https:\/\/www\.dentalceacademy\.com\/[^?#]+$/i.test(url))
    .filter((url) => !EXCLUDED_PATHS.some((path) => url.includes(`/${path}`)));
}

function meta($, selector) {
  return cleanText($(`meta[${selector}]`).attr('content') || '', 2000);
}

function isCoursePage(url = '', title = '', description = '') {
  const haystack = `${url} ${title} ${description}`.toLowerCase();
  if (/\b(contact|terms|review|verification|confirmation|quiz)\b/.test(haystack)) return false;
  return /\b(ce|ceu|credit|webinar|course|continuing dental education|on[-\s]?demand|live)\b/.test(haystack);
}

function creditsFrom(text = '') {
  const match = cleanText(text, 3000).match(/\b(?:receive|earn)?\s*(\d+(?:\.\d+)?)\s*(?:ce\s*)?(?:credit|credits|ceu|ceus)\b/i);
  return match?.[1] || '';
}

function inferTopic(text = '') {
  const value = cleanText(text, 2000).toLowerCase();
  if (/periodont|perio|gingiv|biofilm/.test(value)) return 'Periodontics';
  if (/implant|peri-implant/.test(value)) return 'Implants';
  if (/infection|aerosol|surface|hand hygiene|water|clostrid|superbug|antimicrobial/.test(value)) return 'Infection Control';
  if (/antibiotic|prophylaxis|opioid|pain/.test(value)) return 'Pharmacology';
  if (/ai|artificial intelligence|charting|digital/.test(value)) return 'Digital Dentistry & Technology';
  if (/nutrition|diabetes|xerostomia|menopause|geriatric|oral health|systemic/.test(value)) return 'Dental Hygiene';
  if (/human trafficking|workplace violence|child abuse/.test(value)) return 'Ethics & Jurisprudence';
  if (/caries|fluoride|hydroxyapatite|xylitol/.test(value)) return 'Preventive Dentistry';
  if (/hpv|mucositis|aphthous|pathology|oral medicine/.test(value)) return 'Oral Medicine';
  return 'General Dentistry';
}

function courseTypeFor(url = '', text = '') {
  const value = `${url} ${text}`.toLowerCase();
  if (/live|april|may-2026/.test(value) && !/recorded|on-demand|ondemand/.test(value)) return 'Live Webinar';
  if (/recorded|on-demand|ondemand/.test(value)) return 'On-Demand Webinar';
  return 'Dental CE Webinar';
}

async function fetchText(url, accept = 'text/html,*/*;q=0.8') {
  const response = await fetch(url, {
    headers: {
      Accept: accept,
      'User-Agent': BROWSER_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Dental CE Academy returned ${response.status} for ${url}`);
  }

  return response.text();
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

async function scrapeDetail(url) {
  try {
    const html = await fetchText(url);
    const $ = cheerio.load(html);
    const title = cleanText(
      meta($, 'property="og:title"').replace(/\s*\|\s*Dental CE Academy$/i, '')
      || $('title').first().text().replace(/\s*\|\s*Dental CE Academy$/i, ''),
      250,
    );
    const description = meta($, 'name="description"') || meta($, 'property="og:description"');
    if (!title || !isCoursePage(url, title, description)) return null;

    const credits = creditsFrom(`${title} ${description}`);
    const courseType = courseTypeFor(url, `${title} ${description}`);

    return normalizeCourse({
      provider: PROVIDER,
      provider_slug: PROVIDER_SLUG,
      source_url: SITEMAP_URL,
      url,
      title,
      description: description || `${title} is listed in Dental CE Academy's public dental CE webinar catalog.`,
      course_type: courseType,
      format: 'Online',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${title} ${description}`),
      credits_text: credits ? `${credits} CE Credit${credits === '1' ? '' : 's'}` : '',
      price: 'Free',
      date_text: /live webinar/i.test(courseType) ? 'Live webinar' : 'On-demand',
      location: 'Online',
      country: 'USA',
      accreditation: 'Dental CE Academy',
      tags: ['Dental CE Academy', 'Online', courseType].filter(Boolean),
      metadata: {
        extracted_from: 'dental-ce-academy-sitemap-pages',
      },
    });
  } catch (error) {
    console.log(`      ⚠️ Dental CE Academy skipped ${url}: ${error.message}`);
    return null;
  }
}

export async function scrapeDentalCEAcademy() {
  console.log(`   • Scraping ${PROVIDER}`);
  const xml = await fetchText(SITEMAP_URL, 'application/xml,text/xml,*/*;q=0.8');
  const urls = extractSitemapUrls(xml);
  const rows = await mapWithConcurrency(urls, DETAIL_CONCURRENCY, scrapeDetail);
  const deduped = [];
  const seen = new Set();

  for (const row of rows.filter(Boolean)) {
    const key = row.url || `${row.provider}::${row.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  console.log(`   • Extracted ${deduped.length} ${PROVIDER} rows`);
  return deduped;
}
