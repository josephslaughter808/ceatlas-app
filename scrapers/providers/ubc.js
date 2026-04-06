import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const UBC_PROVIDER = 'UBC Continuing Dental Education';
const UBC_PROVIDER_SLUG = 'ubc-continuing-dental-education';
const UBC_URL = 'https://www.dentistry.ubc.ca/cde/';

function cleanText(value = '', max = 500) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = UBC_URL) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function inferTopic(text = '') {
  const value = cleanText(text, 400).toLowerCase();
  if (/orthodont/.test(value)) return 'Orthodontics';
  if (/geriatric/.test(value)) return 'Geriatric Dentistry';
  if (/management|staff|systems/.test(value)) return 'Practice Management & Business';
  if (/anaesthesia|hygienist/.test(value)) return 'Dental Hygiene';
  return 'General Dentistry';
}

function inferFormat(text = '') {
  const value = cleanText(text, 400).toLowerCase();
  if (/online|webinar|pre-recorded/.test(value)) return 'Online';
  if (/travel/.test(value)) return 'Travel';
  return 'In Person';
}

export async function scrapeUBC() {
  console.log('   • Scraping UBC Continuing Dental Education');

  const $ = await loadHTML(UBC_URL);
  const rows = [];

  $('.research-item').each((_, element) => {
    const item = $(element);
    const title = cleanText(item.find('.research-title').first().text(), 250);
    const description = cleanText(item.find('.research-excerpt').first().text(), 900);
    const url = absoluteUrl(item.find('.research-title, .research-link').first().attr('href') || '', UBC_URL);

    if (!title || !description || !url || /contact cde/i.test(title)) return;

    rows.push(normalizeCourse({
      provider: UBC_PROVIDER,
      provider_slug: UBC_PROVIDER_SLUG,
      source_url: UBC_URL,
      url,
      title,
      description,
      course_type: /calendar|online learning/i.test(title) ? 'Course Catalog' : /study clubs/i.test(title) ? 'Study Club Program' : /travel/i.test(title) ? 'Travel Program' : 'CE Program',
      format: inferFormat(`${title} ${description}`),
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${title} ${description}`),
      location: /travel/i.test(title) ? 'Travel destination' : 'UBC Faculty of Dentistry',
      accreditation: 'UBC Continuing Dental Education',
      tags: ['UBC', inferTopic(title), inferFormat(title)].filter(Boolean),
      metadata: {
        extracted_from: 'ubc-cde-tiles',
      },
    }));
  });

  console.log(`   • Extracted ${rows.length} UBC Continuing Dental Education rows`);
  return rows;
}
