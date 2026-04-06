import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const PROGRAMS = [
  {
    provider: 'Osteology Research Academy Vienna',
    provider_slug: 'osteology-research-academy-vienna',
    url: 'https://www.osteology.org/en/research/research-academy/ora-vienna/',
    city: 'Vienna',
    country: 'Austria',
  },
  {
    provider: 'Osteology Research Academy London',
    provider_slug: 'osteology-research-academy-london',
    url: 'https://www.osteology.org/en/research/research-academy/ora-london/',
    city: 'London',
    country: 'United Kingdom',
  },
  {
    provider: 'Osteology Research Academy Lucerne',
    provider_slug: 'osteology-research-academy-lucerne',
    url: 'https://www.osteology.org/en/research/research-academy/ora-lucerne/',
    city: 'Lucerne',
    country: 'Switzerland',
  },
  {
    provider: 'Osteology@SOBRAPI',
    provider_slug: 'osteology-sobrapi',
    url: 'https://www.osteology.org/en/sobrapi-2026',
    country: 'Brazil',
  },
];

function cleanText(value = '', max = 2000) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function extractDateText(text = '') {
  const match = text.match(/\b\d{1,2}-\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s*20\d{2}\b/i)
    || text.match(/\b\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s*20\d{2}\b/i);
  return match ? cleanText(match[0], 120) : '';
}

function extractPrice(text = '') {
  const match = text.match(/(?:CHF|EUR|USD)\s?[\d'.,]+/i);
  return match ? cleanText(match[0], 40) : '';
}

function extractDescription($) {
  const paragraphs = $('main p, .pwr-rich-text p')
    .map((_, element) => cleanText($(element).text(), 360))
    .get()
    .filter((text) => text && !/register now|get directions|contact us|download/i.test(text));
  return paragraphs.slice(0, 3).join(' ');
}

export async function scrapeOsteologyBatch() {
  console.log('   • Scraping Osteology Foundation Europe batch');

  const rows = [];

  for (const config of PROGRAMS) {
    const $ = await loadHTML(config.url);
    const bodyText = cleanText($.root().text(), 10000);
    const title = cleanText($('h1').first().text(), 250)
      || cleanText($('title').first().text(), 250)
      || config.provider;

    rows.push(normalizeCourse({
      provider: config.provider,
      provider_slug: config.provider_slug,
      source_url: config.url,
      url: config.url,
      title,
      description: extractDescription($) || cleanText($('meta[name="description"]').attr('content') || '', 500),
      course_type: /sobrapi/i.test(config.provider) ? 'Symposium' : 'Research Academy',
      format: 'In Person',
      audience: /research/i.test(bodyText) ? 'Researchers and Clinicians' : 'Dentists',
      topic: /research academy/i.test(config.provider) ? 'Research / Regenerative Dentistry' : 'Implants',
      price: extractPrice(bodyText),
      date_text: extractDateText(bodyText),
      location: [config.city, config.country].filter(Boolean).join(', '),
      city: config.city || '',
      country: config.country || '',
      accreditation: 'Osteology Foundation',
      tags: ['Osteology Foundation', 'In Person', config.country].filter(Boolean),
      metadata: {
        extracted_from: 'osteology-program-page',
      },
    }));
  }

  console.log(`   • Extracted ${rows.length} Osteology rows`);
  return rows;
}
