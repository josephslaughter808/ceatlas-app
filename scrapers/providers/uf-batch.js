import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const UF_AGD_URL = 'https://ce.dental.ufl.edu/agd-mastertrack/schedule/';

const UF_PROGRAMS = [
  {
    provider: 'University of Florida Fundamentals of Dental Assisting CE',
    provider_slug: 'uf-fundamentals-dental-assisting-ce',
    url: 'https://ce.dental.ufl.edu/professional-career-path-dental-team/fundamentals-of-dental-assisting/',
    topic: 'Dental Assisting',
  },
  {
    provider: 'University of Florida Dental Radiology CE',
    provider_slug: 'uf-dental-radiology-ce',
    url: 'https://ce.dental.ufl.edu/professional-career-path-dental-team/radiology-for-dental-auxiliary/',
    topic: 'Dental Radiology',
  },
  {
    provider: 'University of Florida Expanded Functions CE',
    provider_slug: 'uf-expanded-functions-ce',
    url: 'https://ce.dental.ufl.edu/professional-career-path-dental-team/expanded-functions-for-dental-auxiliary/',
    topic: 'Dental Assisting',
  },
  {
    provider: 'University of Florida Orthodontic Assistant CE',
    provider_slug: 'uf-orthodontic-assistant-ce',
    url: 'https://ce.dental.ufl.edu/professional-career-path-dental-team/orthodontic-assiatant-training-course/',
    topic: 'Orthodontics',
  },
  {
    provider: 'University of Florida Dental Surgical Assistant CE',
    provider_slug: 'uf-dental-surgical-assistant-ce',
    url: 'https://ce.dental.ufl.edu/professional-career-path-dental-team/dental-surgical-assistant/',
    topic: 'Oral Surgery',
  },
  {
    provider: 'University of Florida Local Anesthesia Hygiene CE',
    provider_slug: 'uf-local-anesthesia-hygiene-ce',
    url: 'https://ce.dental.ufl.edu/professional-career-path-dental-team/local-anesthesia-for-todays-dental-hygienist/',
    topic: 'Dental Hygiene',
  },
  {
    provider: 'University of Florida Restorative Functions CE',
    provider_slug: 'uf-restorative-functions-ce',
    url: 'https://ce.dental.ufl.edu/professional-career-path-dental-team/restorative-functions-for-dental-assistants-and-hygienists-2/',
    topic: 'Restorative Dentistry',
  },
  {
    provider: 'University of Florida Perio Refresher CE',
    provider_slug: 'uf-perio-refresher-ce',
    url: 'https://ce.dental.ufl.edu/professional-career-path-dental-team/perio-refresher/',
    topic: 'Periodontics',
  },
  {
    provider: 'University of Florida Local Anesthesia Refresher CE',
    provider_slug: 'uf-local-anesthesia-refresher-ce',
    url: 'https://ce.dental.ufl.edu/professional-career-path-dental-team/la-refresher/',
    topic: 'Dental Hygiene',
  },
];

function cleanText(value = '', max = 2000) {
  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function extractParagraphs($) {
  const parts = [];
  $('.entry-content p, .PageContent p, .field--name-body p').each((_, element) => {
    const text = cleanText($(element).text(), 450);
    if (!text) return;
    if (/ada cerp|refund|cancellation|contact us|questions/i.test(text)) return;
    parts.push(text);
  });
  return parts;
}

function extractDateText(text = '') {
  const match = text.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)[^.!?]{0,80}\b20\d{2}\b/i);
  return match ? cleanText(match[0], 180) : '';
}

function extractCredits(text = '') {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:CEU|CEUs|CE credits?|credit hours?)/i);
  return match ? match[1] : '';
}

function extractPrice(text = '') {
  const match = text.match(/\$\s?[\d,]+(?:\.\d{2})?/);
  return match ? match[0].replace(/\s+/g, '') : '';
}

function inferFormat(text = '') {
  const value = cleanText(text, 500).toLowerCase();
  if (/online|self-study|web-based|recorded|webinar/.test(value)) return 'Online';
  if (/hybrid/.test(value)) return 'Hybrid';
  return 'In Person';
}

function inferCourseType(text = '') {
  const value = cleanText(text, 500).toLowerCase();
  if (/webinar|online|self-study|recorded|web-based/.test(value)) return 'Online Course';
  if (/hands-on/.test(value)) return 'Hands-On Course';
  return 'Live Course';
}

function buildSinglePageRow(config, $, pageUrl) {
  const title = cleanText($('h1').first().text(), 250) || cleanText($('title').first().text(), 250);
  const paragraphs = extractParagraphs($);
  const description = paragraphs.slice(0, 3).join(' ').slice(0, 1800);
  const bodyText = [title, description, paragraphs.join(' ')].filter(Boolean).join(' ');
  const credits = extractCredits(bodyText);
  const dateText = extractDateText(bodyText);
  const price = extractPrice(bodyText);

  return normalizeCourse({
    provider: config.provider,
    provider_slug: config.provider_slug,
    source_url: pageUrl,
    url: pageUrl,
    title,
    description: description || `${title} offered through the University of Florida College of Dentistry continuing education program.`,
    course_type: inferCourseType(bodyText),
    format: inferFormat(bodyText),
    audience: 'Dentists and Dental Team',
    topic: config.topic,
    credits,
    credits_text: credits ? `${credits} credits` : '',
    price,
    date_text: dateText,
    location: inferFormat(bodyText) === 'Online' ? 'Online' : 'Gainesville, FL',
    city: 'Gainesville',
    state: 'FL',
    country: 'USA',
    accreditation: 'University of Florida College of Dentistry',
    tags: ['University of Florida', config.topic, inferFormat(bodyText)].filter(Boolean),
    metadata: {
      extracted_from: 'uf-program-page',
    },
  });
}

function parseAGDSummary(summary = '') {
  const text = cleanText(summary, 300);
  const parts = text.split('|').map((part) => part.trim()).filter(Boolean);
  const dateText = parts.shift() || '';
  const credits = [];
  const topics = [];

  for (const part of parts) {
    const creditMatch = part.match(/(.+?):\s*(\d+(?:\.\d+)?)\s*CEU/i);
    if (creditMatch) {
      topics.push(cleanText(creditMatch[1], 120));
      credits.push(`${cleanText(creditMatch[1], 120)}: ${creditMatch[2]} CEU`);
      continue;
    }
    if (!/at the/i.test(part)) {
      topics.push(cleanText(part, 120));
    }
  }

  return {
    dateText,
    creditsText: credits.join(' • '),
    titleSuffix: topics.join(' / ') || 'MasterTrack Session',
  };
}

function extractYearFromDateText(dateText = '') {
  const match = dateText.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

export async function scrapeUFBatch() {
  console.log('   • Scraping University of Florida CE program batch');

  const rows = [];

  for (const config of UF_PROGRAMS) {
    const $ = await loadHTML(config.url);
    const row = buildSinglePageRow(config, $, config.url);
    if (row.title && row.url) {
      rows.push(row);
    }
  }

  const $agd = await loadHTML(UF_AGD_URL);
  $agd('details.wp-block-ufhealth-apollo-details').each((_, element) => {
    const summary = cleanText($agd(element).find('summary').first().text(), 320);
    const description = cleanText($agd(element).find('.details-content').text(), 1800);
    const parsed = parseAGDSummary(summary);
    const year = extractYearFromDateText(parsed.dateText);
    if (year && year < new Date().getFullYear()) return;

    rows.push(normalizeCourse({
      provider: 'University of Florida AGD MasterTrack',
      provider_slug: 'uf-agd-mastertrack',
      source_url: UF_AGD_URL,
      url: UF_AGD_URL,
      title: `UF AGD MasterTrack: ${parsed.titleSuffix}`,
      description: description || `University of Florida AGD MasterTrack session: ${parsed.titleSuffix}.`,
      course_type: /graduation/i.test(parsed.titleSuffix) ? 'Program Session' : 'Live Course',
      format: 'In Person',
      audience: 'Dentists',
      topic: /periodont/i.test(parsed.titleSuffix)
        ? 'Periodontics'
        : /ortho/i.test(parsed.titleSuffix)
          ? 'Orthodontics'
          : /esthetic/i.test(parsed.titleSuffix)
            ? 'Esthetics & Facial Esthetics'
            : /oral surgery/i.test(parsed.titleSuffix)
              ? 'Oral Surgery'
              : /pharmacology|orofacial pain/i.test(parsed.titleSuffix)
                ? 'Pharmacology'
                : 'General Dentistry',
      credits_text: parsed.creditsText,
      date_text: parsed.dateText,
      location: /seminole/i.test(summary + description) ? 'Seminole, FL' : 'Gainesville, FL',
      city: /seminole/i.test(summary + description) ? 'Seminole' : 'Gainesville',
      state: 'FL',
      country: 'USA',
      accreditation: 'University of Florida College of Dentistry',
      tags: ['University of Florida', 'AGD MasterTrack'],
      metadata: {
        extracted_from: 'uf-agd-mastertrack-schedule',
      },
    }));
  });

  console.log(`   • Extracted ${rows.length} University of Florida batch rows`);
  return rows;
}
