import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';
import { extractCourseDataFromPage } from '../lib/course-helpers.js';

const CDEWORLD_PROVIDER = 'CDEWorld';
const CDEWORLD_PROVIDER_SLUG = 'cdeworld';
const CDEWORLD_SOURCE_URL = 'https://www.cdeworld.com/courses';
const BROAD_AUDIENCE_PATHS = new Set([
  '/courses/dentist',
  '/courses/dental-hygienist',
  '/courses/dental-assistant',
  '/courses/lab-tech',
]);

function cleanText(value = '', max = 500) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function humanizeSlug(slug = '') {
  return cleanText(
    slug
      .replace(/^\/courses\//, '')
      .replace(/-/g, ' '),
    120,
  ).replace(/\b\w/g, (char) => char.toUpperCase());
}

function canonicalCourseUrl(href = '') {
  if (!href) return '';
  try {
    const url = new URL(href, CDEWORLD_SOURCE_URL);
    url.search = '';
    return url.href;
  } catch {
    return '';
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      const value = await mapper(items[currentIndex], currentIndex);
      if (value) results.push(value);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function scrapeCDEWorld(startUrl = CDEWORLD_SOURCE_URL) {
  console.log('   • Scraping CDEWorld public catalog');

  const $home = await loadHTML(startUrl);
  const categoryLinks = Array.from(new Set(
    $home('a[href]')
      .map((_, el) => $home(el).attr('href'))
      .get()
      .filter((href) => /^\/courses\/[a-z-]+$/i.test(href)),
  ));

  const categoryPages = categoryLinks
    .filter((href) => !BROAD_AUDIENCE_PATHS.has(href))
    .map((href) => new URL(href, startUrl).href)
    .slice(0, 27);

  const courseTargets = [];

  for (const categoryPage of categoryPages) {
    try {
      const $category = await loadHTML(categoryPage);
      const categorySlug = new URL(categoryPage).pathname;
      const categoryLabel = humanizeSlug(categorySlug);
      const detailLinks = Array.from(new Set(
        $category('a[href]')
          .map((_, el) => $category(el).attr('href'))
          .get()
          .filter((href) => /^\/courses\/\d+/.test(href))
          .map((href) => canonicalCourseUrl(href))
          .filter(Boolean),
      ));

      detailLinks.forEach((url) => {
        courseTargets.push({ url, categoryLabel, categoryPage });
      });
    } catch (error) {
      console.log(`      ⚠️ Failed to load CDEWorld category ${categoryPage}: ${error.message}`);
    }
  }

  const seen = new Set();
  const dedupedTargets = courseTargets.filter((target) => {
    if (seen.has(target.url)) return false;
    seen.add(target.url);
    return true;
  });

  const results = await mapWithConcurrency(dedupedTargets, 6, async (target) => {
    try {
      const $detail = await loadHTML(target.url);
      const extracted = extractCourseDataFromPage($detail, {
        provider: CDEWORLD_PROVIDER,
        providerUrl: startUrl,
        pageUrl: target.url,
      });

      const topic = extracted.topic && extracted.topic !== extracted.title
        ? extracted.topic
        : target.categoryLabel;

      return normalizeCourse({
        ...extracted,
        provider: CDEWORLD_PROVIDER,
        provider_slug: CDEWORLD_PROVIDER_SLUG,
        source_url: target.categoryPage,
        url: target.url,
        course_type: cleanText(extracted.course_type, 120) || 'Online Course',
        format: cleanText(extracted.format, 80) || 'Online',
        topic,
        accreditation: cleanText(extracted.accreditation, 200) || target.categoryLabel,
        tags: [...new Set([
          'CDEWorld',
          'Online',
          topic,
          target.categoryLabel,
        ].filter(Boolean))],
        metadata: {
          ...(extracted.metadata || {}),
          extracted_from: 'cdeworld-category-crawl',
          category_page: target.categoryPage,
        },
      });
    } catch (error) {
      console.log(`      ⚠️ Failed to load CDEWorld course ${target.url}: ${error.message}`);
      return null;
    }
  });

  console.log(`   • Extracted ${results.length} CDEWorld courses`);
  return results;
}
