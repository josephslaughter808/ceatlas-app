import { loadHTML } from '../../lib/fetch.js';
import { extractCourseDataFromPage, isLikelyCoursePage } from '../lib/course-helpers.js';

const PIKOS_PROVIDER = 'Pikos Institute';

function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function absoluteUrl(value = '', baseUrl = '') {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function parseJsonLdCourses($, baseUrl) {
  const urls = new Set();

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).html() || '';
    if (!raw.includes('"@type": "Course"')) return;

    try {
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];

      for (const node of nodes) {
        const items = Array.isArray(node?.itemListElement)
          ? node.itemListElement
          : Array.isArray(node?.hasPart)
            ? node.hasPart
            : Array.isArray(node)
              ? node
              : [];

        for (const item of items) {
          const course = item?.item || item;
          if (course?.['@type'] !== 'Course' || !course?.url) continue;
          const detailUrl = absoluteUrl(course.url, baseUrl);
          if (detailUrl) urls.add(detailUrl);
        }
      }
    } catch {
      return;
    }
  });

  return urls;
}

function parseAnchorCourses($, baseUrl) {
  const urls = new Set();

  $('a[href*="/live-courses/"], a[href*="/online-dental-implant-courses/"]').each((_, element) => {
    const href = $(element).attr('href') || '';
    const text = cleanText($(element).text());
    const full = absoluteUrl(href, baseUrl);
    if (!full) return;
    if (/register|bundle|catalog|brochure|sponsorship|local-hotels|videos-and-books/i.test(`${href} ${text}`)) return;
    urls.add(full);
  });

  return urls;
}

function looksLikeDateText(value = '') {
  const text = cleanText(value);
  if (!text) return false;
  if (text.length > 180) return false;
  if (/copyright|homeabout|contactsearch|close staging/i.test(text)) return false;
  return /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i.test(text) || /\b202\d\b/.test(text);
}

function extractLedBy($) {
  const ledByBlock = $('p')
    .filter((_, element) => cleanText($(element).text()) === 'Course Led by')
    .first()
    .parent();

  const values = ledByBlock
    .find('p')
    .map((_, element) => cleanText($(element).text()))
    .get()
    .filter(Boolean)
    .filter((value) => value !== 'Course Led by');

  return values.join('\n');
}

function extractCourseDates($) {
  const dates = $('.course-date-collection-item')
    .map((_, element) => {
      const parts = $(element)
        .find('.tag-text, .paragraph-x-small-14')
        .map((__, item) => cleanText($(item).text()))
        .get()
        .filter(Boolean)
        .filter((part) => !['-', '$'].includes(part))
        .slice(0, 4);

      return parts.join(' ');
    })
    .get()
    .filter((value) => looksLikeDateText(value));

  return [...new Set(dates)].join('\n');
}

function extractLocation($) {
  const locations = $('.subheading-small-18')
    .map((_, element) => cleanText($(element).text()))
    .get()
    .filter(Boolean)
    .filter((value) => !/online|display location/i.test(value));

  const location = locations[0] || '';
  if (location.length > 90) return '';
  if (/[.!?]/.test(location)) return '';
  return location;
}

function extractCredits($, fallback = '') {
  const bodyText = cleanText($('body').text());
  const matches = bodyText.match(/\b\d+(?:\.\d+)?\s+CE\s+(?:Hours?|Credits?)\b/gi) || [];
  if (matches.length) return matches[0];

  const hoursMatch = bodyText.match(/\b\d+(?:\.\d+)?\s+Hours\b/i);
  return hoursMatch ? hoursMatch[0] : fallback;
}

async function scrapePikosDetail(detailUrl, startUrl) {
  const $ = await loadHTML(detailUrl);
  const course = extractCourseDataFromPage($, {
    provider: PIKOS_PROVIDER,
    providerUrl: startUrl,
    pageUrl: detailUrl,
  });

  const instructors = extractLedBy($) || course.instructors;
  const dateText = extractCourseDates($) || (looksLikeDateText(course.date_text) ? course.date_text : '');
  const location = extractLocation($) || course.location;
  const creditsText = extractCredits($, course.credits_text);
  const format = detailUrl.includes('learn.pikosinstitute.com')
    ? 'Online'
    : (course.format || 'Live');

  const enrichedCourse = {
    ...course,
    instructors,
    date_text: dateText,
    location,
    credits_text: creditsText,
    format,
  };

  if (!isLikelyCoursePage(enrichedCourse)) return null;

  return {
    ...enrichedCourse,
    metadata: {
      ...(course.metadata || {}),
      extracted_from: 'pikos',
      detail_url: detailUrl,
    },
  };
}

export async function scrapePikos(startUrl = 'https://www.pikosinstitute.com/') {
  console.log('   • Scraping Pikos Institute public catalog');

  const $ = await loadHTML(startUrl);
  const detailUrls = new Set([
    ...parseJsonLdCourses($, startUrl),
    ...parseAnchorCourses($, startUrl),
  ]);

  const results = [];

  for (const detailUrl of detailUrls) {
    try {
      const course = await scrapePikosDetail(detailUrl, startUrl);
      if (course) results.push(course);
    } catch (error) {
      console.log(`      ⚠️ Failed to load Pikos course ${detailUrl}: ${error.message}`);
    }
  }

  console.log(`   • Extracted ${results.length} Pikos Institute courses`);
  return results;
}
