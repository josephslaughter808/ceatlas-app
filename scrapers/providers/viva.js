import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';
import * as cheerio from 'cheerio';

const VIVA_PROVIDER = 'Viva Learning';
const VIVA_PROVIDER_SLUG = 'viva-learning';
const VIVA_SOURCE_URL = 'https://ce.edu.dental/online-dental-ce/viva-learning/';
const VIVA_DIRECT_ON_DEMAND_URL = 'https://www.vivalearning.com/member/on-demand-dental-ce-webinars.asp';
const VIVA_DIRECT_BASE_URL = 'https://www.vivalearning.com';
const VIVA_DIRECT_PAGE_COUNT = 57;
const VIVA_BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

function cleanText(value = '', max = 500) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function toDateString(value = '') {
  const text = cleanText(value, 40);
  if (!text) return '';

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function toCenturyIsoDate(value = '') {
  const match = cleanText(value, 40).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return '';
  const [, month, day, rawYear] = match;
  const numericYear = Number(rawYear);
  const year = rawYear.length === 2 ? 2000 + numericYear : numericYear;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function inferTopic(title = '') {
  const text = cleanText(title, 250).toLowerCase();
  if (!text) return '';
  if (/implant|full arch|socket preservation/.test(text)) return 'Implant Dentistry';
  if (/endo|endodontic/.test(text)) return 'Endodontics';
  if (/aligner|orthodontic|orthodont/.test(text)) return 'Orthodontics';
  if (/sleep/.test(text)) return 'Sleep & Airway';
  if (/esthetic|aesthetic|resin|restoration|zirconia|composite/.test(text)) return 'Restorative Dentistry';
  if (/osha|infection control/.test(text)) return 'Hygiene & Preventive Care';
  if (/billing|benefit|marketing|practice/.test(text)) return 'Practice Management & Business';
  if (/hygiene|oral health/.test(text)) return 'Hygiene & Preventive Care';
  if (/digital|workflow|photography|imaging/.test(text)) return 'Digital Dentistry & Technology';
  return 'General Dentistry';
}

function rowCells($, row) {
  return $(row)
    .find('th, td')
    .map((_, cell) => cleanText($(cell).text(), 250))
    .get();
}

function absoluteUrl(value = '', baseUrl = VIVA_DIRECT_BASE_URL) {
  if (!value) return '';
  try {
    const url = new URL(value, baseUrl);
    url.searchParams.delete('x_source');
    return url.href;
  } catch {
    return '';
  }
}

function extractDirectField(text, label) {
  const labels = [
    'Presenter:',
    'CE Supporter:',
    'Release Date:',
    'Reviewed:',
    'Expiration Date:',
    'CE Credits:',
    'View Full Description',
  ];
  const labelPattern = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nextLabels = labels
    .filter((candidate) => candidate !== label)
    .map((candidate) => candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const match = text.match(new RegExp(`${labelPattern}\\s*(.*?)(?=\\s*(?:${nextLabels})|$)`, 'i'));
  return cleanText(match?.[1] || '', 500);
}

function cleanDirectTitle(text = '') {
  const value = cleanText(text, 500);
  return cleanText(value.split(/\s+Presenter:\s+/i)[0] || value, 250);
}

function parseDirectRows($, pageUrl) {
  const rows = [];

  $('td.bdy').each((_, cell) => {
    const cellText = cleanText($(cell).text(), 2000);
    if (!/Presenter:|Expiration Date:|CE Credits:/i.test(cellText)) return;

    const title = cleanDirectTitle(cellText);
    const detailLink = $(cell).find('a[href*="/on-demand-dental-ce-course/"]').first().attr('href') || '';
    const url = absoluteUrl(detailLink, pageUrl);
    if (!title || !url) return;

    const presenter = extractDirectField(cellText, 'Presenter:');
    const supporter = extractDirectField(cellText, 'CE Supporter:');
    const releaseText = extractDirectField(cellText, 'Release Date:');
    const reviewed = extractDirectField(cellText, 'Reviewed:');
    const expirationText = extractDirectField(cellText, 'Expiration Date:');
    const creditsText = extractDirectField(cellText, 'CE Credits:');
    const topic = inferTopic(`${title} ${supporter}`);

    rows.push(normalizeCourse({
      provider: VIVA_PROVIDER,
      provider_slug: VIVA_PROVIDER_SLUG,
      source_url: pageUrl,
      url,
      title,
      description: `${title} is an on-demand dental CE webinar listed in the Viva Learning public catalog.${supporter ? ` CE supporter: ${supporter}.` : ''}`,
      course_type: 'On-Demand Webinar',
      format: 'Online',
      audience: 'Dentists and Dental Team',
      topic,
      credits_text: creditsText,
      price: 'Free',
      start_date: toCenturyIsoDate(releaseText),
      end_date: toCenturyIsoDate(expirationText),
      date_text: [
        releaseText ? `Release Date: ${releaseText}` : '',
        reviewed ? `Reviewed: ${reviewed}` : '',
        expirationText ? `Expiration Date: ${expirationText}` : '',
      ].filter(Boolean).join(' • '),
      location: 'Online',
      country: 'USA',
      instructors: presenter,
      accreditation: 'Viva Learning',
      tags: ['Viva Learning', 'Online', 'On Demand', supporter, topic].filter(Boolean),
      metadata: {
        extracted_from: 'viva-learning-direct-on-demand',
        ce_supporter: supporter || null,
        release_date: releaseText || null,
        reviewed: reviewed || null,
        expiration_date: expirationText || null,
      },
    }));
  });

  return rows;
}

async function loadDirectHTML(pageUrl) {
  const response = await fetch(pageUrl, {
    headers: {
      'User-Agent': VIVA_BROWSER_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Viva Learning returned ${response.status} for ${pageUrl}`);
  }

  return response.text();
}

export async function scrapeViva(startUrl = VIVA_SOURCE_URL) {
  console.log('   • Scraping Viva Learning public catalog');

  const $ = await loadHTML(startUrl);
  const tables = $('table').toArray();
  if (tables.length < 2) {
    console.log('   • Viva Learning tables not found');
    return [];
  }

  const results = [];

  $(tables[0]).find('tr').slice(1).each((index, row) => {
    const [dateText, title, price, creditsText] = rowCells($, row);
    if (!title) return;

    results.push(normalizeCourse({
      provider: VIVA_PROVIDER,
      provider_slug: VIVA_PROVIDER_SLUG,
      source_url: startUrl,
      url: `${startUrl}#live-${index + 1}`,
      title,
      description: 'Live interactive dental CE webinar listed on the Viva Learning public course catalog.',
      course_type: 'Live Webinar',
      format: 'Online',
      topic: inferTopic(title),
      credits_text: creditsText,
      price: price || 'Free',
      start_date: toDateString(dateText),
      end_date: toDateString(dateText),
      date_text: dateText,
      country: 'USA',
      accreditation: 'Viva Learning',
      tags: ['Viva Learning', 'Online', 'Live Webinar', inferTopic(title)].filter(Boolean),
      metadata: {
        extracted_from: 'viva-learning-table',
        table: 'live',
        row_index: index + 1,
      },
    }));
  });

  $(tables[1]).find('tr').slice(1).each((index, row) => {
    const [title, releaseDate, creditsText] = rowCells($, row);
    if (!title) return;

    results.push(normalizeCourse({
      provider: VIVA_PROVIDER,
      provider_slug: VIVA_PROVIDER_SLUG,
      source_url: startUrl,
      url: `${startUrl}#ondemand-${index + 1}`,
      title,
      description: 'On-demand dental CE webinar listed on the Viva Learning public course catalog.',
      course_type: 'On-Demand Webinar',
      format: 'Online',
      topic: inferTopic(title),
      credits_text: creditsText,
      price: 'Free',
      start_date: toDateString(releaseDate),
      end_date: toDateString(releaseDate),
      date_text: releaseDate,
      country: 'USA',
      accreditation: 'Viva Learning',
      tags: ['Viva Learning', 'Online', 'On Demand', inferTopic(title)].filter(Boolean),
      metadata: {
        extracted_from: 'viva-learning-table',
        table: 'on-demand',
        row_index: index + 1,
      },
    }));
  });

  console.log(`   • Extracted ${results.length} Viva Learning courses`);
  return results;
}

export async function scrapeVivaDirectOnDemand() {
  console.log('   • Scraping Viva Learning direct on-demand catalog');

  const rows = [];
  const seenUrls = new Set();

  for (let page = 1; page <= VIVA_DIRECT_PAGE_COUNT; page += 1) {
    const pageUrl = `${VIVA_DIRECT_ON_DEMAND_URL}?x_page=${page}&x_action=search&x_query=&x_companyID=&x_catID=&x_ceonly=`;
    try {
      const html = await loadDirectHTML(pageUrl);
      const $ = cheerio.load(html);
      const pageRows = parseDirectRows($, pageUrl);

      for (const row of pageRows) {
        if (!row.url || seenUrls.has(row.url)) continue;
        seenUrls.add(row.url);
        rows.push(row);
      }
    } catch (error) {
      console.log(`      ⚠️ Failed to load Viva Learning page ${page}: ${error.message}`);
    }
  }

  console.log(`   • Extracted ${rows.length} Viva Learning direct on-demand courses before current/future filtering`);
  return rows;
}
