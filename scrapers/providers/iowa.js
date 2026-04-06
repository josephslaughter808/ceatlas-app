import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const IOWA_URL = 'https://dentistry.uiowa.edu/';
const IOWA_EVENTS_URL = 'https://events.uiowa.edu/department/321';

function cleanText(value = '', max = 1800) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = IOWA_URL) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

export async function scrapeIowa() {
  console.log('   • Scraping University of Iowa Dental CE');

  const $ = await loadHTML(IOWA_URL);
  const rows = [];

  $('.uiowa-events-wrapper .list-item, .uiowa-events-wrapper article, .uiowa-events-wrapper .card').each((_, element) => {
    const item = $(element);
    const anchor = item.find('a.click-target, a[href*="/event/"]').first();
    const title = cleanText(anchor.text(), 250);
    const url = absoluteUrl(anchor.attr('href') || '', IOWA_URL);
    const description = cleanText(item.find('.card__description, .description').text(), 1500);

    if (!title || !url || !/ce/i.test(`${title} ${description}`)) return;

    rows.push(normalizeCourse({
      provider: 'University of Iowa Dental CE',
      provider_slug: 'university-of-iowa-dental-ce',
      source_url: IOWA_URL,
      url,
      title,
      description: description || `${title} listed by the University of Iowa College of Dentistry as a continuing education offering.`,
      course_type: /distance/i.test(title) ? 'Online Course' : 'Live Course',
      format: /distance/i.test(title) ? 'Online' : 'In Person',
      audience: 'Dentists and Dental Team',
      topic: /diabetes|obesity/i.test(title) ? 'Oral Medicine' : 'General Dentistry',
      location: /distance/i.test(title) ? 'Online' : 'Iowa City, IA',
      city: 'Iowa City',
      state: 'IA',
      country: 'USA',
      accreditation: 'University of Iowa College of Dentistry',
      tags: ['University of Iowa', /distance/i.test(title) ? 'Online' : 'In Person'],
      metadata: {
        extracted_from: 'uiowa-home-events',
        events_url: IOWA_EVENTS_URL,
      },
    }));
  });

  console.log(`   • Extracted ${rows.length} University of Iowa Dental CE rows`);
  return rows;
}
