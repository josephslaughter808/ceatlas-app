import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const UKY_URL = 'https://dentistry.uky.edu/education/continuing-education';
const UKY_CALENDAR_URL = 'https://reg.learningstream.com/view/cal4a.aspx?ek=&ref=&aa=0&sid1=0&sid2=0&as=20&wp=74&tz=0&ms=0&nav=0&cc=0&cat1=0&cat2=0&cat3=0&aid=UKCOD&rf=&pn=0';

const UKY_CONFIGS = [
  {
    heading: 'Upcoming Courses',
    provider: 'University of Kentucky Continuing Education',
    provider_slug: 'university-kentucky-continuing-education',
    title: 'University of Kentucky Continuing Education Upcoming Courses',
    url: UKY_CALENDAR_URL,
    topic: 'General Dentistry',
  },
  {
    heading: 'Dental Professional Courses',
    provider: 'University of Kentucky Dental Professional CE',
    provider_slug: 'university-kentucky-dental-professional-ce',
    title: 'University of Kentucky Dental Professional Courses',
    url: UKY_CALENDAR_URL,
    topic: 'General Dentistry',
  },
  {
    heading: 'Hygienist Courses',
    provider: 'University of Kentucky Hygienist CE',
    provider_slug: 'university-kentucky-hygienist-ce',
    title: 'University of Kentucky Hygienist Courses',
    url: UKY_CALENDAR_URL,
    topic: 'Dental Hygiene',
  },
  {
    heading: 'Dental Assistant Courses',
    provider: 'University of Kentucky Dental Assistant CE',
    provider_slug: 'university-kentucky-dental-assistant-ce',
    title: 'University of Kentucky Dental Assistant Courses',
    url: UKY_CALENDAR_URL,
    topic: 'Dental Assisting',
  },
];

function cleanText(value = '', max = 1600) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export async function scrapeUKYBatch() {
  console.log('   • Scraping University of Kentucky CE batch');

  const $ = await loadHTML(UKY_URL);
  const rows = [];

  for (const config of UKY_CONFIGS) {
    let description = '';
    const heading = $('h2, h3').filter((_, element) => cleanText($(element).text(), 120) === config.heading).first();

    if (heading.length) {
      const body = heading.parent().next().find('p').map((_, p) => cleanText($(p).text(), 400)).get();
      description = body.join(' ').slice(0, 1600);
    }

    if (!description && config.heading === 'Upcoming Courses') {
      description = 'Browse current University of Kentucky College of Dentistry continuing education offerings and register through the official LearningStream calendar.';
    }

    if (!description) {
      description = `${config.title} are published by the University of Kentucky College of Dentistry continuing education office.`;
    }

    rows.push(normalizeCourse({
      provider: config.provider,
      provider_slug: config.provider_slug,
      source_url: UKY_URL,
      url: config.url,
      title: config.title,
      description,
      course_type: 'Course Catalog',
      format: 'Mixed',
      audience: 'Dentists and Dental Team',
      topic: config.topic,
      location: 'Lexington, KY / Online',
      city: 'Lexington',
      state: 'KY',
      country: 'USA',
      accreditation: 'University of Kentucky College of Dentistry',
      tags: ['University of Kentucky', config.topic].filter(Boolean),
      metadata: {
        extracted_from: 'uky-ce-page',
      },
    }));
  }

  console.log(`   • Extracted ${rows.length} University of Kentucky batch rows`);
  return rows;
}
