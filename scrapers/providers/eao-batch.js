import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const PROGRAMS = [
  {
    provider: 'EAO Focused Training',
    provider_slug: 'eao-focused-training',
    url: 'https://eao.org/education/focused-training/',
    topic: 'Implants',
    format: 'In Person',
    course_type: 'Hands-On Course',
    city: 'Lisbon',
    country: 'Portugal',
  },
  {
    provider: 'EAO Expert Clinician Course',
    provider_slug: 'eao-expert-clinician-course',
    url: 'https://eao.org/education/expert-clinician-course/',
    topic: 'Implants',
    format: 'In Person',
    course_type: 'Course',
  },
  {
    provider: 'EAO My First Implant',
    provider_slug: 'eao-my-first-implant',
    url: 'https://eao.org/education/my-first-implant/',
    topic: 'Implants',
    format: 'In Person',
    course_type: 'Course',
  },
  {
    provider: 'EAO First Certificate in Implant Dentistry',
    provider_slug: 'eao-first-certificate-implant-dentistry',
    url: 'https://eao.org/education/the-eao-certificates-in-implant-dentistry/',
    title: 'The EAO First Certificate in Implant Dentistry',
    topic: 'Implants',
    format: 'Online',
    course_type: 'Certificate Program',
  },
  {
    provider: 'EAO Second Certificate in Implant Dentistry',
    provider_slug: 'eao-second-certificate-implant-dentistry',
    url: 'https://eao.org/education/the-eao-certificates-in-implant-dentistry/',
    title: 'The EAO Second Certificate in Implant Dentistry',
    topic: 'Implants',
    format: 'Online',
    course_type: 'Certificate Program',
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
  const match = text.match(/\b\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s*20\d{2}\s*-\s*\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s*20\d{2}\b/i)
    || text.match(/\b\d{1,2}-\d{1,2}\s*(?:April|May|June|July|August|September|October|November|December)\s*20\d{2}\b/i)
    || text.match(/\bStarting in\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}\b/i);
  return match ? cleanText(match[0], 120) : '';
}

function extractPrice(text = '', fallback = '') {
  const match = text.match(/€\s?[\d,.]+/);
  return match ? cleanText(match[0], 40) : fallback;
}

function extractCertificatePrice(text = '', startLabel = '') {
  const index = text.toLowerCase().indexOf(startLabel.toLowerCase());
  if (index === -1) return '';
  const chunk = text.slice(index, index + 900);
  const matches = [...chunk.matchAll(/€\s?[\d,.]+/g)].map((entry) => cleanText(entry[0], 40));
  return matches[0] || '';
}

function extractDescription($) {
  const paragraphs = $('main p, article p, .entry-content p, .wp-block-post-content p')
    .map((_, element) => cleanText($(element).text(), 320))
    .get()
    .filter((text) => text && !/register now|view general terms|contact us/i.test(text));
  return paragraphs.slice(0, 3).join(' ');
}

function extractAudience(text = '') {
  if (/international/i.test(text)) return 'International';
  if (/national/i.test(text)) return 'National';
  if (/clinicians|dentists/i.test(text)) return 'Dentists';
  return 'Dentists';
}

function normalizeProgram(config, $, html) {
  const bodyText = cleanText($.root().text(), 8000);
  const title = config.title || cleanText($('h1').first().text(), 250) || cleanText($('title').first().text(), 250);
  const description = extractDescription($) || cleanText($('meta[name="description"]').attr('content') || '', 500);
  const dateText = extractDateText(bodyText);

  if (config.provider_slug === 'eao-first-certificate-implant-dentistry') {
    return normalizeCourse({
      ...config,
      source_url: config.url,
      url: config.url,
      title,
      description: description || 'Online foundational implant dentistry certificate from EAO.',
      audience: extractAudience(bodyText),
      date_text: dateText || 'Starting in January 2026',
      start_date: '2026-01-01',
      price: extractCertificatePrice(bodyText, 'first certificate') || '€890',
      location: 'Online',
      accreditation: 'European Association for Osseointegration',
      tags: ['EAO', 'Online', 'Certificate', 'Implants'],
      metadata: { extracted_from: 'eao-certificate-page' },
    });
  }

  if (config.provider_slug === 'eao-second-certificate-implant-dentistry') {
    return normalizeCourse({
      ...config,
      source_url: config.url,
      url: config.url,
      title,
      description: description || 'Online advanced implant dentistry certificate from EAO.',
      audience: extractAudience(bodyText),
      date_text: dateText || 'Starting in January 2026',
      start_date: '2026-01-01',
      price: extractCertificatePrice(bodyText, 'second certificate') || '€990',
      location: 'Online',
      accreditation: 'European Association for Osseointegration',
      tags: ['EAO', 'Online', 'Certificate', 'Implants'],
      metadata: { extracted_from: 'eao-certificate-page' },
    });
  }

  return normalizeCourse({
    ...config,
    source_url: config.url,
    url: config.url,
    title,
    description: description || cleanText($('meta[name="description"]').attr('content') || '', 500),
    audience: extractAudience(bodyText),
    date_text: dateText,
    price: extractPrice(bodyText),
    location: config.city && config.country ? `${config.city}, ${config.country}` : cleanText((bodyText.match(/\b[A-Z][a-z]+,\s+[A-Z][a-z]+\b/) || [])[0] || '', 120),
    accreditation: 'European Association for Osseointegration',
    tags: ['EAO', config.format, config.topic].filter(Boolean),
    metadata: {
      extracted_from: 'eao-program-page',
      html_length: html.length,
    },
  });
}

export async function scrapeEAOBatch() {
  console.log('   • Scraping EAO Europe education batch');

  const rows = [];

  for (const config of PROGRAMS) {
    const $ = await loadHTML(config.url);
    const html = $.html();
    rows.push(normalizeProgram(config, $, html));
  }

  console.log(`   • Extracted ${rows.length} EAO batch rows`);
  return rows;
}
