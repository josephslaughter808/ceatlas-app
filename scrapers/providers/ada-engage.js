import axios from 'axios';
import { normalizeCourse } from '../../lib/normalize.js';

const ENGAGE_BASE_URL = 'https://engage.ada.org';
const CATEGORY_API_BASE = `${ENGAGE_BASE_URL}/store/api/1/category/2`;
const TAG_GROUPS = [
  { tags: '66', defaultFormat: 'On-Demand', defaultType: 'Online Course' },
  { tags: '35', defaultFormat: 'Live Webinar', defaultType: 'Live Webinar' },
];

function stripHtml(value = '') {
  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\u2011/g, '-')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function absoluteUrl(href = '') {
  if (!href) return '';
  try {
    return new URL(href, ENGAGE_BASE_URL).href;
  } catch {
    return '';
  }
}

function extractTagLabels(product, label) {
  const category = product?.tags?.cts?.find((entry) => entry.label === label);
  return (category?.tags || [])
    .map((tag) => String(tag.label || '').trim())
    .filter(Boolean);
}

function buildPriceSummary(prices = []) {
  const usable = prices.filter((price) => typeof price?.value === 'number');
  if (usable.length === 0) return { text: '', amount: null, currency: '' };

  const text = usable
    .map((price) => `${price.label}: ${price.currency || ''}${price.value}`)
    .join(' | ');

  const nonZero = usable
    .filter((price) => price.value > 0)
    .sort((a, b) => a.value - b.value);

  const cheapest = nonZero[0] || usable[0];

  return {
    text,
    amount: cheapest?.value ?? null,
    currency: cheapest?.currency === '$' ? 'USD' : (cheapest?.currency || ''),
  };
}

function parseSchedule(description = '') {
  const text = stripHtml(description);
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const dateLine = lines.find((line) => /^date:/i.test(line));
  const timeLine = lines.find((line) => /^time:/i.test(line));

  return {
    startDate: dateLine ? dateLine.replace(/^date:\s*/i, '') : '',
    dateText: [dateLine, timeLine].filter(Boolean).join('\n'),
  };
}

function buildInstructors(product) {
  return (product.speakers || [])
    .map((speaker) => {
      const name = [speaker.first_name, speaker.middle_name, speaker.last_name, speaker.suffix]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      const creds = [speaker.credentials, speaker.title].filter(Boolean).join(', ');
      return creds ? `${name} (${creds})` : name;
    })
    .filter(Boolean)
    .join('\n');
}

function toCourseRow(product, config) {
  const formatTags = extractTagLabels(product, 'CE Format');
  const topicTags = extractTagLabels(product, 'CE Topics');
  const creditTags = extractTagLabels(product, 'CE Credits');
  const recommendedTags = extractTagLabels(product, 'CE Recommended');
  const schedule = parseSchedule(product.description || '');
  const pricing = buildPriceSummary(product.purchaseDetails?.prices || []);
  const format = formatTags[0] || config.defaultFormat;
  const courseType = product.type === 'product_bundle'
    ? 'Certificate Program'
    : (formatTags[0] || config.defaultType);

  return normalizeCourse({
    provider: 'ADA',
    provider_slug: 'ada',
    source_url: `${ENGAGE_BASE_URL}/store/1/index/2?tags=${config.tags}`,
    url: absoluteUrl(product.href),
    title: product.title,
    description: stripHtml(product.description || product.teaser?.text || ''),
    course_type: courseType,
    format,
    audience: '',
    topic: topicTags.join(' | '),
    credits_text: creditTags[0] || '',
    price: pricing.text,
    price_amount: pricing.amount,
    currency: pricing.currency,
    start_date: schedule.startDate,
    date_text: schedule.dateText,
    instructors: buildInstructors(product),
    accreditation: 'ADA CERP Recognized Provider',
    tags: [...new Set([...formatTags, ...topicTags, ...recommendedTags])],
    metadata: {
      extracted_from: 'ada-engage-api',
      engage_product_id: product.id,
      engage_uuid: product.uuid,
      engage_type: product.type,
      identification: product.identification,
      created_at: product.createdAt,
      discoverable: product.discoverable,
      ownable: product.ownable,
      price_options: product.purchaseDetails?.prices || [],
    },
  });
}

async function fetchCategoryPage(tags, page) {
  const response = await axios.get(CATEGORY_API_BASE, {
    params: { tags, page },
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CEAtlasBot/1.0)',
      'Accept': 'application/json',
    },
  });

  return response.data;
}

async function scrapeTagGroup(config) {
  const firstPage = await fetchCategoryPage(config.tags, 1);
  const total = firstPage.count || 0;
  const limit = firstPage.defaultLimit || 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const products = [...(firstPage.data || [])];

  for (let page = 2; page <= totalPages; page += 1) {
    const nextPage = await fetchCategoryPage(config.tags, page);
    products.push(...(nextPage.data || []));
  }

  return products
    .filter((product) => product?.discoverable !== false)
    .filter((product) => ['course', 'product_bundle'].includes(product?.type))
    .map((product) => toCourseRow(product, config));
}

export async function scrapeAdaEngageCourses() {
  console.log('   • Scraping ADA Engage catalog');

  const rows = [];
  const seen = new Set();

  for (const config of TAG_GROUPS) {
    const groupRows = await scrapeTagGroup(config);
    for (const row of groupRows) {
      if (!row.url || seen.has(row.url)) continue;
      seen.add(row.url);
      rows.push(row);
    }
  }

  console.log(`   • Extracted ${rows.length} ADA Engage courses`);
  return rows;
}
