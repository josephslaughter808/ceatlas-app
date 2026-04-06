import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const PENN_PROVIDER = 'Penn Dental Medicine CE';
const PENN_PROVIDER_SLUG = 'penn-dental-medicine-ce';
const PENN_URL = 'https://www.dental.upenn.edu/continuing-education/';

function cleanText(value = '', max = 500) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = PENN_URL) {
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
  if (/airway|aaoms|oral maxillofacial/.test(value)) return 'Oral Surgery';
  if (/microscop|endodont|periodont|restorative/.test(value)) return 'Restorative Dentistry';
  return 'General Dentistry';
}

function normalizeDate(day = '', monthYear = '') {
  const parsed = new Date(cleanText(`${day} ${monthYear}`, 80));
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

export async function scrapePenn() {
  console.log('   • Scraping Penn Dental Medicine CE');

  const $ = await loadHTML(PENN_URL);
  const rows = [];
  const seen = new Set();

  $('a[href*="/news-events/events/"]').each((_, element) => {
    const anchor = $(element);
    const url = absoluteUrl(anchor.attr('href') || '', PENN_URL);
    const title = cleanText(anchor.find('.title').text(), 250);
    const typeText = cleanText(anchor.find('.type').text(), 120);
    const day = cleanText(anchor.find('.day').text(), 20);
    const monthYear = cleanText(anchor.find('.month').text(), 40);
    const dateText = cleanText(`${day} ${monthYear}`, 80);
    const key = `${title}||${url}`;

    if (!title || !url || seen.has(key)) return;
    seen.add(key);

    rows.push(normalizeCourse({
      provider: PENN_PROVIDER,
      provider_slug: PENN_PROVIDER_SLUG,
      source_url: PENN_URL,
      url,
      title,
      description: `${title} offered through Penn Dental Medicine Continuing Education.`,
      course_type: /meeting|day/i.test(title) ? 'Conference / Symposium' : 'Live Course',
      format: /zoom/i.test(typeText) ? 'Live Streaming' : 'In Person',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${title} ${typeText}`),
      start_date: normalizeDate(day, monthYear),
      date_text: dateText,
      location: typeText || 'Penn Dental Medicine',
      accreditation: 'Penn Dental Medicine',
      tags: ['Penn', typeText, inferTopic(title)].filter(Boolean),
      metadata: {
        extracted_from: 'penn-upcoming-schedule',
      },
    }));
  });

  $('.section-link-item a[href]').each((_, element) => {
    const anchor = $(element);
    const url = absoluteUrl(anchor.attr('href') || '', PENN_URL);
    const title = cleanText(anchor.find('h2').text(), 250);
    const description = cleanText(anchor.find('.details').text(), 700);
    const key = `${title}||${url}`;

    if (!title || !url || !description || /general information|policies/i.test(title) || seen.has(key)) return;
    seen.add(key);

    rows.push(normalizeCourse({
      provider: PENN_PROVIDER,
      provider_slug: PENN_PROVIDER_SLUG,
      source_url: PENN_URL,
      url,
      title,
      description,
      course_type: /travel/i.test(title) ? 'Travel Program' : /online classroom/i.test(title) ? 'Course Library' : 'Featured Program',
      format: /online|eLearning/i.test(description) ? 'Online' : /travel/i.test(title) ? 'Travel' : 'Hybrid',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${title} ${description}`),
      location: /travel/i.test(title) ? 'Travel destination' : 'Penn Dental Medicine',
      accreditation: 'Penn Dental Medicine',
      tags: ['Penn', inferTopic(title), /travel/i.test(title) ? 'Travel' : 'Featured'].filter(Boolean),
      metadata: {
        extracted_from: 'penn-featured-programs',
      },
    }));
  });

  console.log(`   • Extracted ${rows.length} Penn Dental Medicine CE rows`);
  return rows;
}
