import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const COLUMBIA_URL = 'https://www.dental.columbia.edu/education/continuing-education';

function cleanText(value = '', max = 1200) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function inferTopic(text = '') {
  const value = cleanText(text, 400).toLowerCase();
  if (/sleep/.test(value)) return 'Sleep & Airway';
  if (/periodontal/.test(value)) return 'Periodontics';
  if (/mri|cbct/.test(value)) return 'Digital Dentistry & Technology';
  return 'General Dentistry';
}

export async function scrapeColumbia() {
  console.log('   • Scraping Columbia Dental CE');

  const $ = await loadHTML(COLUMBIA_URL);
  const rows = [];

  $('.cb-list-events__content .view-content > ul > li').each((_, element) => {
    const item = $(element);
    const title = cleanText(item.find('.cb-list-events__title h3 a').text(), 250);
    const url = cleanText(item.find('.cb-list-events__title h3 a').attr('href') || '', 700);
    const date = cleanText(item.find('.cb-list-events__date').text(), 120);
    const time = cleanText(item.find('.cb-list-events__time').text(), 120);
    const location = cleanText(item.find('.cb-list-events__location').text(), 120) || 'Online';

    if (!title || !url) return;

    rows.push(normalizeCourse({
      provider: 'Columbia Dental CE',
      provider_slug: 'columbia-dental-ce',
      source_url: COLUMBIA_URL,
      url,
      title,
      description: `${title} is listed in the Columbia University College of Dental Medicine continuing education lineup.`,
      course_type: 'Live Course',
      format: /online/i.test(location) ? 'Online' : 'In Person',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(title),
      date_text: [date, time].filter(Boolean).join(' • '),
      location,
      accreditation: 'Columbia University College of Dental Medicine',
      tags: ['Columbia', inferTopic(title), location].filter(Boolean),
      metadata: {
        extracted_from: 'columbia-upcoming-courses',
      },
    }));
  });

  console.log(`   • Extracted ${rows.length} Columbia Dental CE rows`);
  return rows;
}
