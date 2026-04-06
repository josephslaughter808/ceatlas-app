import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const BUFFALO_URL = 'https://dental.buffalo.edu/alumni/continuing-education/registration.html';

function cleanText(value = '', max = 1800) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export async function scrapeBuffalo() {
  console.log('   • Scraping University at Buffalo Dental CE');

  const $ = await loadHTML(BUFFALO_URL);
  const html = $.html();
  const rows = [];

  const ongoingMatch = html.match(/Ongoing Events[\s\S]*?Opioid Prescriber Education Program[\s\S]*?Register for the Opioid Prescriber Education Program/i);
  if (ongoingMatch) {
    rows.push(normalizeCourse({
      provider: 'University at Buffalo Dental CE',
      provider_slug: 'university-at-buffalo-dental-ce',
      source_url: BUFFALO_URL,
      url: BUFFALO_URL,
      title: 'Opioid Prescriber Education Program',
      description: 'On-demand opioid prescriber education program offered through the University at Buffalo School of Dental Medicine in partnership with the UB School of Pharmacy and Pharmaceutical Sciences.',
      course_type: 'Online Course',
      format: 'Online',
      audience: 'Dentists',
      topic: 'Pharmacology',
      credits: '4',
      credits_text: '4 credits',
      location: 'Online',
      city: 'Buffalo',
      state: 'NY',
      country: 'USA',
      accreditation: 'University at Buffalo School of Dental Medicine',
      tags: ['University at Buffalo', 'Pharmacology', 'Online'],
      metadata: {
        extracted_from: 'buffalo-ce-registration-page',
      },
    }));
  }

  const upcomingMatch = html.match(/Annual John J\. Cunat Lecture[\s\S]*?Save the Date!\s*([^<]+)[\s\S]*?The Westin Buffalo[\s\S]*?Impaction Masterclass: Diagnosis, Timing, Outcomes & Pitfalls/i);
  if (upcomingMatch) {
    rows.push(normalizeCourse({
      provider: 'University at Buffalo Dental CE',
      provider_slug: 'university-at-buffalo-dental-ce',
      source_url: BUFFALO_URL,
      url: BUFFALO_URL,
      title: 'Annual John J. Cunat Lecture: Impaction Masterclass',
      description: 'Annual John J. Cunat Lecture at the University at Buffalo School of Dental Medicine featuring Impaction Masterclass: Diagnosis, Timing, Outcomes & Pitfalls.',
      course_type: 'Live Course',
      format: 'In Person',
      audience: 'Dentists and Orthodontists',
      topic: 'Orthodontics',
      date_text: cleanText(upcomingMatch[1], 120),
      location: 'The Westin Buffalo',
      city: 'Buffalo',
      state: 'NY',
      country: 'USA',
      accreditation: 'University at Buffalo School of Dental Medicine',
      tags: ['University at Buffalo', 'Orthodontics', 'In Person'],
      metadata: {
        extracted_from: 'buffalo-ce-registration-page',
      },
    }));
  }

  console.log(`   • Extracted ${rows.length} University at Buffalo Dental CE rows`);
  return rows;
}
