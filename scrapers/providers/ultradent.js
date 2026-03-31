import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';
import { extractCourseDataFromPage } from '../lib/course-helpers.js';

const ULTRADENT_PROVIDER = 'Ultradent';
const ULTRADENT_PROVIDER_SLUG = 'ultradent';
const ULTRADENT_SOURCE_URL = 'https://ultradent.cdeworld.com/courses';

function cleanText(value = '', max = 500) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function canonicalUrl(href = '') {
  try {
    const url = new URL(href, ULTRADENT_SOURCE_URL);
    url.search = '';
    return url.href;
  } catch {
    return '';
  }
}

function inferTopic(row) {
  const accreditation = cleanText(row.accreditation, 160);
  if (accreditation) return accreditation;
  return cleanText(row.topic, 160) || 'General Dentistry';
}

export async function scrapeUltradent(startUrl = ULTRADENT_SOURCE_URL) {
  console.log('   • Scraping Ultradent public catalog');

  const $ = await loadHTML(startUrl);
  const detailUrls = Array.from(new Set(
    $('a[href]')
      .map((_, el) => $(el).attr('href'))
      .get()
      .filter((href) => /^\/courses\/\d+/.test(href))
      .map((href) => canonicalUrl(href))
      .filter(Boolean),
  ));

  const results = [];

  for (const url of detailUrls) {
    try {
      const $detail = await loadHTML(url);
      const extracted = extractCourseDataFromPage($detail, {
        provider: ULTRADENT_PROVIDER,
        providerUrl: startUrl,
        pageUrl: url,
      });
      const topic = inferTopic(extracted);

      results.push(normalizeCourse({
        ...extracted,
        provider: ULTRADENT_PROVIDER,
        provider_slug: ULTRADENT_PROVIDER_SLUG,
        source_url: startUrl,
        url,
        course_type: cleanText(extracted.course_type, 120) || 'Online Course',
        format: cleanText(extracted.format, 80) || 'Online',
        topic,
        price: cleanText(extracted.price, 80) || 'Free',
        tags: [...new Set([
          'Ultradent',
          'Online',
          topic,
        ].filter(Boolean))],
        metadata: {
          ...(extracted.metadata || {}),
          extracted_from: 'ultradent-cdeworld',
        },
      }));
    } catch (error) {
      console.log(`      ⚠️ Failed to load Ultradent course ${url}: ${error.message}`);
    }
  }

  console.log(`   • Extracted ${results.length} Ultradent courses`);
  return results;
}
