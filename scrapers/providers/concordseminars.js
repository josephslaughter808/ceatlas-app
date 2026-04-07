import * as cheerio from 'cheerio';
import { normalizeCourse } from '../../lib/normalize.js';

const PROVIDER = 'Concord Seminars';
const PROVIDER_SLUG = 'concord-seminars';
const SITEMAP_URL = 'https://www.concordseminars.com/sitemap.xml';
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';
const DETAIL_CONCURRENCY = 8;

function cleanText(value = '', max = 1800) {
  return String(value || '')
    .replace(/\\u0026/g, '&')
    .replace(/\\n/g, ' ')
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
    .filter((url) => /^https:\/\/www\.concordseminars\.com\/(?:courses|webinars|seminars)\//i.test(url));
}

function meta($, selector) {
  return cleanText($(`meta[${selector}]`).attr('content') || '', 2000);
}

function segmentFor(url = '') {
  try {
    return new URL(url).pathname.split('/').filter(Boolean)[0] || '';
  } catch {
    return '';
  }
}

function courseTypeFor(url = '') {
  const segment = segmentFor(url);
  if (segment === 'webinars') return 'Live Webinar';
  if (segment === 'seminars') return 'Seminar';
  return 'On-Demand Course';
}

function formatFor(url = '', text = '') {
  const value = `${url} ${text}`.toLowerCase();
  if (value.includes('/courses/')) return 'Online';
  if (value.includes('/webinars/')) return 'Online';
  if (/online|webinar|virtual/.test(value)) return 'Online';
  return 'In Person';
}

function inferTopic(text = '') {
  const value = cleanText(text, 2200).toLowerCase();
  if (/implant|osseointegration|sinus|graft|peri-implant/.test(value)) return 'Implants';
  if (/periodont|perio|scaling|root planing|hygiene therapy/.test(value)) return 'Periodontics';
  if (/endodont|root canal|pulp/.test(value)) return 'Endodontics';
  if (/pediatric|children|child/.test(value)) return 'Pediatric Dentistry';
  if (/orthodont|aligner/.test(value)) return 'Orthodontics';
  if (/sleep|airway|apnea|tmj|tmd|orofacial pain/.test(value)) return 'Sleep & Airway';
  if (/infection|osha|cdc|waterline|bloodborne|compliance|safety/.test(value)) return 'Infection Control';
  if (/opioid|pharmac|local anesthetic|antibiotic|medical emergenc|vaccine/.test(value)) return 'Pharmacology';
  if (/ethic|jurisprudence|abuse|domestic violence|trafficking|forensic/.test(value)) return 'Ethics & Jurisprudence';
  if (/pathology|oral lesion|oral medicine|cancer|hpv|diabetes|geriatric/.test(value)) return 'Oral Medicine';
  if (/crown|bridge|restorative|esthetic|cosmetic|dentition|veneer/.test(value)) return 'Restorative Dentistry';
  if (/digital|cbct|radiolog|radiograph/.test(value)) return 'Digital Dentistry & Technology';
  return 'General Dentistry';
}

function creditsFrom(text = '') {
  return cleanText(text.match(/\b(\d+(?:\.\d+)?)\s*(?:ce|ceu|credits?|hours?)\b/i)?.[1] || '', 40);
}

function isoDate(value = '') {
  const match = String(value).match(/\b(20\d{2}-\d{2}-\d{2})/);
  return match?.[1] || '';
}

function fieldFromSnippet(snippet = '', field = '') {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = snippet.match(new RegExp(`"${escaped}"\\s*:\\s*"([^"]+)"`));
  return cleanText(match?.[1] || '', 2000);
}

function titleMatchesSchema(title = '', schemaName = '') {
  const normalizedTitle = cleanText(title, 120).toLowerCase();
  const normalizedSchema = cleanText(schemaName, 120).toLowerCase();
  if (!normalizedTitle || !normalizedSchema) return false;
  return normalizedTitle.includes(normalizedSchema) || normalizedSchema.includes(normalizedTitle.slice(0, 45));
}

function extractMatchingEventSchema(html = '', title = '') {
  const decoded = html.replace(/\\"/g, '"').replace(/\\n/g, ' ');
  const matches = [...decoded.matchAll(/"@type"\s*:\s*"Event"/g)];

  for (const match of matches) {
    const start = decoded.lastIndexOf('{', match.index);
    if (start < 0) continue;

    const snippet = decoded.slice(start, match.index + 3500);
    const name = fieldFromSnippet(snippet, 'name');
    if (!titleMatchesSchema(title, name)) continue;

    const description = fieldFromSnippet(snippet, 'description');
    const startDate = isoDate(fieldFromSnippet(snippet, 'startDate'));
    const endDate = isoDate(fieldFromSnippet(snippet, 'endDate'));
    const attendance = fieldFromSnippet(snippet, 'eventAttendanceMode');
    const price = fieldFromSnippet(snippet, 'price');
    const currency = fieldFromSnippet(snippet, 'priceCurrency');
    const locationName = fieldFromSnippet(snippet, 'name');

    return {
      description,
      start_date: startDate,
      end_date: endDate || startDate,
      format: attendance.includes('Online') ? 'Online' : '',
      price: price ? `${currency || 'USD'} ${price}` : '',
      location: locationName && locationName !== name ? locationName : '',
    };
  }

  return {};
}

async function fetchText(url, accept = 'text/html,application/xhtml+xml,*/*;q=0.8') {
  const response = await fetch(url, {
    headers: {
      Accept: accept,
      'User-Agent': BROWSER_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Concord Seminars returned ${response.status} for ${url}`);
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
      meta($, 'property="og:title"')
      || $('title').first().text().replace(/\s*\|\s*Concord Seminars$/i, ''),
      250,
    );
    if (!title || /^concord seminars$/i.test(title)) return null;

    const metaDescription = meta($, 'name="description"') || meta($, 'property="og:description"');
    const schema = extractMatchingEventSchema(html, title);
    const description = schema.description || metaDescription || `${title} is listed in Concord Seminars' public dental CE catalog.`;
    const courseType = courseTypeFor(url);
    const credits = creditsFrom(`${title} ${description}`);

    return normalizeCourse({
      provider: PROVIDER,
      provider_slug: PROVIDER_SLUG,
      source_url: SITEMAP_URL,
      url,
      title,
      description,
      course_type: courseType,
      format: schema.format || formatFor(url, `${title} ${description}`),
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${title} ${description}`),
      credits_text: credits ? `${credits} Credits` : '',
      price: schema.price,
      start_date: schema.start_date || '',
      end_date: schema.end_date || '',
      date_text: schema.start_date ? '' : (courseType === 'On-Demand Course' ? 'On-demand' : 'See course page'),
      location: schema.location || (courseType === 'Seminar' ? 'See course page' : 'Online'),
      country: 'USA',
      accreditation: 'Concord Seminars ADA CERP / AGD PACE',
      tags: ['Concord Seminars', courseType].filter(Boolean),
      metadata: {
        extracted_from: 'concord-seminars-sitemap',
        catalog_section: segmentFor(url),
      },
    });
  } catch (error) {
    console.log(`      ⚠️ Concord Seminars skipped ${url}: ${error.message}`);
    return null;
  }
}

export async function scrapeConcordSeminars() {
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
