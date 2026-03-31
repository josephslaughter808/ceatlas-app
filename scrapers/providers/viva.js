import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const VIVA_PROVIDER = 'Viva Learning';
const VIVA_PROVIDER_SLUG = 'viva-learning';
const VIVA_SOURCE_URL = 'https://ce.edu.dental/online-dental-ce/viva-learning/';

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
