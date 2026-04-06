import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const GLIDEWELL_PROVIDER = 'Glidewell Clinical Education';
const GLIDEWELL_PROVIDER_SLUG = 'glidewell-clinical-education';
const GLIDEWELL_COLLECTION_URL = 'https://glidewelldirect.com/collections/education';
const MAX_COLLECTION_PAGES = 5;

function cleanText(value = '', max = 500) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanMultiline(value = '', max = 2000) {
  return String(value)
    .replace(/\r/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = GLIDEWELL_COLLECTION_URL) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function parseIsoDate(text = '') {
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function extractScriptsJson($) {
  return $('script[data-id^="product-block-json-"]')
    .map((_, element) => {
      const raw = $(element).html() || '';
      const match = raw.match(/=\s*(\{[\s\S]*\})\s*;?\s*$/);
      if (!match) return null;

      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    })
    .get()
    .filter(Boolean);
}

function inferTopic(product = {}) {
  const tags = Array.isArray(product.tags) ? product.tags : [];
  const tagTopic = tags
    .find((tag) => /^Topic_/i.test(tag))
    ?.replace(/^Topic_/i, '')
    ?.replace(/_/g, ' ');

  if (tagTopic) return cleanText(tagTopic, 160);

  const text = cleanText(product.title, 250).toLowerCase();
  if (/aligner|orthodont/.test(text)) return 'Orthodontics';
  if (/implant|graft|full arch/.test(text)) return 'Implant Dentistry';
  if (/esthetic|veneer|smile|crown/.test(text)) return 'Esthetics & Facial Esthetics';
  if (/sleep|airway/.test(text)) return 'Sleep & Airway';
  if (/digital|scan|iox|workflow/.test(text)) return 'Digital Dentistry & Technology';
  if (/denture|partial/.test(text)) return 'Prosthodontics';
  return 'General Dentistry';
}

function extractInstructor(product = {}) {
  const tags = Array.isArray(product.tags) ? product.tags : [];
  const instructors = tags
    .filter((tag) => /^Instructor_/i.test(tag))
    .map((tag) => cleanText(tag.replace(/^Instructor_/i, '').replace(/_/g, ' '), 160))
    .filter(Boolean);

  if (instructors.length) {
    return instructors.join('\n');
  }

  const presenterMatch = String(product.description || '').match(/Presenter:\s*<\/p>\s*<p[^>]*>(.*?)<\/p>/i);
  if (presenterMatch) {
    return cleanText(presenterMatch[1], 160);
  }

  return '';
}

function extractContentBlock(product = {}, heading = '') {
  const html = String(product.description || '');
  if (!html) return '';

  const pattern = new RegExp(`<h[23][^>]*>${heading}<\\/h[23]>([\\s\\S]*?)(?=<h[23][^>]*>|$)`, 'i');
  const match = html.match(pattern);
  return match ? cleanMultiline(match[1], 2500) : '';
}

function extractCourseDetails(product = {}) {
  const html = String(product.description || '');
  const detailsMatch = html.match(/<div class="course-details">([\s\S]*?)<\/div>/i);
  return detailsMatch ? detailsMatch[1] : html;
}

function extractAvailableCe(product = {}) {
  const details = extractCourseDetails(product);
  const match = details.match(/<h3>\s*Available CE\s*<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
  return match ? cleanText(match[1], 80) : '';
}

function extractMethod(product = {}) {
  const details = extractCourseDetails(product);
  const match = details.match(/<h3>\s*Method\s*<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
  return match ? cleanText(match[1], 120) : '';
}

function extractLocationFallback(product = {}) {
  const details = extractCourseDetails(product);
  const match = details.match(/<h3>\s*Location(?:<br>)?\s*<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
  return match ? cleanMultiline(match[1], 300) : '';
}

function parseVariantSession(title = '') {
  const text = cleanText(title, 160);
  const match = text.match(/^(.+?\d{4}\s*\([^)]+\))\s*\/\s*(.+)$/);
  if (!match) {
    return {
      dateLabel: '',
      priceLabel: text,
      start_date: '',
      end_date: '',
      location: '',
    };
  }

  const dateLabel = cleanText(match[1], 120);
  const priceLabel = cleanText(match[2], 120);
  const dateOnly = dateLabel.replace(/\s*\([^)]+\)\s*$/, '');
  const locationMatch = dateLabel.match(/\(([^)]+)\)\s*$/);
  const location = locationMatch ? cleanText(locationMatch[1], 80) : '';

  const rangeMatch = dateOnly.match(/^([A-Za-z]{3,}\.?)\s+(\d{1,2})(?:[–-](\d{1,2}))?,\s*(\d{4})$/);
  if (!rangeMatch) {
    return {
      dateLabel,
      priceLabel,
      start_date: '',
      end_date: '',
      location,
    };
  }

  const [, monthToken, startDayRaw, endDayRaw, yearRaw] = rangeMatch;
  const monthName = monthToken.replace(/\.$/, '');
  const startDay = startDayRaw;
  const endDay = endDayRaw || startDayRaw;
  const year = yearRaw;
  const start_date = parseIsoDate(`${monthName} ${startDay}, ${year}`);
  const end_date = parseIsoDate(`${monthName} ${endDay}, ${year}`);

  return {
    dateLabel,
    priceLabel,
    start_date,
    end_date,
    location,
  };
}

function cityStateCountry(location = '') {
  const text = cleanText(location, 80);
  const match = text.match(/^(.+?),\s*([A-Z]{2})$/);
  if (!match) return { city: '', state: '', country: '' };
  return {
    city: cleanText(match[1], 60),
    state: cleanText(match[2], 10),
    country: 'USA',
  };
}

function buildRowsForProduct(product = {}) {
  const topic = inferTopic(product);
  const instructor = extractInstructor(product);
  const description = [
    extractContentBlock(product, 'Course Synopsis'),
    extractContentBlock(product, 'Learning Objectives'),
  ].filter(Boolean).join('\n\n');
  const creditsText = extractAvailableCe(product);
  const method = extractMethod(product);
  const fallbackLocation = extractLocationFallback(product);
  const fallbackGeo = cityStateCountry(cleanText(fallbackLocation.split('\n').slice(-1)[0] || '', 80));
  const tags = Array.isArray(product.tags) ? product.tags.map((tag) => cleanText(tag, 120)).filter(Boolean) : [];

  const sessionMap = new Map();

  for (const variant of Array.isArray(product.variants) ? product.variants : []) {
    if (!variant?.title) continue;

    const session = parseVariantSession(variant.title);
    if (!session.dateLabel) continue;

    const key = `${session.dateLabel}||${session.location}`;
    const priceEntry = sessionMap.get(key) || {
      ...session,
      prices: new Set(),
    };

    priceEntry.prices.add(session.priceLabel);
    sessionMap.set(key, priceEntry);
  }

  return Array.from(sessionMap.values()).map((session, index) => {
    const geo = cityStateCountry(session.location || cleanText(fallbackLocation.split('\n').slice(-1)[0] || '', 80));
    const price = Array.from(session.prices).join(' | ');
    const location = session.location || cleanText(fallbackLocation, 250);

    return normalizeCourse({
      provider: GLIDEWELL_PROVIDER,
      provider_slug: GLIDEWELL_PROVIDER_SLUG,
      source_url: GLIDEWELL_COLLECTION_URL,
      url: absoluteUrl(`/collections/education/products/${product.handle}`, GLIDEWELL_COLLECTION_URL) + `#session-${index + 1}`,
      title: cleanText(product.title, 250),
      description,
      course_type: cleanText(method, 120) || 'Live Course',
      format: 'In Person',
      audience: 'Dentists and Dental Team',
      topic,
      credits_text: creditsText,
      price,
      start_date: session.start_date,
      end_date: session.end_date,
      date_text: session.dateLabel,
      location,
      city: geo.city || fallbackGeo.city,
      state: geo.state || fallbackGeo.state,
      country: geo.country || fallbackGeo.country,
      instructors: instructor,
      accreditation: 'Glidewell Education Center',
      requirements: cleanMultiline(`Method: ${method}`, 200),
      tags: ['Glidewell', 'Live Course', topic, ...tags.filter((tag) => /Topic_|Location_|Course Duration_/i.test(tag)).map((tag) => tag.replace(/_/g, ' '))].filter(Boolean),
      metadata: {
        extracted_from: 'glidewell-shopify',
        handle: product.handle,
        product_id: product.id,
        published_at: product.published_at,
      },
    });
  });
}

function extractSymposia($) {
  return $('.course-grid-item')
    .map((index, element) => {
      const card = $(element);
      const title = cleanText(card.find('h2').first().text(), 250);
      const dateText = cleanText(card.find('p strong').first().text(), 80);
      const monthText = cleanText(card.find('p').first().contents().first().text(), 40);
      const learnMore = absoluteUrl(card.find('a[href]').first().attr('href') || '', GLIDEWELL_COLLECTION_URL);
      const registerUrl = absoluteUrl(card.find('a[href]').last().attr('href') || '', GLIDEWELL_COLLECTION_URL);

      if (!title || !dateText) return null;

      return normalizeCourse({
        provider: GLIDEWELL_PROVIDER,
        provider_slug: GLIDEWELL_PROVIDER_SLUG,
        source_url: GLIDEWELL_COLLECTION_URL,
        url: learnMore || registerUrl || `${GLIDEWELL_COLLECTION_URL}#symposium-${index + 1}`,
        title,
        description: 'Glidewell symposium event listed on the public clinical education catalog.',
        course_type: 'Symposium',
        format: 'In Person',
        topic: inferTopic({ title }),
        date_text: `${monthText} ${dateText}`.trim(),
        location: 'See event page',
        country: 'USA',
        accreditation: 'Glidewell Education Center',
        tags: ['Glidewell', 'Symposium', inferTopic({ title })].filter(Boolean),
        metadata: {
          extracted_from: 'glidewell-symposium-grid',
          register_url: registerUrl,
        },
      });
    })
    .get()
    .filter(Boolean);
}

export async function scrapeGlidewell(startUrl = GLIDEWELL_COLLECTION_URL) {
  console.log('   • Scraping Glidewell Clinical Education public catalog');

  const products = new Map();
  const symposia = [];

  for (let page = 1; page <= MAX_COLLECTION_PAGES; page += 1) {
    const pageUrl = page === 1 ? startUrl : `${startUrl}?page=${page}`;

    let $;
    try {
      $ = await loadHTML(pageUrl);
    } catch (error) {
      console.log(`      ⚠️ Failed to load Glidewell page ${pageUrl}: ${error.message}`);
      break;
    }

    const pageProducts = extractScriptsJson($);
    pageProducts.forEach((product) => {
      if (product?.handle) {
        products.set(product.handle, product);
      }
    });

    symposia.push(...extractSymposia($));

    const hasNext = $(`a[href*="/collections/education?page=${page + 1}"]`).length > 0;
    if (!hasNext) break;
  }

  const rows = Array.from(products.values()).flatMap((product) => buildRowsForProduct(product));
  const symposiumRows = symposia.filter((row, index, array) => array.findIndex((item) => item.title === row.title) === index);
  const results = [...rows, ...symposiumRows];

  console.log(`   • Extracted ${results.length} Glidewell Clinical Education rows`);
  return results;
}
