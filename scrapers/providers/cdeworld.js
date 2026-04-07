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
const MAX_PAGES_PER_AUDIENCE = 100;
const MAX_PAGES_PER_TOPIC = 1;

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

function isoDate(value = '') {
  const text = cleanText(value, 120).replace(/(\d+)(st|nd|rd|th)\b/gi, '$1');
  if (!text) return '';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function parseDetailExtras($) {
  const bodyText = cleanText($('body').text(), 20000);
  const credits = cleanText(bodyText.match(/CREDITS:\s*([0-9.]+\s*[A-Z]*)/i)?.[1] || '', 80);
  const price = cleanText(bodyText.match(/COST:\s*(\$[0-9,.]+|Free)/i)?.[1] || '', 80);
  const provider = cleanText(bodyText.match(/PROVIDER:\s*(.*?)(?:SOURCE:|Learning Objectives:|$)/i)?.[1] || '', 200);
  const source = cleanText(bodyText.match(/SOURCE:\s*(.*?)(?:Learning Objectives:|Disclosures:|$)/i)?.[1] || '', 200);
  const agdCode = cleanText(bodyText.match(/AGD CODE:\s*(.*?)(?:COST:|PROVIDER:|SOURCE:|$)/i)?.[1] || '', 180);
  const expires = cleanText(bodyText.match(/Expires\s+([A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,\s+\d{4})/i)?.[1] || '', 120);
  const issueDate = cleanText(bodyText.match(/\b([A-Za-z]+\s+\d{4})\s+Issue\s+-\s+Expires/i)?.[1] || '', 80);
  const author = cleanText($('.authors').first().text(), 240);

  return {
    credits,
    price,
    provider,
    source,
    agdCode,
    expires,
    expirationDate: isoDate(expires),
    issueDate,
    author,
  };
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

  const paginatedSources = [
    ...categoryLinks
      .filter((href) => BROAD_AUDIENCE_PATHS.has(href))
      .map((href) => ({
        url: new URL(href, startUrl).href,
        maxPages: MAX_PAGES_PER_AUDIENCE,
      })),
    ...categoryLinks
      .filter((href) => !BROAD_AUDIENCE_PATHS.has(href))
      .map((href) => ({
        url: new URL(href, startUrl).href,
        maxPages: MAX_PAGES_PER_TOPIC,
      })),
  ];

  const courseTargets = [];

  for (const source of paginatedSources) {
    const categorySlug = new URL(source.url).pathname;
    const categoryLabel = humanizeSlug(categorySlug);

    for (let page = 1; page <= source.maxPages; page += 1) {
      const categoryPage = page === 1 ? source.url : `${source.url}?page=${page}`;

      try {
        const $category = await loadHTML(categoryPage);
        const detailLinks = Array.from(new Set(
          $category('a[href]')
            .map((_, el) => $category(el).attr('href'))
            .get()
            .filter((href) => /^\/courses\/\d+/.test(href))
            .map((href) => canonicalCourseUrl(href))
            .filter(Boolean),
        ));

        if (!detailLinks.length) break;

        detailLinks.forEach((url) => {
          courseTargets.push({ url, categoryLabel, categoryPage });
        });
      } catch (error) {
        console.log(`      ⚠️ Failed to load CDEWorld category ${categoryPage}: ${error.message}`);
        break;
      }
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
      const extras = parseDetailExtras($detail);

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
        credits_text: extras.credits || extracted.credits_text,
        price: extras.price || extracted.price,
        end_date: extras.expirationDate || extracted.end_date,
        date_text: extras.issueDate || extras.expires || extracted.date_text,
        instructors: extras.author || extracted.instructors,
        accreditation: extras.provider || cleanText(extracted.accreditation, 200) || target.categoryLabel,
        tags: [...new Set([
          'CDEWorld',
          'Online',
          topic,
          target.categoryLabel,
          extras.source,
        ].filter(Boolean))],
        metadata: {
          ...(extracted.metadata || {}),
          extracted_from: 'cdeworld-category-crawl',
          category_page: target.categoryPage,
          agd_code: extras.agdCode || null,
          source_publication: extras.source || null,
          expiration_date: extras.expires || null,
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
