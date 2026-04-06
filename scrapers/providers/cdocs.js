import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const CDOCS_PROVIDER = 'CDOCS';
const CDOCS_PROVIDER_SLUG = 'cdocs';
const CDOCS_SOURCE_URL = 'https://www.cdocs.com/campus-learning';

const SUBCATEGORY_TOPIC_MAP = {
  1: 'Digital Dentistry & Technology',
  2: 'Cone Beam & Imaging',
  3: 'Implant Dentistry',
  5: 'Orthodontics',
  7: 'Sleep & Airway',
};

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
    .replace(/<[^>]*>/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = CDOCS_SOURCE_URL) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function inferTopic(title = '', fallback = '') {
  const text = cleanText(title, 250).toLowerCase();
  if (fallback) return fallback;
  if (/sleep|airway|apnea/.test(text)) return 'Sleep & Airway';
  if (/aligner|orthodont/.test(text)) return 'Orthodontics';
  if (/implant|grafting|surgery|molar|full arch/.test(text)) return 'Implant Dentistry';
  if (/cone beam|cbct|diagnostic/.test(text)) return 'Cone Beam & Imaging';
  if (/esthetic|smile|restorative|cad\/cam|digital|printing|denture/.test(text)) return 'Digital Dentistry & Technology';
  return 'General Dentistry';
}

function extractWorkshopTargets($) {
  const targets = [];

  $('.workshop-panel').each((_, element) => {
    const panel = $(element);
    const className = panel.attr('class') || '';
    const subcategoryMatch = className.match(/subcategory-(\d+)/);
    const subcategoryId = subcategoryMatch ? Number(subcategoryMatch[1]) : null;
    const detailPath = panel.find('a[href*="/campus-learning/hands-on-workshops/id/"]').first().attr('href') || '';
    const detailUrl = absoluteUrl(detailPath);
    const title = cleanText(panel.find('h3.media-heading').first().text(), 250);

    if (!detailUrl || !title) return;

    targets.push({
      detailUrl,
      title,
      topic: inferTopic(title, SUBCATEGORY_TOPIC_MAP[subcategoryId] || ''),
    });
  });

  return targets.filter((target, index, array) => (
    array.findIndex((item) => item.detailUrl === target.detailUrl) === index
  ));
}

function parseMonthIndex(token = '') {
  const cleaned = token.toLowerCase().replace(/\./g, '').slice(0, 3);
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return months.indexOf(cleaned);
}

function formatIsoDate(year, monthIndex, day) {
  const date = new Date(Date.UTC(year, monthIndex, day));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function parseSessionDateRange(label = '') {
  const text = cleanText(label, 120);
  const match = text.match(/^([A-Za-z.]+)\s+(\d{1,2})(?:-(\d{1,2}))?,\s*(\d{4})$/);
  if (!match) {
    return { start_date: '', end_date: '' };
  }

  const [, monthToken, startDayRaw, endDayRaw, yearRaw] = match;
  const year = Number(yearRaw);
  const monthIndex = parseMonthIndex(monthToken);

  if (monthIndex < 0 || !year) {
    return { start_date: '', end_date: '' };
  }

  const startDay = Number(startDayRaw);
  const endDay = endDayRaw ? Number(endDayRaw) : startDay;
  const start_date = formatIsoDate(year, monthIndex, startDay);

  let endMonthIndex = monthIndex;
  if (endDayRaw && endDay < startDay) {
    endMonthIndex = (monthIndex + 1) % 12;
  }

  const endYear = monthIndex === 11 && endMonthIndex === 0 ? year + 1 : year;
  const end_date = formatIsoDate(endYear, endMonthIndex, endDay);

  return { start_date, end_date };
}

function parseCityStateCountry(location = '') {
  const text = cleanText(location, 120);
  if (!text) return { city: '', state: '', country: '' };

  if (/Toronto, ON \(CAN\)/i.test(text)) {
    return { city: 'Toronto', state: 'ON', country: 'Canada' };
  }

  const match = text.match(/^(.+?),\s*([A-Z]{2})$/);
  if (match) {
    return {
      city: cleanText(match[1], 80),
      state: cleanText(match[2], 20),
      country: 'USA',
    };
  }

  return { city: text, state: '', country: '' };
}

function extractBulletLines($) {
  return $('#course-description .well li .media-body')
    .map((_, element) => cleanText($(element).text(), 300))
    .get()
    .filter(Boolean);
}

function extractCosts($) {
  return $('#course-info h3')
    .filter((_, element) => cleanText($(element).text(), 40) === 'Cost:')
    .first()
    .next('ul')
    .find('li')
    .map((_, element) => cleanText($(element).text(), 120))
    .get()
    .filter(Boolean)
    .join(' | ');
}

function extractFaculty($) {
  return $('#course-info h3')
    .filter((_, element) => cleanText($(element).text(), 40) === 'Faculty:')
    .first()
    .next('ul')
    .find('li')
    .map((_, element) => cleanText($(element).text(), 160))
    .get()
    .filter(Boolean)
    .join('\n');
}

function extractCredits($) {
  const value = $('#course-info h3')
    .filter((_, element) => cleanText($(element).text(), 40) === 'Credits:')
    .first()
    .next('ul')
    .find('li')
    .first()
    .text();

  return cleanText(value, 80);
}

function extractDates($) {
  const heading = $('#course-info h3')
    .filter((_, element) => /Dates$/i.test(cleanText($(element).text(), 60)))
    .first();

  const headingText = cleanText(heading.text(), 60);
  const yearMatch = headingText.match(/(20\d{2})/);
  const yearText = yearMatch ? yearMatch[1] : '';

  return heading
    .next('ul')
    .find('li')
    .map((index, element) => {
      const item = $(element);
      const schedule = cleanText(item.find('small').first().text(), 40);
      const raw = item.clone();
      raw.find('small').remove();
      raw.find('a').remove();
      let dateLabel = cleanText(raw.text().replace(/\(Sold Out\)|\(Limited Seats\)/gi, ''), 80);
      if (yearText && !/\b20\d{2}\b/.test(dateLabel)) {
        dateLabel = `${dateLabel}, ${yearText}`;
      }
      const soldOut = /\bSold Out\b/i.test(item.text());
      const location = cleanText(item.find('a').text(), 120);
      return {
        key: index + 1,
        schedule,
        dateLabel,
        location,
        soldOut,
      };
    })
    .get()
    .filter((session) => session.dateLabel && session.location);
}

async function scrapeCdocsWorkshop(target) {
  const $ = await loadHTML(target.detailUrl);
  const title = cleanText($('#headline-area h1').first().text(), 250) || target.title;
  const creditsText = extractCredits($);
  const instructors = extractFaculty($);
  const price = extractCosts($);
  const prerequisites = cleanText($('#headline-area small').last().text().replace(/^Prerequisites:\s*/i, ''), 300);
  const description = cleanMultiline($('#headline-area p').map((_, element) => $(element).text()).get().join('\n\n'), 2500);
  const objectives = extractBulletLines($);
  const sessions = extractDates($);
  const topic = inferTopic(title, target.topic);
  const audience = /assistant/i.test(title) ? 'Dental Assistants' : 'Dentists';
  const requirements = [prerequisites ? `Prerequisites: ${prerequisites}` : '', ...objectives].filter(Boolean).join('\n');

  return sessions.map((session) => {
    const { start_date, end_date } = parseSessionDateRange(session.dateLabel);
    const geo = parseCityStateCountry(session.location);

    return normalizeCourse({
      provider: CDOCS_PROVIDER,
      provider_slug: CDOCS_PROVIDER_SLUG,
      source_url: target.detailUrl,
      url: `${target.detailUrl}#session-${session.key}`,
      title,
      description,
      course_type: 'Hands-On Workshop',
      format: 'In Person',
      audience,
      topic,
      credits_text: creditsText,
      price,
      start_date,
      end_date,
      date_text: `${session.schedule} • ${session.dateLabel} • ${session.location}`,
      location: session.location,
      city: geo.city,
      state: geo.state,
      country: geo.country,
      instructors,
      accreditation: 'CDOCS',
      requirements,
      tags: ['CDOCS', 'Hands-On Workshop', 'In Person', topic, session.location].filter(Boolean),
      metadata: {
        extracted_from: 'cdocs-workshops',
        detail_url: target.detailUrl,
        session_index: session.key,
        sold_out: session.soldOut,
      },
    });
  });
}

export async function scrapeCDOCS(startUrl = CDOCS_SOURCE_URL) {
  console.log('   • Scraping CDOCS public workshop catalog');

  const $ = await loadHTML(startUrl);
  const workshopTargets = extractWorkshopTargets($);
  const results = [];

  for (const target of workshopTargets) {
    try {
      const sessions = await scrapeCdocsWorkshop(target);
      results.push(...sessions);
    } catch (error) {
      console.log(`      ⚠️ Failed to load CDOCS workshop ${target.detailUrl}: ${error.message}`);
    }
  }

  console.log(`   • Extracted ${results.length} CDOCS workshop sessions`);
  return results;
}
