import * as cheerio from 'cheerio';
import { normalizeCourse } from '../../lib/normalize.js';

const PROVIDER = 'AchieveCE Dental';
const PROVIDER_SLUG = 'achievece-dental';
const BASE_URL = 'https://achievece.com';
const SITEMAPS = [
  'https://achievece.com/courses/sitemap.xml',
  'https://achievece.com/webinars/sitemap.xml',
];
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

const DENTAL_AUDIENCE_PATTERN = /\b(dentist|general dentist|dental hygienist|dental assistant|registered dental assistant|expanded function dental|dental therapist|dental technician|dental lab|denturist|community dental health coordinator|dental assistant radiographer)\b/i;
const DENTAL_TOPIC_PATTERN = /\b(dental|dentistry|oral|mouth|mucosal|teeth|tooth|endodont|periodont|orthodont|implant|caries|radiograph|x-?ray|occlusion|denture)\b/i;

function cleanText(value = '', max = 1800) {
  return String(value)
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

function absoluteUrl(value = '', baseUrl = BASE_URL) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`AchieveCE returned ${response.status} for ${url}`);
  }

  return response.text();
}

function extractSitemapUrls(xml = '') {
  return [...String(xml).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => cleanText(match[1], 500))
    .filter((url) => /^https:\/\/achievece\.com\/(?:courses|webinars)\//i.test(url));
}

async function collectDetailUrls() {
  const urls = new Set();

  for (const sitemapUrl of SITEMAPS) {
    const xml = await fetchText(sitemapUrl);
    for (const url of extractSitemapUrls(xml)) {
      urls.add(url);
    }
  }

  return [...urls].sort();
}

function meta($, selector) {
  return cleanText($(`meta[${selector}]`).attr('content') || '', 2000);
}

function parseHours($, html = '') {
  const imageAlt = [
    meta($, 'property="og:image:alt"'),
    meta($, 'name="twitter:image:alt"'),
  ].join(' ');
  const altMatch = imageAlt.match(/\b(\d+(?:\.\d+)?)\s*(?:contact\s*)?hours?\b/i);
  if (altMatch) return Number(altMatch[1]);

  const durationMatch = html.match(/"productDuration":\s*(\d+(?:\.\d+)?)/);
  if (durationMatch) {
    const minutes = Number(durationMatch[1]);
    if (Number.isFinite(minutes) && minutes > 0) {
      return Math.round((minutes / 60) * 100) / 100;
    }
  }

  const summaryMatch = meta($, 'name="ai-summary"').match(/Duration:\s*(\d+(?:\.\d+)?)\s*hours?/i);
  if (summaryMatch) {
    const value = Number(summaryMatch[1]);
    // AchieveCE's AI summary appears to expose minutes as "hours" on some pages.
    if (Number.isFinite(value) && value > 12) return Math.round((value / 60) * 100) / 100;
    return value;
  }

  return null;
}

function parsePrice(html = '') {
  const match = html.match(/"productPrice":\s*(\d+(?:\.\d+)?)/);
  if (!match) return '';
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return '';
  return amount === 0 ? 'Free' : `$${amount}`;
}

function parseTopic(text = '') {
  const value = cleanText(text, 2000).toLowerCase();
  if (/implant/.test(value)) return 'Implants';
  if (/endo/.test(value)) return 'Endodontics';
  if (/orthodont/.test(value)) return 'Orthodontics';
  if (/periodont|gum/.test(value)) return 'Periodontics';
  if (/oral surgery|surgical/.test(value)) return 'Oral Surgery';
  if (/infection control|osha|bloodborne/.test(value)) return 'Infection Control';
  if (/ethics|law|jurisprudence|legal/.test(value)) return 'Ethics & Jurisprudence';
  if (/opioid|controlled substance|pharmac|medication|anticoag/.test(value)) return 'Pharmacology';
  if (/radiograph|x-?ray|imaging|digital|3-?d|ai diagnostics|workflow/.test(value)) return 'Digital Dentistry & Technology';
  if (/pregnan|pediatric|children/.test(value)) return 'Pediatric Dentistry';
  if (/geriatric|older adult/.test(value)) return 'Geriatric Dentistry';
  if (/hygien|oral health|caries|tobacco|mucosal|mouth/.test(value)) return 'Dental Hygiene';
  if (/emergenc|medical error/.test(value)) return 'Medical Emergencies';
  if (/practice|harassment|equitable|affirming/.test(value)) return 'Practice Management & Business';
  return 'General Dentistry';
}

function parseProfessions(text = '') {
  const summary = cleanText(text, 3000);
  const match = summary.match(/Professions:\s*(.*?)(?:\.\s*Topics:|\. Provider:|$)/i);
  if (!match) return '';
  return cleanText(match[1], 500);
}

function parseTopics(text = '') {
  const summary = cleanText(text, 3000);
  const match = summary.match(/Topics:\s*(.*?)(?:\.\s*Provider:|$)/i);
  if (!match) return '';
  return cleanText(match[1], 500);
}

function parseSlugDate(url = '') {
  const value = cleanText(url, 600);
  const isoMatch = value.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const verboseMatch = value.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)-(\d{1,2})-(20\d{2})\b/i);
  if (!verboseMatch) return '';

  const monthIndex = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ].indexOf(verboseMatch[1].toLowerCase());
  if (monthIndex < 0) return '';

  return `${verboseMatch[3]}-${String(monthIndex + 1).padStart(2, '0')}-${String(verboseMatch[2]).padStart(2, '0')}`;
}

function isDentalRelevant(url, text) {
  return DENTAL_AUDIENCE_PATTERN.test(text) || DENTAL_TOPIC_PATTERN.test(url);
}

async function scrapeDetail(url) {
  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const title = cleanText(
    meta($, 'property="og:title"').replace(/\s*\|\s*(?:Continuing Education Course\s*)?AchieveCE.*$/i, '')
      || $('h1').first().text()
      || $('title').first().text().replace(/\s*\|\s*AchieveCE.*$/i, ''),
    250,
  );
  const description = meta($, 'name="description"') || meta($, 'property="og:description"');
  const keywords = meta($, 'name="keywords"');
  const aiSummary = meta($, 'name="ai-summary"');
  const chatgptDescription = meta($, 'name="chatgpt-description"');
  const relevanceText = `${url} ${title} ${description} ${keywords} ${aiSummary} ${chatgptDescription}`;

  if (!title || !isDentalRelevant(url, relevanceText)) return null;

  const hours = parseHours($, html);
  const price = parsePrice(html);
  const professionText = parseProfessions(aiSummary || chatgptDescription);
  const topicText = parseTopics(aiSummary || keywords);
  const isWebinar = /\/webinars\//i.test(url);
  const isLiveWebinar = isWebinar && /live-webinar/i.test(url);
  const startDate = isLiveWebinar ? parseSlugDate(url) : '';

  return normalizeCourse({
    provider: PROVIDER,
    provider_slug: PROVIDER_SLUG,
    source_url: isWebinar ? SITEMAPS[1] : SITEMAPS[0],
    url: absoluteUrl(url),
    title,
    description: description || `${title} is listed in AchieveCE's public dental continuing education catalog.`,
    course_type: isLiveWebinar ? 'Live Webinar' : 'Online Course',
    format: 'Online',
    audience: professionText || 'Dentists and Dental Team',
    topic: parseTopic(`${topicText} ${title} ${description} ${keywords}`),
    credits: hours || '',
    credits_text: hours ? `${hours} credits` : '',
    price,
    start_date: startDate,
    end_date: startDate,
    date_text: startDate ? `Live webinar date: ${startDate}` : 'Self-paced online course',
    location: 'Online',
    country: 'USA',
    accreditation: 'AchieveCE',
    tags: [
      'AchieveCE',
      'Online',
      isLiveWebinar ? 'Live Webinar' : 'Self-Paced',
      topicText,
    ].filter(Boolean),
    metadata: {
      extracted_from: isWebinar ? 'achievece-webinars-sitemap' : 'achievece-courses-sitemap',
      professions: professionText || null,
      topics: topicText || null,
    },
  });
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function scrapeAchieveCE() {
  console.log(`   • Scraping ${PROVIDER}`);
  const urls = await collectDetailUrls();
  const rows = await mapWithConcurrency(urls, 8, async (url) => {
    try {
      return await scrapeDetail(url);
    } catch (error) {
      console.warn(`      ⚠️ Failed to load AchieveCE course ${url}: ${error.message}`);
      return null;
    }
  });

  const deduped = [];
  const seen = new Set();

  for (const row of rows) {
    if (!row?.title || !row.url) continue;
    const key = `${row.title}::${row.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  console.log(`   • Extracted ${deduped.length} ${PROVIDER} rows from ${urls.length} AchieveCE pages`);
  return deduped;
}
