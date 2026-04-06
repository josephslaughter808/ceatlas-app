import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const SOURCE_URL = 'https://dental.tufts.edu/continuing-education/global-academy';

function cleanText(value = '', max = 2000) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

const EUROPE_ROWS = [
  {
    provider: 'Tufts Global Academy Greece Implant Curriculum',
    provider_slug: 'tufts-global-academy-greece-implant-curriculum',
    title: 'Continuing Education Conjoint Curriculum in Dental Implants 2026',
    url: 'https://reg.learningstream.com/reg/event_page.aspx?ek=0057-0020-073755b055614fdc914400154dcf2d94',
    date_text: 'March 6 - November 21, 2026',
    start_date: '2026-03-06',
    end_date: '2026-11-21',
    location: 'Greece',
    country: 'Greece',
    topic: 'Implants',
  },
  {
    provider: 'Tufts Global Symposium Italy Bruxism',
    provider_slug: 'tufts-global-symposium-italy-bruxism',
    title: 'Tufts Global Symposium: Bruxism - Interdisciplinary Perspectives',
    url: 'https://reg.learningstream.com/reg/event_page.aspx?ek=0057-0020-6a6467c39c8542ea9670465063e05122',
    date_text: 'June 20, 2026',
    start_date: '2026-06-20',
    end_date: '2026-06-20',
    location: 'Italy',
    country: 'Italy',
    topic: 'TMD / Occlusion',
  },
  {
    provider: 'Tufts AI Implantology Italy',
    provider_slug: 'tufts-ai-implantology-italy',
    title: 'Artificial Intelligence and the Digital Ecosystem in Implantology: From Smile Design to Surgical Precision',
    url: 'https://reg.learningstream.com/reg/event_page.aspx?ek=0057-0020-4775165cfd9444a5b590ef992f81394d',
    date_text: 'June 25, 2026',
    start_date: '2026-06-25',
    end_date: '2026-06-25',
    location: 'Italy',
    country: 'Italy',
    topic: 'Digital Dentistry & Technology',
  },
  {
    provider: 'Tufts 4th Global Symposium Implant Dentistry Italy',
    provider_slug: 'tufts-4th-global-symposium-implant-dentistry-italy',
    title: '4th Global Symposium on Implant Dentistry 2026',
    url: 'https://reg.learningstream.com/reg/event_page.aspx?ek=0057-0020-40b8a3ffd65b467f9d1495d9a2537df8',
    date_text: 'June 26-27, 2026',
    start_date: '2026-06-26',
    end_date: '2026-06-27',
    location: 'Italy',
    country: 'Italy',
    topic: 'Implants',
  },
];

export async function scrapeTuftsGlobalEurope() {
  console.log('   • Scraping Tufts Global Academy Europe');

  const $ = await loadHTML(SOURCE_URL);
  const description = cleanText($('meta[name="description"]').attr('content') || $('main').text(), 1200);

  const rows = EUROPE_ROWS.map((course) => normalizeCourse({
    provider: course.provider,
    provider_slug: course.provider_slug,
    source_url: SOURCE_URL,
    url: course.url,
    title: course.title,
    description,
    course_type: /curriculum/i.test(course.title) ? 'Curriculum' : 'Symposium',
    format: 'In Person',
    audience: 'Dentists',
    topic: course.topic,
    date_text: course.date_text,
    start_date: course.start_date,
    end_date: course.end_date,
    location: course.location,
    country: course.country,
    accreditation: 'Tufts University School of Dental Medicine',
    tags: ['Tufts', 'Global Academy', 'Europe', course.country, course.topic].filter(Boolean),
    metadata: {
      extracted_from: 'tufts-global-academy-page',
    },
  }));

  console.log(`   • Extracted ${rows.length} Tufts Global Academy Europe rows`);
  return rows;
}
