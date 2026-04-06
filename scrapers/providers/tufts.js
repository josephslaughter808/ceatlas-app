import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const TUFTS_PROVIDER = 'Tufts Dental CE';
const TUFTS_PROVIDER_SLUG = 'tufts-dental-ce';
const TUFTS_URL = 'https://dental.tufts.edu/continuing-education/short-courses';

function cleanText(value = '', max = 500) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = TUFTS_URL) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function inferTopic(text = '') {
  const value = cleanText(text, 400).toLowerCase();
  if (/implant|sinus/.test(value)) return 'Implants';
  if (/root canal|endodont/.test(value)) return 'Endodontics';
  if (/pediatric|tongue-tie/.test(value)) return 'Pediatric Dentistry';
  if (/esthetic|smile/.test(value)) return 'Esthetics & Facial Esthetics';
  if (/cbct|radiolog/.test(value)) return 'Digital Dentistry & Technology';
  return 'General Dentistry';
}

function inferFormat(text = '') {
  return /travel|maui/i.test(text) ? 'Travel' : 'In Person';
}

function inferType(text = '') {
  return /hands-on/i.test(text) ? 'Hands-On Course' : /symposium|summit|congress/i.test(text) ? 'Conference / Symposium' : 'Live Course';
}

export async function scrapeTufts() {
  console.log('   • Scraping Tufts Dental CE short courses');

  const $ = await loadHTML(TUFTS_URL);
  const rows = [];

  $('table tbody tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 2) return;

    const dateText = cleanText(cells.eq(0).text(), 120);
    const courseCell = cells.eq(1);
    const links = courseCell.find('a[href]');

    if (!dateText || !links.length) return;

    links.each((__, link) => {
      const anchor = $(link);
      const title = cleanText(anchor.text() || anchor.attr('title') || '', 250);
      const url = absoluteUrl(anchor.attr('href') || '', TUFTS_URL);

      if (!title || !url) return;

      rows.push(normalizeCourse({
        provider: TUFTS_PROVIDER,
        provider_slug: TUFTS_PROVIDER_SLUG,
        source_url: TUFTS_URL,
        url,
        title,
        description: `${title} offered through Tufts University School of Dental Medicine Continuing Education.`,
        course_type: inferType(title),
        format: inferFormat(title),
        audience: 'Dentists and Dental Team',
        topic: inferTopic(title),
        date_text: dateText,
        location: /travel/i.test(title) ? 'Travel destination' : 'Tufts University School of Dental Medicine',
        accreditation: 'Tufts University School of Dental Medicine',
        tags: ['Tufts', inferTopic(title), inferFormat(title)].filter(Boolean),
        metadata: {
          extracted_from: 'tufts-short-courses-table',
          schedule_text: dateText,
        },
      }));
    });
  });

  console.log(`   • Extracted ${rows.length} Tufts Dental CE rows`);
  return rows;
}
