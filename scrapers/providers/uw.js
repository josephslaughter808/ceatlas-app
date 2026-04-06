import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const UW_PROVIDER = 'University of Washington Dental CE';
const UW_PROVIDER_SLUG = 'university-of-washington-dental-ce';
const UW_SOURCE_URL = 'https://dental.washington.edu/continuing-dental-education/';
const UW_ONLINE_URL = 'https://dental.washington.edu/continuing-dental-education/online-courses/';

function cleanText(value = '', max = 1600) {
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
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = UW_SOURCE_URL) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function inferTopic(text = '') {
  const value = cleanText(text, 500).toLowerCase();
  if (/sedation|anxiolysis/.test(value)) return 'Anesthesia & Sedation';
  if (/opioid|therapeutics|mate|medication/.test(value)) return 'Pharmacology';
  if (/periodontal|implant/.test(value)) return 'Periodontics';
  if (/sleep/.test(value)) return 'Sleep & Airway';
  if (/tmd/.test(value)) return 'TMD & Orofacial Pain';
  if (/bloodborne|infection/.test(value)) return 'Infection Control';
  if (/fluoride|pediatric/.test(value)) return 'Pediatric Dentistry';
  if (/restorative|treatment planning/.test(value)) return 'Restorative Dentistry';
  return 'General Dentistry';
}

function inferFormat(text = '') {
  const value = cleanText(text, 400).toLowerCase();
  if (/travel/.test(value)) return 'Travel';
  if (/online|recorded|self-study|on-demand|webinar/.test(value)) return 'Online';
  return 'In Person';
}

function inferCourseType(text = '') {
  const value = cleanText(text, 400).toLowerCase();
  if (/travel/.test(value)) return 'Travel Course';
  if (/certificate/.test(value)) return 'Certificate Program';
  if (/hands-on/.test(value)) return 'Hands-On Course';
  if (/webinar|online|recorded|self-study/.test(value)) return 'Online Course';
  return 'Live Course';
}

function extractPrice(text = '') {
  const match = text.match(/(?:Course Fee|Tuition):\s*([^\n]+)/i);
  return match ? cleanText(match[1], 120) : '';
}

function extractCredits(text = '') {
  const activityMatch = text.match(/designates this activity for\s*([\d.]+)\s*continuing education credits?/i);
  if (activityMatch) return activityMatch[1];

  const hoursMatch = text.match(/([\d.]+)\s*credit hours?/i);
  if (hoursMatch) return hoursMatch[1];

  return '';
}

function extractInstructors($) {
  const heading = $('h2, h3').filter((_, el) => /instructors?/i.test($(el).text())).first();
  if (!heading.length) return '';

  const parts = [];
  let node = heading.next();
  while (node.length && !/^h[23]$/i.test(node[0].tagName || '')) {
    const text = cleanText(node.text(), 250);
    if (text && !/content subject to change|policies|ada cerp/i.test(text)) {
      parts.push(text);
    }
    node = node.next();
  }

  return parts.join('\n');
}

function extractDescription($) {
  const parts = [];

  $('.entry-content > p').each((_, p) => {
    const text = cleanText($(p).text(), 400);
    if (!text) return;
    if (/register for courses|ada cerp|policies|tuition:/i.test(text)) return;
    parts.push(text);
  });

  return parts.slice(0, 4).join(' ').slice(0, 1800);
}

function collectUwListings($, sourceUrl, listingMap) {
  $('a[href*="/condented/"]').each((_, link) => {
    const anchor = $(link);
    const url = absoluteUrl(anchor.attr('href') || '', sourceUrl);
    const title = cleanText(anchor.text(), 250);
    if (!url || !title) return;

    const row = anchor.closest('tr');
    const listItem = anchor.closest('li');

    const listingText = row.length
      ? cleanText(row.text(), 600)
      : listItem.length
        ? cleanText(listItem.text(), 600)
        : title;

    const dateText = row.length
      ? cleanText(row.find('td').first().text(), 160)
      : '';

    listingMap.set(url, {
      title,
      dateText,
      listingText,
    });
  });
}

export async function scrapeUW() {
  console.log('   • Scraping University of Washington Dental CE');

  const listingMap = new Map();
  const [mainPage, onlinePage] = await Promise.all([
    loadHTML(UW_SOURCE_URL),
    loadHTML(UW_ONLINE_URL),
  ]);

  collectUwListings(mainPage, UW_SOURCE_URL, listingMap);
  collectUwListings(onlinePage, UW_ONLINE_URL, listingMap);

  const rows = [];

  for (const [url, listing] of listingMap.entries()) {
    const $ = await loadHTML(url);
    const title = cleanText($('h1.entry-title').first().text() || listing.title, 250);
    const bodyHtml = $('.entry-content').html() || '';
    const bodyText = cleanMultiline(bodyHtml, 4000);
    const description = extractDescription($) || cleanText(bodyText, 1800);
    const instructors = extractInstructors($);
    const price = extractPrice(bodyText);
    const credits = extractCredits(bodyText);
    const format = inferFormat(`${title} ${listing.listingText} ${bodyText}`);
    const courseType = inferCourseType(`${title} ${listing.listingText}`);
    const location = format === 'Online'
      ? 'Online'
      : format === 'Travel'
        ? 'Travel destination'
        : 'University of Washington School of Dentistry';

    rows.push(normalizeCourse({
      provider: UW_PROVIDER,
      provider_slug: UW_PROVIDER_SLUG,
      source_url: UW_SOURCE_URL,
      url,
      title,
      description,
      course_type: courseType,
      format,
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${title} ${description}`),
      credits,
      credits_text: credits ? `${credits} credits` : '',
      price,
      date_text: listing.dateText || '',
      location,
      city: format === 'Travel' ? '' : 'Seattle',
      state: format === 'Travel' ? '' : 'WA',
      country: 'USA',
      instructors,
      accreditation: 'University of Washington Continuing Dental Education',
      tags: ['UW', inferTopic(title), format].filter(Boolean),
      metadata: {
        extracted_from: 'uw-continuing-dental-education-pages',
        listing_text: listing.listingText,
      },
    }));
  }

  console.log(`   • Extracted ${rows.length} University of Washington Dental CE rows`);
  return rows;
}
