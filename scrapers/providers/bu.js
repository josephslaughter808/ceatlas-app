import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const BU_URL = 'https://www.bu.edu/dental/ce/continuing-education/';

function cleanText(value = '', max = 1200) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export async function scrapeBU() {
  console.log('   • Scraping Boston University Dental CE');

  const $ = await loadHTML(BU_URL);
  const rows = [];
  const upcomingHeading = $('h3').filter((_, element) => cleanText($(element).text(), 80) === 'Upcoming Courses').first();
  const table = upcomingHeading.nextAll('table').first();

  table.find('tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 3) return;

    const dateText = cleanText(cells.eq(0).text(), 120);
    const anchor = cells.eq(1).find('a[href]').first();
    const title = cleanText(anchor.text(), 250);
    const url = cleanText(anchor.attr('href') || '', 700);
    const format = cleanText(cells.eq(2).text(), 120);

    if (!title || !url) return;

    rows.push(normalizeCourse({
      provider: 'Boston University Dental CE',
      provider_slug: 'boston-university-dental-ce',
      source_url: BU_URL,
      url,
      title,
      description: `${title} is listed on the Boston University Henry M. Goldman School of Dental Medicine continuing education page.`,
      course_type: /hands-on/i.test(format) ? 'Hands-On Course' : 'Live Course',
      format: /online/i.test(format) ? 'Online' : 'In Person',
      audience: 'Dentists and Dental Team',
      topic: 'General Dentistry',
      date_text: dateText,
      location: /online/i.test(format) ? 'Online' : 'Boston University Henry M. Goldman School of Dental Medicine',
      accreditation: 'Boston University Henry M. Goldman School of Dental Medicine',
      tags: ['Boston University', format].filter(Boolean),
      metadata: {
        extracted_from: 'bu-upcoming-courses-table',
      },
    }));
  });

  console.log(`   • Extracted ${rows.length} Boston University Dental CE rows`);
  return rows;
}
