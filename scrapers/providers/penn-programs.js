import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const PENN_URL = 'https://www.dental.upenn.edu/continuing-education/';

function cleanText(value = '', max = 700) {
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

function providerName(title = '') {
  return title.startsWith('Penn ') ? title : `Penn ${title}`;
}

function inferTopic(text = '') {
  const value = cleanText(text, 400).toLowerCase();
  if (/airway|maxillofacial|aaoms/.test(value)) return 'Oral Surgery';
  if (/microscop|restorative|endodont|periodont/.test(value)) return 'Restorative Dentistry';
  if (/disabilities/.test(value)) return 'General Dentistry';
  return 'General Dentistry';
}

function inferFormat(text = '') {
  const value = cleanText(text, 400).toLowerCase();
  if (/online|elearning|self-paced|live online/.test(value)) return 'Online';
  if (/travel/.test(value)) return 'Travel';
  return 'Hybrid';
}

function inferCourseType(text = '') {
  const value = cleanText(text, 400).toLowerCase();
  if (/travel/.test(value)) return 'Travel Program';
  if (/series/.test(value)) return 'Lecture Series';
  if (/course/.test(value)) return 'CE Program';
  return 'Featured Program';
}

export async function scrapePennPrograms() {
  console.log('   • Scraping Penn program-level providers');

  const $ = await loadHTML(PENN_URL);
  const rows = [];

  $('.section-link-item a[href]').each((_, element) => {
    const anchor = $(element);
    const url = absoluteUrl(anchor.attr('href') || '', PENN_URL);
    const title = cleanText(anchor.find('h2').text(), 240);
    const description = cleanText(anchor.find('.details').text(), 1200);

    if (!title || !url || !description || /general information|policies/i.test(title)) return;

    const provider = providerName(title);
    rows.push(normalizeCourse({
      provider,
      provider_slug: provider.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      source_url: PENN_URL,
      url,
      title,
      description,
      course_type: inferCourseType(`${title} ${description}`),
      format: inferFormat(`${title} ${description}`),
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${title} ${description}`),
      location: /travel/i.test(title) ? 'Travel destination' : 'Penn Dental Medicine',
      accreditation: 'Penn Dental Medicine',
      tags: ['Penn', inferTopic(title), inferFormat(title)].filter(Boolean),
      metadata: {
        extracted_from: 'penn-program-cards',
      },
    }));
  });

  console.log(`   • Extracted ${rows.length} Penn program-level rows`);
  return rows;
}
