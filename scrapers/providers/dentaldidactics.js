import * as cheerio from 'cheerio';
import { normalizeCourse } from '../../lib/normalize.js';

const PROVIDER = 'Dental Didactics CE';
const PROVIDER_SLUG = 'dental-didactics-ce';
const SOURCE_URL = 'https://www.dentaldidacticsce.com/ce-courses/';
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';
const MAX_PAGES = 4;
const DETAIL_CONCURRENCY = 8;

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

function extractProductLinks(html = '') {
  return [...new Set(
    [...html.matchAll(/href="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((href) => /^https:\/\/www\.dentaldidacticsce\.com\/(?!ce-courses|california|dental-online|dental-continuing|contact|agd|blog|cart|login|account)[^?#]+\/$/i.test(href)),
  )];
}

function titleFromUrl(url = '') {
  try {
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
    return cleanText(slug.replace(/-\d+-hours?$/i, '').replace(/-/g, ' '), 250)
      .replace(/\b\w/g, (char) => char.toUpperCase());
  } catch {
    return '';
  }
}

function creditsFrom(text = '', url = '') {
  const value = `${text} ${url}`;
  return cleanText(value.match(/\b(\d+(?:\.\d+)?)\s*(?:hours?|units?|credits?)\b/i)?.[1] || '', 40);
}

function inferTopic(text = '') {
  const value = cleanText(text, 1600).toLowerCase();
  if (/implant|extraction|prf/.test(value)) return 'Implants';
  if (/endodont|root canal|mta/.test(value)) return 'Endodontics';
  if (/periodont|gum|plaque/.test(value)) return 'Periodontics';
  if (/infection|osha|hepatitis|waterline|antimicrobial|bacteria/.test(value)) return 'Infection Control';
  if (/law|ethics|practice act|hipaa/.test(value)) return 'Ethics & Jurisprudence';
  if (/opioid|antibiotic|anesthetic|septocaine|medication|pharmac/.test(value)) return 'Pharmacology';
  if (/sleep apnea|airway/.test(value)) return 'Sleep & Airway';
  if (/laser|ceramic|crown|whitening|bleaching|restorative/.test(value)) return 'Restorative Dentistry';
  if (/oral herpes|gerd|alzheim|angina|breast cancer|anorexia|bulimia/.test(value)) return 'Oral Medicine';
  return 'General Dentistry';
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      'User-Agent': BROWSER_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Dental Didactics returned ${response.status} for ${url}`);
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
      $('meta[property="og:title"]').attr('content')?.replace(/\s*-\s*Dental Didactics CE$/i, '')
      || $('.productView-title').first().text()
      || $('h1').first().text()
      || titleFromUrl(url),
      250,
    );
    if (!title) return null;

    const description = cleanText(
      $('meta[property="og:description"]').attr('content')
      || $('meta[name="description"]').attr('content')
      || $('.productView-description').first().text()
      || `${title} is listed in Dental Didactics CE's public online course catalog.`,
      1800,
    );
    const price = cleanText($('.price--withoutTax, .price').first().text(), 80) || 'Paid registration';
    const credits = creditsFrom(`${title} ${description}`, url);

    return normalizeCourse({
      provider: PROVIDER,
      provider_slug: PROVIDER_SLUG,
      source_url: SOURCE_URL,
      url,
      title,
      description,
      course_type: 'Online Self-Study Course',
      format: 'Online',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${title} ${description}`),
      credits_text: credits ? `${credits} Credits` : '',
      price,
      date_text: 'Online self-study',
      location: 'Online',
      country: 'USA',
      accreditation: 'Dental Board of California Registered CE Provider / AGD PACE',
      tags: ['Dental Didactics CE', 'Online'].filter(Boolean),
      metadata: {
        extracted_from: 'dental-didactics-ce-category-products',
      },
    });
  } catch (error) {
    console.log(`      ⚠️ Dental Didactics skipped ${url}: ${error.message}`);
    return null;
  }
}

export async function scrapeDentalDidactics() {
  console.log(`   • Scraping ${PROVIDER}`);
  const links = new Set();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const pageUrl = page === 1 ? SOURCE_URL : `${SOURCE_URL}?page=${page}`;
    const html = await fetchText(pageUrl);
    for (const link of extractProductLinks(html)) links.add(link);
  }

  const rows = await mapWithConcurrency([...links], DETAIL_CONCURRENCY, scrapeDetail);
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
