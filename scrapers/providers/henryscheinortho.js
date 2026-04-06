import { chromium } from 'playwright';
import { normalizeCourse } from '../../lib/normalize.js';

const PROVIDER = 'Henry Schein Orthodontics CE';
const PROVIDER_SLUG = 'henry-schein-orthodontics-ce';
const SOURCE_URL = 'https://henryscheinortho.com/education-events/';
const CALENDAR_URL = 'https://events.timely.fun/j9mgqvg0/modern_list';

function cleanText(value = '', max = 4000) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function normalizeDate(value = '') {
  const text = cleanText(value, 80);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';

  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0'),
  ].join('-');
}

function inferTopic(text = '') {
  const value = cleanText(text, 600).toLowerCase();
  if (/class ii|class iii|orthodont|carriere|sagittal|motion pro|aligner/.test(value)) return 'Orthodontics';
  if (/practice|efficiency|workflow|summit|leadership/.test(value)) return 'Practice Management & Business';
  return 'Orthodontics';
}

function inferFormat(categories = [], filters = {}) {
  const all = [
    ...categories,
    filters['In Person/Online'],
    filters['Event Type'],
  ]
    .flat()
    .map((value) => cleanText(value, 120).toLowerCase())
    .join(' ');

  if (/online|virtual|webinar/.test(all)) return 'Online';
  if (/in person|tradeshow/.test(all)) return 'In Person';
  return 'Hybrid';
}

function inferCourseType(filters = {}, categories = []) {
  const eventType = cleanText(filters['Event Type'] || '', 120).toLowerCase();
  const categoryText = categories.map((value) => cleanText(value, 120).toLowerCase()).join(' ');

  if (/course/.test(eventType)) return 'Course';
  if (/webinar/.test(categoryText)) return 'Webinar';
  if (/tradeshow/.test(categoryText)) return 'Conference';
  return 'Event';
}

function extractPrice(description = '') {
  const match = cleanText(description, 600).match(/\$\s?\d[\d,]*(?:\.\d{2})?/);
  return match ? match[0].replace(/\s+/g, '') : '';
}

async function extractPopupRecord(page, index) {
  await page.locator('.timely-modern-list-event').nth(index).click();
  await page.waitForTimeout(1800);

  const detailUrl = page.url();
  const popup = await page.locator('.timely-event-popup').evaluate((node) => {
    const clean = (value = '') => String(value).replace(/\s+/g, ' ').trim();
    const textList = (selector) => Array.from(node.querySelectorAll(selector)).map((item) => clean(item.textContent || '')).filter(Boolean);
    const details = {};

    node.querySelectorAll('.timely-event-details-row').forEach((row) => {
      const heading = clean(row.querySelector('.timely-event-heading')?.textContent || '');
      const values = Array.from(row.querySelectorAll('.timely-event-details-value span'))
        .map((item) => clean(item.textContent || ''))
        .filter(Boolean);

      if (heading) details[heading] = values;
    });

    return {
      title: clean(node.querySelector('.timely-event-title')?.textContent || ''),
      description: clean(node.querySelector('.timely-description-body')?.textContent || ''),
      registrationLink: node.querySelector('.timely-description-body a[href]')?.href || '',
      imageUrl: node.querySelector('.timely-event-featured-image img')?.src || '',
      dateLabel: clean(node.querySelector('.timely-event-timezone-start-date')?.textContent || ''),
      localTimeStart: clean(node.querySelector('#timely-selected-timezone-start-time')?.textContent || ''),
      localTimeEnd: clean(node.querySelector('#timely-selected-timezone-end-time')?.textContent || ''),
      details,
      categories: textList('.timely-event-details-categories .timely-event-details-value a'),
      tags: textList('.timely-event-details-tags .timely-event-details-value a'),
    };
  });

  await page.locator('#timely-event-details-close-button').click();
  await page.waitForTimeout(500);

  return {
    ...popup,
    detailUrl,
  };
}

export async function scrapeHenryScheinOrtho() {
  console.log('   • Scraping Henry Schein Orthodontics CE');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1200 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  });

  try {
    await page.goto(CALENDAR_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(4000);

    const count = await page.locator('.timely-modern-list-event').count();
    const rows = [];

    for (let index = 0; index < count; index += 1) {
      const record = await extractPopupRecord(page, index);
      if (!record.title) continue;

      const filters = Object.fromEntries(
        Object.entries(record.details || {}).map(([key, values]) => [key, Array.isArray(values) ? values.join(' • ') : cleanText(values)]),
      );
      const categories = Array.isArray(record.categories) ? record.categories : [];
      const tags = Array.isArray(record.tags) ? record.tags : [];
      const format = inferFormat(categories, filters);
      const courseType = inferCourseType(filters, categories);
      const creditsText = cleanText(filters['CE hours'] || '', 80);
      const credits = creditsText.match(/[\d.]+/)?.[0] || '';
      const description = cleanText(record.description || '', 2400);
      const topic = inferTopic(`${record.title} ${description} ${tags.join(' ')} ${filters.Topics || ''}`);
      const dateText = [
        cleanText(record.dateLabel, 80),
        cleanText([record.localTimeStart, record.localTimeEnd].filter(Boolean).join(' '), 120),
      ].filter(Boolean).join(' • ');

      rows.push(normalizeCourse({
        provider: PROVIDER,
        provider_slug: PROVIDER_SLUG,
        source_url: SOURCE_URL,
        url: record.registrationLink || record.detailUrl || CALENDAR_URL,
        title: record.title,
        description: description || `${record.title} is listed in the Henry Schein Orthodontics events calendar.`,
        course_type: courseType,
        format,
        audience: cleanText(filters.Speciality || 'Orthodontists and Dental Team', 120),
        topic,
        credits,
        credits_text: creditsText,
        price: extractPrice(description),
        start_date: normalizeDate(record.dateLabel),
        end_date: '',
        date_text: dateText,
        location: cleanText(filters['In Person/Online'] || categories.join(' / ') || 'See event details', 180),
        city: '',
        state: '',
        country: 'USA',
        instructors: cleanText(filters.Speaker || '', 180),
        accreditation: 'Henry Schein Orthodontics',
        tags: [
          ...categories,
          ...tags,
          filters['Event Type'],
          filters.Speciality,
          format,
        ].filter(Boolean),
        metadata: {
          detail_url: record.detailUrl,
          registration_url: record.registrationLink,
          image_url: record.imageUrl,
          categories,
          tags,
          event_filters: filters,
          extracted_from: 'timely-modern-list',
        },
      }));
    }

    const deduped = [];
    const seen = new Set();
    for (const row of rows) {
      const key = `${row.title}::${row.url}`;
      if (!row.title || !row.url || seen.has(key)) continue;
      seen.add(key);
      deduped.push(row);
    }

    console.log(`   • Extracted ${deduped.length} Henry Schein Orthodontics CE rows`);
    return deduped;
  } finally {
    await page.close();
    await browser.close();
  }
}
