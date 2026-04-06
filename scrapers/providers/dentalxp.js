import { normalizeCourse } from '../../lib/normalize.js';

const PROVIDER = 'DentalXP';
const PROVIDER_SLUG = 'dentalxp';
const SOURCE_URL = 'https://www.dentalxp.com/sitemap.xml';
const BASE_URL = 'https://www.dentalxp.com';
const DETAIL_CONCURRENCY = 8;
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

function cleanText(value = '', max = 1800) {
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

function absoluteUrl(value = '') {
  if (!value) return '';
  try {
    return new URL(value, BASE_URL).href;
  } catch {
    return '';
  }
}

function dateToISO(value = '') {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function inferTopic(text = '') {
  const value = cleanText(text, 1200).toLowerCase();
  if (/implant|guided surgery|bone graft|ridge augmentation/.test(value)) return 'Implants';
  if (/endodont|root canal/.test(value)) return 'Endodontics';
  if (/orthodont|aligner/.test(value)) return 'Orthodontics';
  if (/periodont|gingiv|soft tissue|graft/.test(value)) return 'Periodontics';
  if (/oral surgery|extraction|sinus lift|surgical/.test(value)) return 'Oral Surgery';
  if (/sleep|airway/.test(value)) return 'Sleep & Airway';
  if (/digital|cad|cam|3d|scan|cbct|technology/.test(value)) return 'Digital Dentistry & Technology';
  if (/esthetic|aesthetic|veneer|smile design|composite|ceramic|restorative/.test(value)) return 'Restorative Dentistry';
  if (/occlusion|tmj|tmd/.test(value)) return 'Occlusion & TMD';
  if (/hygiene|prevention|caries/.test(value)) return 'Dental Hygiene';
  if (/practice|business|team|communication/.test(value)) return 'Practice Management & Business';
  return 'General Dentistry';
}

function extractCourseUrls(xml = '') {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)]
    .map((match) => match[1].trim())
    .filter((url) => /dentalxp\.com\/catalogue\/category\/.+\/course\//i.test(url))
    .map((url) => url.replace(/^https:\/\/dentalxp\.com/i, BASE_URL));
}

function unescapePayloadValue(value = '') {
  return String(value || '')
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\\//g, '/');
}

function firstCourseFragment(html = '') {
  const markerIndex = html.indexOf('\\"course\\":{\\"course_id\\"');
  if (markerIndex < 0) return '';

  const nextSectionIndex = html.indexOf('\\"Attachments\\"', markerIndex);
  if (nextSectionIndex > markerIndex) {
    return html.slice(markerIndex, nextSectionIndex);
  }

  return html.slice(markerIndex, markerIndex + 45000);
}

function escapedField(fragment = '', field = '') {
  const match = fragment.match(new RegExp(`\\\\"${field}\\\\"\\s*:\\s*\\\\"([\\s\\S]*?)\\\\"`));
  return unescapePayloadValue(match?.[1] || '');
}

function escapedNumber(fragment = '', field = '') {
  const match = fragment.match(new RegExp(`\\\\"${field}\\\\"\\s*:\\s*(-?\\d+(?:\\.\\d+)?|true|false|null)`));
  const value = match?.[1];
  if (!value || value === 'null') return null;
  if (value === 'true') return 1;
  if (value === 'false') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function namedCollectionValue(fragment = '', collection = '') {
  const match = fragment.match(new RegExp(`\\\\"${collection}\\\\"\\s*:\\s*\\{[\\s\\S]*?\\\\"name\\\\"\\s*:\\s*\\\\"([^"]+)\\\\"`));
  return unescapePayloadValue(match?.[1] || '');
}

function descriptionFields(fragment = '') {
  const match = fragment.match(/\\"content_description\\"\s*:\s*\{\\"English\\"\s*:\s*\{\\"title\\"\s*:\s*\\"([\s\S]*?)\\",\\"short_description\\"\s*:\s*\\"([\s\S]*?)\\",\\"description\\"\s*:\s*\\"([\s\S]*?)\\",\\"uploaded_content\\"/);
  return {
    title: unescapePayloadValue(match?.[1] || ''),
    shortDescription: unescapePayloadValue(match?.[2] || ''),
    description: unescapePayloadValue(match?.[3] || ''),
  };
}

function xpertNames(fragment = '') {
  const names = [];
  const seen = new Set();
  const matches = fragment.matchAll(/\\"first_name\\"\s*:\s*\\"([^"]*)\\",\\"last_name\\"\s*:\s*\\"([^"]*)\\"(?:,\\"suffix\\"\s*:\s*\\"([^"]*)\\")?/g);

  for (const match of matches) {
    const fullName = cleanText([
      unescapePayloadValue(match[1]),
      unescapePayloadValue(match[2]),
      unescapePayloadValue(match[3] || ''),
    ].filter(Boolean).join(' '), 160);

    if (!fullName || seen.has(fullName)) continue;
    seen.add(fullName);
    names.push(fullName);
  }

  return names.join('\n');
}

function extractCourseRecord(html = '') {
  const fragment = firstCourseFragment(html);
  if (!fragment) return null;

  const descriptions = descriptionFields(fragment);

  return {
    courseId: escapedNumber(fragment, 'course_id'),
    websiteUrlTitle: escapedField(fragment, 'website_url_title'),
    urlTitle: escapedField(fragment, 'url_title'),
    cost: escapedNumber(fragment, 'cost'),
    creditHours: escapedField(fragment, 'credit_hours'),
    presentationType: escapedField(fragment, 'presentation_type'),
    requiresPremium: escapedNumber(fragment, 'requires_premium'),
    nonCeCourse: escapedNumber(fragment, 'non_ce_course'),
    courseType: escapedField(fragment, 'course_type'),
    agdCode: escapedField(fragment, 'agd_code'),
    expirationDate: escapedField(fragment, 'expiration_date'),
    category: namedCollectionValue(fragment, 'Category'),
    subcategory: namedCollectionValue(fragment, 'SubCategory'),
    instructors: xpertNames(fragment),
    ...descriptions,
  };
}

async function fetchText(url, accept = 'text/html,*/*;q=0.8') {
  const response = await fetch(url, {
    headers: {
      Accept: accept,
      'User-Agent': BROWSER_USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`DentalXP returned ${response.status} for ${url}`);
  }

  return response.text();
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

async function scrapeCourse(url) {
  try {
    const html = await fetchText(url);
    const course = extractCourseRecord(html);
    if (!course) return null;

    const title = cleanText(course.title || course.urlTitle?.replace(/-/g, ' '), 250);
    const shortDescription = cleanText(course.shortDescription, 600);
    const description = cleanText(course.description || shortDescription || title, 2000);
    const category = cleanText(course.category, 120);
    const subcategory = cleanText(course.subcategory, 120);
    const credits = cleanText(course.creditHours, 80);
    const expirationDate = dateToISO(course.expirationDate);
    const courseUrl = absoluteUrl(course.websiteUrlTitle || url);
    const requiresPremium = Number(course.requiresPremium) === 1;
    const cost = Number(course.cost);
    const price = requiresPremium ? 'Premium membership' : (Number.isFinite(cost) && cost > 0 ? `$${cost}` : 'Free');

    if (!title || (!credits && !description)) return null;

    return normalizeCourse({
      provider: PROVIDER,
      provider_slug: PROVIDER_SLUG,
      source_url: SOURCE_URL,
      url: courseUrl || url,
      title,
      description: description || shortDescription,
      course_type: cleanText(course.courseType || course.presentationType || 'Online Self-Study Course', 120),
      format: 'Online',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${title} ${category} ${subcategory} ${description}`),
      credits_text: credits ? `${credits} Credits` : '',
      price,
      end_date: expirationDate,
      date_text: expirationDate ? `Available until ${expirationDate}` : 'On-demand',
      location: 'Online',
      country: 'USA',
      instructors: course.instructors,
      accreditation: course.agdCode ? `AGD code ${course.agdCode}` : 'DentalXP online CE',
      tags: ['DentalXP', 'Online', category, subcategory].filter(Boolean),
      metadata: {
        extracted_from: 'dentalxp-sitemap-course-rsc-payload',
        course_id: course.courseId || null,
        category: category || null,
        subcategory: subcategory || null,
        requires_premium: requiresPremium,
        non_ce_course: course.nonCeCourse ?? null,
        presentation_type: course.presentationType || null,
        expiration_date: course.expirationDate || null,
      },
    });
  } catch (error) {
    console.log(`      ⚠️ DentalXP skipped ${url}: ${error.message}`);
    return null;
  }
}

export async function scrapeDentalXP() {
  console.log(`   • Scraping ${PROVIDER}`);
  const xml = await fetchText(SOURCE_URL, 'application/xml,text/xml,*/*;q=0.8');
  const courseUrls = extractCourseUrls(xml);
  console.log(`   • Found ${courseUrls.length} DentalXP course URLs`);
  const rows = await mapWithConcurrency(courseUrls, DETAIL_CONCURRENCY, scrapeCourse);
  const deduped = [];
  const seen = new Set();

  for (const row of rows.filter(Boolean)) {
    const key = row.url || `${row.provider}::${row.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  console.log(`   • Extracted ${deduped.length} ${PROVIDER} rows`);
  return deduped;
}
