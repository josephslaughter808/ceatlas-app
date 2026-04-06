import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as cheerio from 'cheerio';
import { normalizeCourse } from '../../lib/normalize.js';

const execFileAsync = promisify(execFile);

const DENTALTOWN_PROVIDER = 'Dentaltown CE';
const DENTALTOWN_PROVIDER_SLUG = 'dentaltown-ce';
const DENTALTOWN_START_URL = 'https://www.dentaltown.com/onlinece/viewall?pg=1';
const DENTALTOWN_BASE_URL = 'https://www.dentaltown.com';
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

function cleanText(value = '', max = 1800) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = DENTALTOWN_BASE_URL) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function parsePageCount($) {
  const lastHref = $('a.last.next').first().attr('href') || '';
  if (lastHref) {
    try {
      const lastPage = Number(new URL(lastHref, DENTALTOWN_BASE_URL).searchParams.get('pg'));
      if (Number.isFinite(lastPage) && lastPage > 0) return lastPage;
    } catch {
      // Ignore parse errors and fall back below.
    }
  }

  const displayText = cleanText($('#subMaster_mainBody_ctl00_Pager1_lbDisplay').text(), 120)
    || cleanText($('#subMaster_mainBody_ctl00_Pager2_lbDisplay').text(), 120);
  const match = displayText.match(/of\s+(\d+)/i);
  if (match) {
    const total = Number(match[1]);
    if (Number.isFinite(total) && total > 0) {
      return Math.ceil(total / 25);
    }
  }

  return 1;
}

function inferTopic(text = '') {
  const value = cleanText(text, 500).toLowerCase();
  if (/implant/.test(value)) return 'Implants';
  if (/endo/.test(value)) return 'Endodontics';
  if (/ortho/.test(value)) return 'Orthodontics';
  if (/periodont/.test(value)) return 'Periodontics';
  if (/prosthodont/.test(value) || /denture/.test(value)) return 'Prosthodontics';
  if (/oral surgery/.test(value)) return 'Oral Surgery';
  if (/sleep/.test(value)) return 'Sleep & Airway';
  if (/laser/.test(value)) return 'Laser Dentistry';
  if (/tmj|occlusion/.test(value)) return 'TMD / Occlusion';
  if (/practice|marketing|accounting|financial|transition/.test(value)) return 'Practice Management & Business';
  if (/ethics|jurisprudence|malpractice|compliance/.test(value)) return 'Regulatory / Risk Management';
  if (/hygiene/.test(value)) return 'Dental Hygiene';
  if (/pediatric/.test(value)) return 'Pediatric Dentistry';
  if (/cosmetic|esthetic/.test(value)) return 'Esthetics & Facial Esthetics';
  if (/restorative/.test(value)) return 'Restorative Dentistry';
  if (/anesthesia/.test(value)) return 'Anesthesia';
  if (/radiography|cbct|imaging/.test(value)) return 'Digital Dentistry & Technology';
  return 'General Dentistry';
}

function parsePriceDetails(text = '') {
  const value = cleanText(text, 300);
  const costToView = value.match(/(?:Series )?Cost to View:\s*([^\n]+)/i)?.[1] || '';
  const costForCredit = value.match(/Cost for Credit:\s*([^\n]+)/i)?.[1] || '';
  const price = cleanText(costToView || costForCredit, 120);
  return {
    price,
    isFree: /\bfree\b/i.test(price),
  };
}

function parseCredits(text = '') {
  const value = cleanText(text, 300);
  return cleanText(value.match(/CE Credits:\s*([\d.]+)/i)?.[1] || '', 40);
}

function parseRunningTime(text = '') {
  const value = cleanText(text, 300);
  return cleanText(value.match(/Running Time:\s*([^\n]+)/i)?.[1] || '', 80);
}

function parseReleaseDate(text = '') {
  const value = cleanText(text, 300);
  const raw = cleanText(value.match(/Release Date:\s*([0-9/]+)/i)?.[1] || '', 20);
  if (!raw) return { releaseText: '', startDate: '' };

  const [month, day, year] = raw.split('/').map((part) => Number(part));
  if (!month || !day || !year) {
    return { releaseText: raw, startDate: '' };
  }

  return {
    releaseText: raw,
    startDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

function parseReviewRating(cardHtml = '') {
  const match = cardHtml.match(/"value":\s*([\d.]+)/);
  if (!match) return null;
  const rating = Number(match[1]);
  return Number.isFinite(rating) ? rating : null;
}

function parseReviewCount(cardText = '') {
  const match = cardText.match(/\((\d+)\s+Review/i);
  return match ? Number(match[1]) : null;
}

async function loadDentaltownHTML(url) {
  const { stdout } = await execFileAsync('curl', [
    '-L',
    '--max-time',
    '30',
    '-A',
    BROWSER_USER_AGENT,
    '-H',
    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    url,
  ], {
    maxBuffer: 12 * 1024 * 1024,
  });

  return cheerio.load(stdout);
}

function extractRowsFromPage($, pageUrl) {
  const rows = [];

  $('a[id$="_hlCourseTitle"]').each((_, link) => {
    const node = $(link);
    const title = cleanText(node.text(), 250);
    const url = absoluteUrl(node.attr('href') || '', pageUrl);
    const box = node.closest('.boxRow');
    const cardText = cleanText(box.text(), 2000);
    const speaker = cleanText(box.find('.subTitle').first().text().replace(/^Speaker:\s*/i, ''), 180);
    const description = cleanText(box.find('.subText.light').first().text(), 1600);
    const category = cleanText(box.find('a[id$="_hlCategory"]').first().text(), 200)
      || cleanText(box.find('a[id$="_hlCategory_bottom"]').first().text(), 200);
    const rightDetailsText = cleanText(box.find('.CERightDetails').text(), 400)
      || cleanText(box.find('.CEBottomDetails').text(), 400);
    const { price, isFree } = parsePriceDetails(rightDetailsText);
    const credits = parseCredits(rightDetailsText);
    const runningTime = parseRunningTime(rightDetailsText);
    const { releaseText, startDate } = parseReleaseDate(rightDetailsText);
    const isSeries = /\/onlinece\/series\//i.test(url);
    const reviewRating = parseReviewRating(box.html() || '');
    const reviewCount = parseReviewCount(cardText);

    if (!title || !url) return;

    rows.push(normalizeCourse({
      provider: DENTALTOWN_PROVIDER,
      provider_slug: DENTALTOWN_PROVIDER_SLUG,
      source_url: pageUrl,
      url,
      title,
      description: description || `${title} is listed in the Dentaltown continuing education library.`,
      course_type: isSeries ? 'Series / Curriculum' : 'Online Course',
      format: 'Online',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${category} ${title}`),
      credits,
      credits_text: credits ? `${credits} credits` : '',
      price,
      date_text: releaseText ? `Release Date: ${releaseText}` : '',
      start_date: startDate,
      location: 'Online',
      city: '',
      state: '',
      country: 'USA',
      instructors: speaker,
      accreditation: 'Farran Media / Dentaltown CE',
      requirements: runningTime ? `Running Time: ${runningTime}` : '',
      tags: [
        'Dentaltown',
        'Online',
        category,
        isFree ? 'Free' : '',
        isSeries ? 'Series' : '',
      ].filter(Boolean),
      metadata: {
        category,
        running_time: runningTime,
        review_rating: reviewRating,
        review_count: reviewCount,
        extracted_from: 'dentaltown-viewall',
      },
    }));
  });

  return rows;
}

export async function scrapeDentaltown() {
  console.log('   • Scraping Dentaltown CE');

  const firstPage = await loadDentaltownHTML(DENTALTOWN_START_URL);
  const totalPages = parsePageCount(firstPage);
  const rows = extractRowsFromPage(firstPage, DENTALTOWN_START_URL);

  for (let page = 2; page <= totalPages; page += 1) {
    const pageUrl = `https://www.dentaltown.com/onlinece/viewall?pg=${page}`;
    const $ = await loadDentaltownHTML(pageUrl);
    rows.push(...extractRowsFromPage($, pageUrl));
  }

  const deduped = [];
  const seen = new Set();
  for (const row of rows) {
    const key = `${row.title}::${row.url}`;
    if (!row.title || !row.url || seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  console.log(`   • Extracted ${deduped.length} Dentaltown CE rows`);
  return deduped;
}
