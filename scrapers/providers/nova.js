import axios from 'axios';
import * as cheerio from 'cheerio';
import { normalizeCourse } from '../../lib/normalize.js';

const NOVA_PROVIDER = 'Nova Southeastern University Dental CE';
const NOVA_PROVIDER_SLUG = 'nova-southeastern-university-dental-ce';
const NOVA_SOURCE_URL = 'https://dental.nova.edu/continuing-education/courses.html';
const NOVA_CALENDAR_URL = 'https://reg.learningstream.com/view/inc_resp_view_category_select_fetch.aspx?dl=6&as=74&ws=255&cs1=1099&cs2=0&cs3=0&so=1&ls=0&ds=0&tz=0&drr=1&iec=0&il=1&stz=0&aid=NSUCDM&ss=';

function cleanText(value = '', max = 2000) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function absoluteUrl(value = '', base = NOVA_SOURCE_URL) {
  if (!value) return '';
  try {
    return new URL(value, base).href;
  } catch {
    return '';
  }
}

function normalizeDate(value = '') {
  const match = cleanText(value, 60).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';
  return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
}

function inferTopic(text = '') {
  const value = cleanText(text, 500).toLowerCase();
  if (/implant|maxicourse/.test(value)) return 'Implants';
  if (/endodont/.test(value)) return 'Endodontics';
  if (/radiology/.test(value)) return 'Radiology';
  if (/assistant|expanded functions/.test(value)) return 'Dental Assisting';
  if (/denture|prosthodont|rehabilitation|occlusion/.test(value)) return 'Prosthodontics';
  if (/management/.test(value)) return 'Practice Management & Business';
  return 'General Dentistry';
}

function inferFormat(text = '') {
  const value = cleanText(text, 300).toLowerCase();
  if (/online-fixed|zoom|synchronous|webinar/.test(value)) return 'Online';
  if (/hybrid/.test(value)) return 'Hybrid';
  return 'In Person';
}

function extractSectionRows(html = '') {
  const $ = cheerio.load(html);
  const rows = [];

  $('.table_row_cal_list, .table_row_alt_cal_list').each((_, row) => {
    const item = $(row);
    const cells = item.find('.table_item_cal_list, .table_item_primary_cal_list');
    const link = item.find('a[href*="/reg/event_page.aspx"]').first();

    const href = link.attr('href') || '';
    const title = cleanText(link.text(), 250);
    const monthText = cleanText(cells.eq(0).text(), 40);
    const dateText = cleanText(cells.eq(1).text(), 80);
    const timeText = cleanText(cells.eq(2).text(), 120);
    const location = cleanText(cells.eq(3).text(), 180);
    const detailText = cleanText(cells.eq(4).text(), 400);

    if (!href || !title) return;

    rows.push({
      url: absoluteUrl(href, 'https://reg.learningstream.com'),
      title,
      monthText,
      dateText,
      timeText,
      location,
      detailText,
    });
  });

  return rows;
}

function extractModuleText($, heading) {
  let content = '';
  $('.module_style').each((_, module) => {
    const block = $(module);
    const title = cleanText(block.find('.header_style').first().text(), 120);
    if (title.toLowerCase() === heading.toLowerCase()) {
      content = cleanText(block.find('.content_style').first().text(), 2500);
    }
  });
  return content;
}

function extractDescription($) {
  return extractModuleText($, 'Course Description');
}

function extractInstructors($) {
  return extractModuleText($, 'Instructor Bio');
}

function extractPrice($) {
  return extractModuleText($, 'Financials');
}

function extractCredits($) {
  const ce = extractModuleText($, 'Continuing Education');
  const match = ce.match(/CE Hours\s*-\s*([\d.]+)/i) || ce.match(/designates this activity for\s*([\d.]+)/i);
  return match ? match[1] : '';
}

function extractLocation($, fallback = '') {
  const text = extractModuleText($, 'Location');
  return text || fallback;
}

function extractStartDate(dateText = '') {
  const first = cleanText(dateText).split('-')[0].trim();
  return normalizeDate(first);
}

function extractEndDate(dateText = '') {
  const parts = cleanText(dateText).split('-').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return '';
  return normalizeDate(parts[parts.length - 1]);
}

export async function scrapeNova() {
  console.log('   • Scraping Nova Southeastern University Dental CE');

  const { data: calendarHtml } = await axios.get(NOVA_CALENDAR_URL, {
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CEAtlasBot/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  const listings = extractSectionRows(calendarHtml);
  const rows = [];

  for (const listing of listings) {
    const { data: detailHtml } = await axios.get(listing.url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CEAtlasBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    const $ = cheerio.load(detailHtml);
    const headerTitle = cleanText($('.header_style').first().text(), 250);
    const title = headerTitle || listing.title;
    const description = extractDescription($);
    const instructors = extractInstructors($);
    const price = extractPrice($);
    const credits = extractCredits($);
    const location = extractLocation($, listing.location || 'Nova Southeastern University College of Dental Medicine');
    const format = inferFormat(`${listing.detailText} ${location}`);
    const dateText = [listing.dateText, listing.timeText].filter(Boolean).join(' • ');

    rows.push(normalizeCourse({
      provider: NOVA_PROVIDER,
      provider_slug: NOVA_PROVIDER_SLUG,
      source_url: NOVA_SOURCE_URL,
      url: listing.url,
      title,
      description,
      course_type: /hands-on/i.test(description) ? 'Hands-On Course' : format === 'Online' ? 'Online Course' : 'Live Course',
      format,
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${title} ${description}`),
      credits,
      credits_text: credits ? `${credits} credits` : '',
      price,
      start_date: extractStartDate(listing.dateText),
      end_date: extractEndDate(listing.dateText),
      date_text: dateText,
      location,
      city: 'Davie',
      state: 'FL',
      country: 'USA',
      instructors,
      accreditation: 'Nova Southeastern University College of Dental Medicine',
      tags: ['Nova', inferTopic(title), format].filter(Boolean),
      metadata: {
        extracted_from: 'nova-learningstream-calendar',
        listing_detail: listing.detailText,
      },
    }));
  }

  console.log(`   • Extracted ${rows.length} Nova Dental CE rows`);
  return rows;
}
