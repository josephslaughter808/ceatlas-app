import * as cheerio from 'cheerio';
import { normalizeCourse } from '../../lib/normalize.js';

const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

const PARTNERS = [
  {
    provider: 'Kulzer Learning',
    providerSlug: 'kulzer-learning',
    baseUrl: 'https://kulzerlearning.com',
    country: 'USA',
  },
  {
    provider: 'SDI Learning',
    providerSlug: 'sdi-learning',
    baseUrl: 'https://www.sdilearning.com',
    country: 'USA',
  },
  {
    provider: 'VOCO Learning',
    providerSlug: 'voco-learning',
    baseUrl: 'https://vocolearning.com',
    country: 'USA',
  },
  {
    provider: 'Shofu Learning',
    providerSlug: 'shofu-learning',
    baseUrl: 'https://shofulearning.com',
    country: 'USA',
  },
  {
    provider: 'DentalEZ Learning',
    providerSlug: 'dentalez-learning',
    baseUrl: 'https://www.dentalezlearning.com',
    country: 'USA',
  },
  {
    provider: 'Air Techniques Learning',
    providerSlug: 'air-techniques-learning',
    baseUrl: 'https://airtechniqueslearning.com',
    country: 'USA',
  },
  {
    provider: 'BISCO Learning',
    providerSlug: 'bisco-learning',
    baseUrl: 'https://biscolearning.com',
    country: 'USA',
  },
  {
    provider: 'GC America Training',
    providerSlug: 'gc-america-training',
    baseUrl: 'https://gcatraining.com',
    country: 'USA',
  },
  {
    provider: 'Coltene Learning',
    providerSlug: 'coltene-learning',
    baseUrl: 'https://coltenelearning.com',
    country: 'USA',
  },
  {
    provider: 'Kuraray Dental Learning',
    providerSlug: 'kuraray-dental-learning',
    baseUrl: 'https://kuraraydentallearning.com',
    country: 'USA',
  },
  {
    provider: 'Septodont Learning',
    providerSlug: 'septodont-learning',
    baseUrl: 'https://septodontlearning.com',
    country: 'USA',
  },
  {
    provider: 'Pulpdent Learning',
    providerSlug: 'pulpdent-learning',
    baseUrl: 'https://www.pulpdentlearning.com',
    country: 'USA',
  },
  {
    provider: 'DMG Learning',
    providerSlug: 'dmg-learning',
    baseUrl: 'https://dmglearning.com',
    country: 'USA',
  },
];

function cleanText(value = '', max = 1800) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = '') {
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function toCenturyIsoDate(value = '') {
  const match = cleanText(value, 40).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return '';
  const [, month, day, rawYear] = match;
  const numericYear = Number(rawYear);
  const year = rawYear.length === 2 ? 2000 + numericYear : numericYear;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function extractField(text = '', label = '', nextLabels = []) {
  const labelPattern = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nextPattern = nextLabels
    .filter((candidate) => candidate !== label)
    .map((candidate) => candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const pattern = nextPattern
    ? new RegExp(`${labelPattern}\\s*(.*?)(?=\\s*(?:${nextPattern})|$)`, 'i')
    : new RegExp(`${labelPattern}\\s*(.*)$`, 'i');
  return cleanText(text.match(pattern)?.[1] || '', 500);
}

function inferTopic(text = '') {
  const value = cleanText(text, 2000).toLowerCase();
  if (/implant|peri-implant|graft/.test(value)) return 'Implants';
  if (/endo|root canal/.test(value)) return 'Endodontics';
  if (/periodont|perio|hygiene|biofilm/.test(value)) return 'Periodontics';
  if (/infection|osha|aerosol|waterline|steriliz|compliance/.test(value)) return 'Infection Control';
  if (/bond|adhesive|composite|restorative|restoration|veneer|cement|ceramic|zirconia|crown/.test(value)) return 'Restorative Dentistry';
  if (/digital|cad\/cam|scan|photography/.test(value)) return 'Digital Dentistry & Technology';
  if (/whitening|bleaching|esthetic|aesthetic/.test(value)) return 'Esthetics & Facial Esthetics';
  if (/sleep|airway|tmj|tmd|orofacial/.test(value)) return 'Sleep & Airway';
  if (/practice|team|communication|marketing/.test(value)) return 'Practice Management & Business';
  if (/pharmac|anesthetic|opioid|antibiotic/.test(value)) return 'Pharmacology';
  return 'General Dentistry';
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      'User-Agent': BROWSER_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Viva partner returned ${response.status} for ${url}`);
  }

  return response.text();
}

function parsePartnerRows(partner, html = '') {
  const $ = cheerio.load(html);
  const rows = [];
  const seen = new Set();
  const sourceUrl = `${partner.baseUrl}/training.asp`;
  const labels = ['Presenter:', 'CE Credits:', 'Release Date:'];

  $('a[href*="classroom.asp?x_classID="]').each((_, link) => {
    const href = $(link).attr('href') || '';
    const url = absoluteUrl(href, partner.baseUrl);
    if (!url || seen.has(url)) return;

    const title = cleanText($(link).text(), 250);
    if (!title || /^enter class$/i.test(title)) return;
    seen.add(url);
    const classId = new URL(url).searchParams.get('x_classID') || '';

    const row = $(link).closest('tr');
    const rowText = cleanText(row.text(), 1200);
    const description = cleanText(row.next('tr').text(), 1800);
    const presenter = extractField(rowText, 'Presenter:', labels);
    const creditsText = extractField(rowText, 'CE Credits:', labels);
    const releaseDate = extractField(rowText, 'Release Date:', labels);

    rows.push(normalizeCourse({
      provider: partner.provider,
      provider_slug: partner.providerSlug,
      source_url: sourceUrl,
      url,
      title,
      description: description || `${title} is listed in ${partner.provider}'s public on-demand dental CE catalog.`,
      course_type: 'On-Demand Webinar',
      format: 'Online',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${title} ${description}`),
      credits_text: creditsText,
      price: 'Free',
      start_date: toCenturyIsoDate(releaseDate),
      end_date: '',
      date_text: releaseDate ? `Release Date: ${releaseDate}` : 'On-demand',
      location: 'Online',
      country: partner.country || 'USA',
      instructors: presenter,
      accreditation: partner.provider,
      tags: [partner.provider, 'Online', 'On Demand', inferTopic(`${title} ${description}`)].filter(Boolean),
      metadata: {
        extracted_from: 'viva-powered-partner-training-page',
        class_id: classId || null,
      },
    }));
  });

  return rows;
}

async function scrapePartner(partner) {
  const sourceUrl = `${partner.baseUrl}/training.asp`;
  try {
    const html = await fetchText(sourceUrl);
    const rows = parsePartnerRows(partner, html);
    console.log(`      • ${partner.provider}: ${rows.length} rows`);
    return rows;
  } catch (error) {
    console.log(`      ⚠️ ${partner.provider} skipped: ${error.message}`);
    return [];
  }
}

export async function scrapeVivaPartnerLearning() {
  console.log('   • Scraping Viva-powered partner learning sites');
  const nested = await Promise.all(PARTNERS.map(scrapePartner));
  const rows = nested.flat();
  console.log(`   • Extracted ${rows.length} Viva-powered partner rows`);
  return rows;
}
