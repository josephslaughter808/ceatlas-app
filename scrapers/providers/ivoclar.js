import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const IVOCLAR_PROVIDER = 'Ivoclar Academy';
const IVOCLAR_PROVIDER_SLUG = 'ivoclar-academy';
const IVOCLAR_SECTIONS = [
  {
    audience: 'Dentists',
    startUrl: 'https://resources.ivoclar.com/dentist/en/academy',
    fallbackTopic: 'Restorative Dentistry',
  },
  {
    audience: 'Dental Technicians',
    startUrl: 'https://resources.ivoclar.com/lab/en/academy',
    fallbackTopic: 'Dental Laboratory',
  },
];

function cleanText(value = '', max = 500) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanMultilineText(value = '', max = 2000) {
  return String(value)
    .replace(/\r/g, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, max);
}

function normalizeSpeaker(value = '') {
  return cleanText(value, 160).replace(/^speaker\s+/i, '');
}

function toAbsoluteUrl(href = '', baseUrl = '') {
  if (!href) return '';
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return '';
  }
}

function parseIsoDate(value = '') {
  const text = cleanText(value, 80);
  if (!text) return '';

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function extractJsonLdDate($) {
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const script of scripts) {
    const raw = $(script).contents().text();
    if (!raw) continue;

    try {
      const data = JSON.parse(raw);
      const candidates = Array.isArray(data) ? data : [data];
      for (const candidate of candidates) {
        const datePublished = cleanText(candidate?.datePublished, 80);
        if (datePublished) return parseIsoDate(datePublished);
      }
    } catch {
      continue;
    }
  }

  return '';
}

function inferTopic(topicText = '', title = '', fallbackTopic = '') {
  const combined = `${cleanText(topicText, 160)} ${cleanText(title, 200)}`.toLowerCase();
  if (!combined.trim()) return fallbackTopic;

  if (/cad\/cam|ceramic|zirconia|luting|restoration|restorative|prosthetic|prosthetics|veneer|composite|cementation/.test(combined)) {
    return 'Restorative Dentistry';
  }
  if (/denture|removable/.test(combined)) return 'Removable Prosthetics';
  if (/digital/.test(combined)) return 'Digital Dentistry & Technology';
  if (/lab/.test(combined)) return 'Dental Laboratory';
  if (/entrepreneur|business|practice/.test(combined)) return 'Practice Management & Business';
  if (/professional care|prophylaxis|hygiene/.test(combined)) return 'Hygiene & Preventive Care';
  return cleanText(topicText, 120) || fallbackTopic;
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

async function collectListingTargets(section) {
  const $firstPage = await loadHTML(section.startUrl);
  const pageNumbers = $firstPage('.blog-pagination__page a')
    .map((_, el) => Number.parseInt(cleanText($firstPage(el).text(), 8), 10))
    .get()
    .filter(Number.isFinite);

  const maxPage = Math.max(1, ...pageNumbers);
  const pageUrls = Array.from({ length: maxPage }, (_, index) => (
    index === 0 ? section.startUrl : `${section.startUrl}?page=${index + 1}`
  ));

  const targets = [];

  for (const pageUrl of pageUrls) {
    const $page = pageUrl === section.startUrl ? $firstPage : await loadHTML(pageUrl);

    $page('.blog-listing__article-wrapper').each((_, card) => {
      const cardNode = $page(card);
      const detailHref = cardNode.find('.blog-listing__article-title a').attr('href');
      const detailUrl = toAbsoluteUrl(detailHref, pageUrl);
      const title = cleanText(cardNode.find('.blog-listing__article-title').text(), 250);
      const topic = cleanText(cardNode.find('.blog-listing__article-topic').first().text(), 120);
      const instructors = cardNode.find('.blog-listing__article-speakers-item')
        .map((__, el) => normalizeSpeaker($page(el).text()))
        .get()
        .filter(Boolean)
        .join('\n');
      const imageUrl = toAbsoluteUrl(
        cardNode.find('.blog-listing__article-featured-image img').attr('src') || '',
        pageUrl,
      );

      if (!detailUrl || !title) return;

      targets.push({
        ...section,
        pageUrl,
        detailUrl,
        title,
        topic,
        instructors,
        imageUrl,
      });
    });
  }

  const seen = new Set();
  return targets.filter((target) => {
    if (seen.has(target.detailUrl)) return false;
    seen.add(target.detailUrl);
    return true;
  });
}

async function scrapeDetail(target) {
  try {
    const $detail = await loadHTML(target.detailUrl);
    const description = cleanText(
      $detail('meta[name="description"]').attr('content')
      || $detail('.blog-post__body p').first().text()
      || '',
      1200,
    );
    const body = cleanMultilineText($detail('.blog-post__body').text(), 1800);
    const publishDate = extractJsonLdDate($detail);
    const normalizedTopic = inferTopic(target.topic, target.title, target.fallbackTopic);

    return normalizeCourse({
      provider: IVOCLAR_PROVIDER,
      provider_slug: IVOCLAR_PROVIDER_SLUG,
      source_url: target.pageUrl,
      url: target.detailUrl,
      title: target.title,
      description: body || description,
      course_type: 'On-Demand Webinar',
      format: 'Online',
      audience: target.audience,
      topic: normalizedTopic,
      price: 'Registration required',
      start_date: publishDate,
      end_date: publishDate,
      date_text: publishDate,
      instructors: target.instructors,
      country: 'USA',
      accreditation: 'Ivoclar Academy',
      tags: ['Ivoclar Academy', 'Online', 'On Demand', target.audience, normalizedTopic].filter(Boolean),
      metadata: {
        extracted_from: 'ivoclar-academy',
        image_url: target.imageUrl,
        section_url: target.startUrl,
        page_url: target.pageUrl,
      },
    });
  } catch (error) {
    console.log(`      ⚠️ Failed to load Ivoclar Academy detail ${target.detailUrl}: ${error.message}`);
    return null;
  }
}

export async function scrapeIvoclar() {
  console.log('   • Scraping Ivoclar Academy public webinar catalog');

  const listingTargets = [];
  for (const section of IVOCLAR_SECTIONS) {
    const sectionTargets = await collectListingTargets(section);
    listingTargets.push(...sectionTargets);
  }

  const results = await mapWithConcurrency(listingTargets, 6, scrapeDetail);
  console.log(`   • Extracted ${results.length} Ivoclar Academy courses`);
  return results;
}
