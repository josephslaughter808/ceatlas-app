import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const CARESTREAM_PROVIDER = 'Carestream Dental Education';
const CARESTREAM_PROVIDER_SLUG = 'carestream-dental-education';
const CARESTREAM_WEBINARS_URL = 'https://www.carestreamdental.com/en-us/events/webinars-and-tradeshows/categories/upcoming-events/?Category=Webinar';
const CARESTREAM_TRADESHOWS_URL = 'https://www.carestreamdental.com/en-us/events/webinars-and-tradeshows/categories/upcoming-events/?Category=Congress_Tradeshow';
const MAX_PAGES = 5;

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
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/h4>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = CARESTREAM_WEBINARS_URL) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function parseIsoDate(text = '') {
  const parsed = new Date(cleanText(text, 80));
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function inferTopic(text = '') {
  const value = cleanText(text, 300).toLowerCase();
  if (/implant/.test(value)) return 'Implant Dentistry';
  if (/ai|efficiency|case acceptance|workflow|practice/.test(value)) return 'Practice Management & Business';
  if (/cbct|imaging|radiology|diagnosis/.test(value)) return 'Digital Dentistry & Technology';
  if (/ortho/.test(value)) return 'Orthodontics';
  return 'General Dentistry';
}

async function collectListingRows(startUrl) {
  const rows = [];
  let pageUrl = startUrl;
  let page = 0;

  while (pageUrl && page < MAX_PAGES) {
    page += 1;
    const $ = await loadHTML(pageUrl);

    $('table.data-list__table tbody tr').each((_, tr) => {
      const row = $(tr);
      const cells = row.find('td');
      const dateText = cleanText(cells.eq(0).text(), 80);
      const anchor = cells.eq(1).find('a').first();
      const title = cleanText(anchor.text(), 250);
      const url = absoluteUrl(anchor.attr('href') || '', pageUrl);
      const country = cleanText(cells.eq(2).text(), 120);
      const category = cleanText(cells.eq(3).text(), 120);
      const speakers = cleanText(cells.eq(4).text(), 250);

      if (!title || !url) return;

      rows.push({
        title,
        url,
        dateText,
        startDate: parseIsoDate(dateText),
        country,
        category,
        speakers,
      });
    });

    const nextHref = $('a.next.js-search-trigger').first().attr('href') || '';
    const nextUrl = absoluteUrl(nextHref, pageUrl);
    pageUrl = nextUrl && nextUrl !== pageUrl ? nextUrl : '';
  }

  return rows;
}

async function scrapeDetail(listing) {
  try {
    const $ = await loadHTML(listing.url);
    const description = cleanMultiline($('.custom-col-75 .py-15').eq(1).html() || '', 1800);
    const dateText = cleanText($('.date-time .date strong').first().text(), 80) || listing.dateText;
    const timeText = cleanText($('.date-time .time').first().text(), 120);
    const ctaLabel = cleanText($('.links-list a').first().text(), 80);
    const ctaUrl = absoluteUrl($('.links-list a').first().attr('href') || '', listing.url);
    const locationText = cleanText($('.custom-col-75 .py-15 h4').first().text().replace(/^Location\s*:\s*/i, ''), 160);
    const speakerNames = $('.box-heading')
      .filter((_, el) => cleanText($(el).text(), 80) === 'Speaker(s)')
      .next('.box-body')
      .find('.user-name')
      .map((__, el) => cleanText($(el).text(), 120))
      .get()
      .filter(Boolean)
      .join('\n') || listing.speakers;
    const creditsMatch = description.match(/(\d+(?:\.\d+)?)\s*CE Credit/i);
    const detailText = `${listing.title}\n${description}\n${speakerNames}`;
    const isWebinar = /webinar/i.test(listing.category);

    return normalizeCourse({
      provider: CARESTREAM_PROVIDER,
      provider_slug: CARESTREAM_PROVIDER_SLUG,
      source_url: isWebinar ? CARESTREAM_WEBINARS_URL : CARESTREAM_TRADESHOWS_URL,
      url: listing.url,
      title: listing.title,
      description,
      course_type: isWebinar ? 'Live Webinar' : 'Conference / Tradeshow',
      format: isWebinar ? 'Live Streaming' : 'In Person',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(detailText),
      credits_text: creditsMatch ? `${creditsMatch[1]} CE credits` : '',
      start_date: listing.startDate,
      date_text: [dateText, timeText].filter(Boolean).join(' • '),
      location: isWebinar ? 'Online' : locationText,
      country: listing.country,
      instructors: speakerNames,
      accreditation: 'Carestream Dental Education',
      tags: ['Carestream Dental', listing.category, inferTopic(detailText)].filter(Boolean),
      metadata: {
        extracted_from: 'carestream-launchpad',
        registration_url: ctaLabel === 'RESERVE YOUR SPOT' ? ctaUrl : null,
        external_event_url: ctaLabel && ctaLabel !== 'RESERVE YOUR SPOT' ? ctaUrl : null,
      },
    });
  } catch (error) {
    console.log(`      ⚠️ Failed to load Carestream detail ${listing.url}: ${error.message}`);
    return null;
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      const value = await mapper(items[currentIndex], currentIndex);
      if (value) results.push(value);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function scrapeCarestream() {
  console.log('   • Scraping Carestream Dental Education public catalog');

  const listings = [
    ...(await collectListingRows(CARESTREAM_WEBINARS_URL)),
    ...(await collectListingRows(CARESTREAM_TRADESHOWS_URL)),
  ];

  const seen = new Set();
  const uniqueListings = listings.filter((listing) => {
    const key = `${listing.title}||${listing.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const rows = await mapWithConcurrency(uniqueListings, 4, scrapeDetail);
  console.log(`   • Extracted ${rows.length} Carestream Dental Education rows`);
  return rows.filter(Boolean);
}
