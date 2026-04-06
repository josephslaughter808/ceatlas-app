import { normalizeCourse } from '../../lib/normalize.js';

const PROVIDER = 'CE Zoom Dental CE';
const PROVIDER_SLUG = 'ce-zoom-dental-ce';
const SOURCE_URL = 'https://cezoom.com/courses';
const API_URL = 'https://api.cezoom.com/api/ce/v1/companies/courses/public';
const MAX_PAGES = 160;

const QUERIES = [
  {
    label: 'upcoming public courses',
    params: {
      course_type: 'All',
      upcoming: 'true',
    },
  },
  {
    label: 'public self-study courses',
    params: {
      course_type: 'Self Study/On Demand Course',
    },
  },
];

function cleanText(value = '', max = 1200) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function slugify(value = '') {
  return cleanText(value, 140)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isoDate(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';

  const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    return year > 1900 ? isoMatch[0] : '';
  }

  const slashMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getUTCFullYear();
  return year > 1900 ? parsed.toISOString().slice(0, 10) : '';
}

function listNames(values = []) {
  return Array.isArray(values)
    ? values.map((item) => cleanText(item?.name || item, 160)).filter(Boolean)
    : [];
}

function hasDentalIndustry(row = {}) {
  const industries = listNames(row.industries);
  if (industries.some((name) => /dentistry/i.test(name))) return true;

  const haystack = [
    row.name,
    row.company?.name,
    ...listNames(row.topics),
    ...listNames(row.registration_categories),
  ].join(' ');

  return /\b(dental|dentist|dentistry|hygien|oral|periodont|implant|orthodont|endodont|prosthodont)\b/i.test(haystack);
}

function isPublicSearchable(row = {}) {
  return row.active && row.registration?.basic_information?.allow_course_to_be_searchable !== false && hasDentalIndustry(row);
}

function courseTypeFor(row = {}) {
  return cleanText(row.course_type?.select_type?.type_selected || '', 120) || 'Dental CE Course';
}

function isSelfStudy(row = {}) {
  return /self study|on demand/i.test(courseTypeFor(row));
}

function formatFor(row = {}) {
  if (isSelfStudy(row)) return 'Online';

  const offering = cleanText(row.course_type?.course_method?.live_offering_option || '', 80).toLowerCase();
  if (/virtual|online|webinar/.test(offering)) return 'Online';
  if (/in person.*virtual|virtual.*in person|hybrid/.test(offering)) return 'Hybrid';
  if (/in person/.test(offering)) return 'In Person';
  return 'Online';
}

function locationFor(row = {}) {
  if (formatFor(row) === 'Online') return 'Online';

  const countries = listNames(row.countries);
  return countries[0] || 'See course page';
}

function creditsFor(row = {}) {
  const value = row.course_wizard?.basic_course_information?.total_credit_hours?.result;
  if (value === null || value === undefined || value === '') return '';
  return `${value} Credits`;
}

function priceFor(row = {}) {
  const registration = row.registration?.basic_information || {};
  if (registration.is_a_free_course) return 'Free';
  return registration.collecting_fees_from_cezoom ? 'Paid registration' : '';
}

function dateFieldsFor(row = {}) {
  const info = row.course_wizard?.basic_course_information || {};
  const dateInfo = info.info_dates || {};
  const type = courseTypeFor(row);
  const releaseDate = isoDate(info.release_date);
  const expiryDate = isoDate(info.valid_until_date || info.expiry_date);
  const liveDate = isoDate(dateInfo.date || row.date);

  if (isSelfStudy(row)) {
    return {
      start_date: '',
      end_date: expiryDate,
      date_text: [
        releaseDate ? `Release Date: ${releaseDate}` : '',
        expiryDate ? `Expiration Date: ${expiryDate}` : '',
      ].filter(Boolean).join(' • '),
    };
  }

  return {
    start_date: liveDate,
    end_date: liveDate,
    date_text: [
      liveDate,
      dateInfo.startTime && dateInfo.endTime ? `${dateInfo.startTime}-${dateInfo.endTime}` : '',
      dateInfo.timeZone || '',
      type,
    ].filter(Boolean).join(' • '),
  };
}

function inferTopic(row = {}) {
  const topics = listNames(row.topics);
  const haystack = `${topics.join(' ')} ${row.name || ''}`.toLowerCase();

  if (/implant/.test(haystack)) return 'Implants';
  if (/endodont|root canal/.test(haystack)) return 'Endodontics';
  if (/orthodont|aligner/.test(haystack)) return 'Orthodontics';
  if (/periodont|gingiv|soft tissue/.test(haystack)) return 'Periodontics';
  if (/sleep|airway/.test(haystack)) return 'Sleep & Airway';
  if (/infection|osha/.test(haystack)) return 'Infection Control';
  if (/radiograph|imaging|digital|cad|cam/.test(haystack)) return 'Digital Dentistry & Technology';
  if (/practice|business|coding|billing|office/.test(haystack)) return 'Practice Management & Business';
  if (/hygien|prevent|public|community/.test(haystack)) return 'Dental Hygiene';
  if (/esthetic|aesthetic|restor|composite|crown|veneer/.test(haystack)) return 'Restorative Dentistry';
  return topics[0] || 'General Dentistry';
}

function descriptionFor(row = {}) {
  const details = cleanText(row.course_wizard?.course_details?.learning_objectives || '', 1800);
  const company = cleanText(row.company?.name || '', 160);

  if (details) return details;
  return `${row.name} is listed in CE Zoom's public dental CE course catalog.${company ? ` Provider on CE Zoom: ${company}.` : ''}`;
}

function urlFor(row = {}) {
  if (!row.id) return SOURCE_URL;
  return `https://cezoom.com/company/landing-page/courses/${row.id}/${slugify(row.name || row.id)}`;
}

function normalizeCEZoomRow(row = {}, sourceQuery = '') {
  const dates = dateFieldsFor(row);
  const topics = listNames(row.topics);
  const registrationCategories = listNames(row.registration_categories);
  const company = cleanText(row.company?.name || '', 160);

  return normalizeCourse({
    provider: PROVIDER,
    provider_slug: PROVIDER_SLUG,
    source_url: SOURCE_URL,
    url: urlFor(row),
    title: row.name,
    description: descriptionFor(row),
    course_type: courseTypeFor(row),
    format: formatFor(row),
    audience: 'Dentists and Dental Team',
    topic: inferTopic(row),
    credits_text: creditsFor(row),
    price: priceFor(row),
    ...dates,
    location: locationFor(row),
    country: listNames(row.countries)[0] || 'USA',
    instructors: listNames(row.course_wizard?.basic_course_information?.presenters).join('\n'),
    accreditation: listNames(row.course_wizard?.course_details?.providers_info).join(', ') || 'CE Zoom',
    tags: ['CE Zoom', company, ...topics, ...registrationCategories].filter(Boolean),
    metadata: {
      extracted_from: sourceQuery,
      cezoom_id: row.id || null,
      company: company || null,
      topics,
      registration_categories: registrationCategories,
      public_searchable: row.registration?.basic_information?.allow_course_to_be_searchable ?? null,
      free_course: row.registration?.basic_information?.is_a_free_course ?? null,
    },
  });
}

async function fetchPage(query, page) {
  const url = new URL(API_URL);
  url.searchParams.set('page', String(page));
  url.searchParams.set('search', '');
  url.searchParams.set('past_courses', 'false');
  url.searchParams.set('active', 'true');

  for (const [key, value] of Object.entries(query.params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      Origin: 'https://cezoom.com',
      Referer: SOURCE_URL,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`CE Zoom API returned ${response.status} for ${url.href}`);
  }

  return response.json();
}

export async function scrapeCEZoom() {
  console.log(`   • Scraping ${PROVIDER}`);
  const rows = [];
  const seen = new Set();

  for (const query of QUERIES) {
    let page = 1;
    let pages = 1;

    do {
      const json = await fetchPage(query, page);
      pages = Math.min(json.pages || 1, MAX_PAGES);

      for (const apiRow of json.data || []) {
        if (!isPublicSearchable(apiRow)) continue;

        const row = normalizeCEZoomRow(apiRow, query.label);
        const key = apiRow.id || `${row.title}::${row.url}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(row);
      }

      page += 1;
    } while (page <= pages);
  }

  console.log(`   • Extracted ${rows.length} ${PROVIDER} rows before current/future filtering`);
  return rows;
}
