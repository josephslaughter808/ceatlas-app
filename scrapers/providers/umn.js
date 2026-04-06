import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const UMN_URL = 'https://dentistry.umn.edu/continuing-dental-education';
const UMN_BASE = 'https://dentistry.umn.edu';

function cleanText(value = '', max = 1200) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = UMN_BASE) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function inferTopic(text = '') {
  const value = cleanText(text, 400).toLowerCase();
  if (/endo/.test(value)) return 'Endodontics';
  if (/oral surgery|lesions|cancer/.test(value)) return 'Oral Surgery';
  if (/pediatric/.test(value)) return 'Pediatric Dentistry';
  if (/radiology|cbct/.test(value)) return 'Digital Dentistry & Technology';
  if (/webinar|online|zoom/.test(value)) return 'General Dentistry';
  return 'General Dentistry';
}

function inferFormat(text = '') {
  const value = cleanText(text, 300).toLowerCase();
  if (/zoom|webinar|online|self-paced/.test(value)) return 'Online';
  if (/hands-on|workshop|residency/.test(value)) return 'In Person';
  return 'Hybrid';
}

export async function scrapeUMN() {
  console.log('   • Scraping University of Minnesota Continuing Dental Education');

  const $ = await loadHTML(UMN_URL);
  const rows = [];
  const seen = new Set();

  $('.view-id-cde_programs.view-display-id-block_2 article.program').each((_, element) => {
    const item = $(element);
    const title = cleanText(item.find('h3 a').text(), 250);
    const url = absoluteUrl(item.find('h3 a').attr('href') || '', UMN_BASE);
    const dateText = cleanText(item.find('.program__date').text(), 250);
    const description = cleanText(item.find('.program__teaser').text(), 1200);
    const key = `${title}||${url}`;

    if (!title || !url || seen.has(key)) return;
    seen.add(key);

    rows.push(normalizeCourse({
      provider: 'University of Minnesota Continuing Dental Education',
      provider_slug: 'university-of-minnesota-continuing-dental-education',
      source_url: UMN_URL,
      url,
      title,
      description,
      course_type: /residency/i.test(title) ? 'Mini Residency' : /workshop/i.test(title) ? 'Workshop' : 'CE Course',
      format: inferFormat(`${title} ${dateText} ${description}`),
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${title} ${description}`),
      date_text: dateText,
      location: /zoom|webinar/i.test(`${title} ${description}`) ? 'Online' : 'University of Minnesota School of Dentistry',
      accreditation: 'University of Minnesota School of Dentistry',
      tags: ['Minnesota', inferTopic(title), inferFormat(title)].filter(Boolean),
      metadata: {
        extracted_from: 'umn-upcoming-courses',
      },
    }));
  });

  console.log(`   • Extracted ${rows.length} University of Minnesota rows`);
  return rows;
}
