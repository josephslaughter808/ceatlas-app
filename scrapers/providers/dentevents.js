import { normalizeCourse } from '../../lib/normalize.js';

const PROVIDER = 'DentEvents Global Dental Events';
const PROVIDER_SLUG = 'dentevents-global-dental-events';
const SITEMAP_URL = 'https://www.dentevents.com/sitemap.xml';
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';
const DETAIL_CONCURRENCY = 2;
const REQUEST_TIMEOUT_MS = 20000;
const REQUEST_DELAY_MS = 500;
const FUTURE_YEAR_PATTERN = /20(26|27|28|29|30)/;
const EXCLUDED_URL_PATTERN = /online-conference|webinar|webinars|video-tutorial|module-\d+/i;

function cleanText(value = '', max = 1800) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
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
  return [...new Set(
    [...xml.matchAll(/<loc>(.*?)<\/loc>/g)]
      .map((match) => cleanText(match[1], 500).replace(/^http:\/\//i, 'https://'))
      .filter((url) => /^https:\/\/www\.dentevents\.com\/.+\/e\d+/i.test(url))
      .filter((url) => FUTURE_YEAR_PATTERN.test(url))
      .filter((url) => !EXCLUDED_URL_PATTERN.test(url)),
  )];
}

function titleFromHtml(html = '', url = '') {
  const title = cleanText(html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1]
    || html.match(/<title>(.*?)<\/title>/is)?.[1]
    || '', 250);
  if (title) return title;

  try {
    return cleanText(new URL(url).pathname.split('/').filter(Boolean)[1]?.replace(/-/g, ' ') || '', 250);
  } catch {
    return '';
  }
}

function isoFromSlashDate(value = '') {
  const match = cleanText(value, 40).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';
  const [, month, day, year] = match;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDates(text = '') {
  const calendarMatch = text.match(/Add to Calendar\s+(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}\s+(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}/i);
  if (calendarMatch) {
    return {
      start_date: isoFromSlashDate(calendarMatch[1]),
      end_date: isoFromSlashDate(calendarMatch[2]),
    };
  }

  const fromToMatch = text.match(/From:\s+.*?([A-Za-z]+,\s+\d{1,2}\s+[A-Za-z]+,\s+20\d{2})\s+To:\s+.*?([A-Za-z]+,\s+\d{1,2}\s+[A-Za-z]+,\s+20\d{2})/i);
  if (fromToMatch) {
    const start = new Date(fromToMatch[1]);
    const end = new Date(fromToMatch[2]);
    return {
      start_date: Number.isNaN(start.getTime()) ? '' : start.toISOString().slice(0, 10),
      end_date: Number.isNaN(end.getTime()) ? '' : end.toISOString().slice(0, 10),
    };
  }

  return { start_date: '', end_date: '' };
}

function parseLocation(text = '') {
  const match = text.match(/\b([A-Z][A-Za-z .'-]+,\s+(?:USA|UNITED STATES|AUSTRALIA|CANADA|CHINA|INDIA|ITALY|SPAIN|FRANCE|GERMANY|TURKEY|SWEDEN|IRELAND|NEW ZEALAND|UNITED ARAB EMIRATES|RUSSIA|KOREA SOUTH|CZECH REPUBLIC|HUNGARY|SWITZERLAND|BELGIUM|POLAND|TANZANIA|BRAZIL|COLOMBIA|KAZAKHSTAN|MALAYSIA|SINGAPORE))\b/i);
  return cleanText(match?.[1] || '', 180);
}

function countryFromUrl(url = '') {
  try {
    const segment = new URL(url).pathname.split('/').filter(Boolean)[0] || '';
    return cleanText(segment.replace(/-/g, ' '), 80).replace(/\b\w/g, (char) => char.toUpperCase());
  } catch {
    return '';
  }
}

function inferTopic(title = '') {
  const value = title.toLowerCase();
  if (/implant|osseointegration|icoi|iti|osseointegration/.test(value)) return 'Implants';
  if (/orthodont|aao|eos|cao|apoc|neso|sao/.test(value)) return 'Orthodontics';
  if (/periodont|perio|aap-|sfpio/.test(value)) return 'Periodontics';
  if (/endodont/.test(value)) return 'Endodontics';
  if (/hygiene|isdh/.test(value)) return 'Dental Hygiene';
  if (/oral|maxillo|cranio|surgery/.test(value)) return 'Oral Surgery';
  if (/digital|cad|cam|technology|ai/.test(value)) return 'Digital Dentistry & Technology';
  if (/phone|business|practice|lead|ownership|appointment/.test(value)) return 'Practice Management & Business';
  if (/infection/.test(value)) return 'Infection Control';
  return 'Dental Conference';
}

async function fetchText(url, accept = 'text/html,application/xhtml+xml,*/*;q=0.8') {
  await new Promise((resolve) => {
    setTimeout(resolve, REQUEST_DELAY_MS);
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: accept,
        'User-Agent': BROWSER_USER_AGENT,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`DentEvents returned ${response.status} for ${url}`);
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
    const text = cleanText(html, 6000);
    const title = titleFromHtml(html, url);
    if (!title) return null;

    const dates = parseDates(text);
    const location = parseLocation(text) || countryFromUrl(url);
    const description = cleanText(
      html.match(/<meta name="description" content="([^"]+)"/i)?.[1]
      || html.match(/<meta property="og:description" content="([^"]+)"/i)?.[1]
      || `${title} is listed in the DentEvents global dental events calendar.`,
      1800,
    );

    return normalizeCourse({
      provider: PROVIDER,
      provider_slug: PROVIDER_SLUG,
      source_url: SITEMAP_URL,
      url,
      title,
      description,
      course_type: 'Dental Conference / Event',
      format: 'In Person',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(title),
      price: '',
      credits_text: '',
      ...dates,
      date_text: dates.start_date ? '' : 'See event page',
      location,
      country: countryFromUrl(url),
      accreditation: 'DentEvents',
      tags: ['In Person', 'Conference', 'DentEvents', inferTopic(title)].filter(Boolean),
      metadata: {
        extracted_from: 'dentevents-sitemap-future-events',
      },
    });
  } catch (error) {
    console.log(`      ⚠️ DentEvents skipped ${url}: ${error.message}`);
    return null;
  }
}

export async function scrapeDentEventsFutureInPerson() {
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
