import * as cheerio from 'cheerio';
import { normalizeCourse } from '../../lib/normalize.js';

const PROVIDER = 'Dental Learning';
const PROVIDER_SLUG = 'dental-learning';
const SOURCE_URL = 'https://www.dentallearning.net/sitemap.xml';
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';
const DETAIL_CONCURRENCY = 8;

function cleanText(value = '', max = 1600) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function meta($, name) {
  return cleanText(
    $(`meta[name="${name}"]`).attr('content')
      || $(`meta[property="${name}"]`).attr('content')
      || '',
    800,
  );
}

function extractCourseUrls(xml = '') {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)]
    .map((match) => match[1])
    .filter((url) => /^https:\/\/www\.dentallearning\.net\/course\//.test(url));
}

function parseJsonLd($) {
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    try {
      const json = JSON.parse($(script).text());
      if (json?.['@type'] === 'Course') return json;
    } catch {
      // Ignore invalid structured data snippets.
    }
  }
  return {};
}

function parseRscCourseObject(html = '') {
  const match = html.match(/\\"course_id\\":\d+.*?\\"url_title\\":\\"[^"]+\\"/s);
  if (!match) return {};

  const fragment = match[0]
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n');

  const cost = fragment.match(/"cost":(-?\d+(?:\.\d+)?|null)/)?.[1];
  const agdCredits = fragment.match(/"agd_credits":"([^"]*)"/)?.[1] || '';
  const adaCredits = fragment.match(/"ada_credits":"([^"]*)"/)?.[1] || '';
  const courseType = fragment.match(/"CourseType":\{"course_type_id":\d+,"name":"([^"]*)"/)?.[1] || '';

  return {
    cost: cost && cost !== 'null' ? Number(cost) : null,
    agdCredits,
    adaCredits,
    courseType,
  };
}

function inferTopic(text = '') {
  const value = cleanText(text, 1000).toLowerCase();
  if (/implant/.test(value)) return 'Implants';
  if (/endodont|root canal/.test(value)) return 'Endodontics';
  if (/orthodont|aligner/.test(value)) return 'Orthodontics';
  if (/periodont|gingiv/.test(value)) return 'Periodontics';
  if (/sleep|airway/.test(value)) return 'Sleep & Airway';
  if (/infection|osha|compliance/.test(value)) return 'Infection Control';
  if (/radiograph|imaging|digital|cad|cam|3d/.test(value)) return 'Digital Dentistry & Technology';
  if (/practice|business|marketing|billing|coding/.test(value)) return 'Practice Management & Business';
  if (/hygien|prevent|public health/.test(value)) return 'Dental Hygiene';
  if (/esthetic|aesthetic|restor|composite|veneer|crown/.test(value)) return 'Restorative Dentistry';
  if (/anesthesia|sedation|emergency|opioid|pharmac/.test(value)) return 'Anesthesia, Sedation & Emergencies';
  return 'General Dentistry';
}

function textAfter($, label) {
  const pageText = cleanText($('body').text(), 30000);
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = pageText.match(new RegExp(`${escaped}:\\s*(.*?)(?=\\s*(?:Categories|Author\\(s\\)|CE Supporter|Target Audience|AGD Credits):|$)`, 'i'));
  return cleanText(match?.[1] || '', 600);
}

async function fetchHTML(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': BROWSER_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Dental Learning returned ${response.status} for ${url}`);
  }

  return response.text();
}

async function fetchXML(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/xml,text/xml,*/*;q=0.8',
      'User-Agent': BROWSER_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Dental Learning sitemap returned ${response.status}`);
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

async function scrapeCourse(url) {
  try {
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);
    const jsonLd = parseJsonLd($);
    const rsc = parseRscCourseObject(html);
    const rawTitle = jsonLd.name || meta($, 'og:title') || $('h1').first().text();
    const title = cleanText(String(rawTitle).replace(/\s*\|\s*Dental Learning$/i, ''), 250);
    if (!title) return null;

    const categories = textAfter($, 'Categories');
    const supporter = textAfter($, 'CE Supporter');
    const audience = textAfter($, 'Target Audience');
    const authors = jsonLd.author?.map?.((author) => author.name).filter(Boolean).join('\n') || meta($, 'author');
    const credits = rsc.agdCredits || rsc.adaCredits || textAfter($, 'AGD Credits');
    const price = rsc.cost === 0 ? 'Free' : (typeof rsc.cost === 'number' ? `$${rsc.cost}` : '');
    const description = cleanText(jsonLd.description || meta($, 'description') || title, 1800);
    const topic = inferTopic(`${title} ${categories} ${description}`);

    return normalizeCourse({
      provider: PROVIDER,
      provider_slug: PROVIDER_SLUG,
      source_url: SOURCE_URL,
      url,
      title,
      description,
      course_type: rsc.courseType || 'Self-instruction web based activity',
      format: 'Online',
      audience: audience || 'Dentists and Dental Team',
      topic,
      credits_text: credits ? `${credits} Credits` : '',
      price,
      location: 'Online',
      country: 'USA',
      instructors: authors,
      accreditation: 'Dental Learning ADA CERP / AGD PACE listed provider',
      tags: ['Dental Learning', 'Online', categories, supporter, topic].filter(Boolean),
      metadata: {
        extracted_from: 'dental-learning-sitemap-course-detail',
        categories: categories || null,
        ce_supporter: supporter || null,
        date_published: jsonLd.datePublished || null,
      },
    });
  } catch (error) {
    console.log(`      ⚠️ Dental Learning skipped ${url}: ${error.message}`);
    return null;
  }
}

export async function scrapeDentalLearning() {
  console.log(`   • Scraping ${PROVIDER}`);
  const xml = await fetchXML(SOURCE_URL);
  const courseUrls = extractCourseUrls(xml);
  const rows = await mapWithConcurrency(courseUrls, DETAIL_CONCURRENCY, scrapeCourse);
  const deduped = [];
  const seen = new Set();

  for (const row of rows.filter(Boolean)) {
    const key = row.url || `${row.title}::${row.provider}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  console.log(`   • Extracted ${deduped.length} ${PROVIDER} rows`);
  return deduped;
}
