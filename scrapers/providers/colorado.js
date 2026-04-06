import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const COLORADO_URL = 'https://dental.cuanschutz.edu/community/continuing-education';
const COLORADO_UPCOMING_URL = 'https://secure.touchnet.net/C20369_ustores/web/store_cat.jsp?STOREID=1&CATID=117';

function cleanText(value = '', max = 1600) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export async function scrapeColoradoCE() {
  console.log('   • Scraping CU Anschutz Dental CE');

  const $ = await loadHTML(COLORADO_URL);
  const description = cleanText($('h1').first().parent().text(), 1800);

  const rows = [
    normalizeCourse({
      provider: 'CU Anschutz Dental CE',
      provider_slug: 'cu-anschutz-dental-ce',
      source_url: COLORADO_URL,
      url: COLORADO_UPCOMING_URL,
      title: 'CU Anschutz School of Dental Medicine Upcoming Programs',
      description: description || 'Upcoming continuing education programs from the CU Anschutz School of Dental Medicine.',
      course_type: 'Course Catalog',
      format: 'Mixed',
      audience: 'Dentists and Dental Team',
      topic: 'General Dentistry',
      location: 'Aurora, CO / Online',
      city: 'Aurora',
      state: 'CO',
      country: 'USA',
      accreditation: 'CU Anschutz School of Dental Medicine',
      tags: ['CU Anschutz', 'General Dentistry'],
      metadata: {
        extracted_from: 'cu-anschutz-ce-page',
      },
    }),
  ];

  console.log(`   • Extracted ${rows.length} CU Anschutz Dental CE rows`);
  return rows;
}
