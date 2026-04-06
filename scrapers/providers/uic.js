import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const UIC_PROVIDER = 'UIC College of Dentistry CE';
const UIC_PROVIDER_SLUG = 'uic-college-of-dentistry-ce';
const UIC_URL = 'https://dentistry.uic.edu/academics/continuing-education/';

function cleanText(value = '', max = 500) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = UIC_URL) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

export async function scrapeUIC() {
  console.log('   • Scraping UIC College of Dentistry CE');

  const $ = await loadHTML(UIC_URL);
  const rows = [];

  $('section.component .component-text-block').each((_, element) => {
    const item = $(element);
    const title = cleanText(item.find('h2').first().text(), 250);
    const description = cleanText(item.find('p').first().text(), 900);
    const url = absoluteUrl(item.find('.link-list a[href]').first().attr('href') || '', UIC_URL);

    if (!title || !description || !url) return;
    if (!/orthodontics|assistants|hygienists/i.test(title)) return;

    rows.push(normalizeCourse({
      provider: UIC_PROVIDER,
      provider_slug: UIC_PROVIDER_SLUG,
      source_url: UIC_URL,
      url,
      title,
      description,
      course_type: /orthodontics/i.test(title) ? 'CE Program' : 'Live Course',
      format: 'In Person',
      audience: 'Dentists and Dental Team',
      topic: /orthodontics/i.test(title) ? 'Orthodontics' : 'Dental Hygiene',
      location: 'UIC College of Dentistry',
      accreditation: 'UIC College of Dentistry',
      tags: ['UIC', /orthodontics/i.test(title) ? 'Orthodontics' : 'Dental Hygiene', 'In Person'],
      metadata: {
        extracted_from: 'uic-continuing-education-sections',
      },
    }));
  });

  console.log(`   • Extracted ${rows.length} UIC College of Dentistry CE rows`);
  return rows;
}
