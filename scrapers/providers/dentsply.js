import axios from 'axios';
import { normalizeCourse } from '../../lib/normalize.js';

const DENTSPLY_PROVIDER = 'Dentsply Sirona Academy';
const DENTSPLY_PROVIDER_SLUG = 'dentsply-sirona-academy';
const DENTSPLY_COURSES_URL = 'https://www.dentsplysirona.com/en-us/academy/ce/courses.html';
const DENTSPLY_API_URL = 'https://www.dentsplysirona.com/content/dentsply-sirona-dt/us/en/academy/ce/courses/jcr:content/root/container/coursegrid_copy_copy.article.json';

function cleanText(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(value = '') {
  const text = cleanText(value);
  if (!text) return '';

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function makeAbsoluteUrl(value = '') {
  const text = cleanText(value, 800);
  if (!text) return '';
  if (text.startsWith('http://') || text.startsWith('https://')) return text;

  try {
    return new URL(text, 'https://www.dentsplysirona.com').href;
  } catch {
    return '';
  }
}

function buildFormat(value = '') {
  const text = cleanText(value, 80);
  if (/on-demand/i.test(text)) return 'Online';
  if (/webinar/i.test(text)) return 'Online';
  if (/in-person|live/i.test(text)) return 'In Person';
  return text || 'Online';
}

function buildTags(item = {}) {
  return [
    'Dentsply Sirona Academy',
    cleanText(item.type, 80),
    cleanText(item.productTag, 120),
  ].filter(Boolean);
}

export async function scrapeDentsply(startUrl = DENTSPLY_COURSES_URL) {
  console.log('   • Scraping Dentsply Sirona Academy public catalog');

  const results = [];
  let page = 1;
  let numberOfPages = 1;

  while (page <= numberOfPages) {
    const { data } = await axios.get(DENTSPLY_API_URL, {
      params: {
        page,
        sort: 'asc',
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CEAtlasBot/1.0)',
        Accept: 'application/json, text/plain, */*',
      },
    });

    const items = Array.isArray(data?.items) ? data.items : [];
    numberOfPages = Number(data?.numberOfPages) || page;

    for (const item of items) {
      const title = cleanText(item?.title, 250);
      const url = makeAbsoluteUrl(item?.link?.href);
      if (!title || !url) continue;

      const format = buildFormat(item?.type);
      const dateText = cleanText(item?.date, 160);
      const startDate = parseDate(dateText);

      results.push(normalizeCourse({
        provider: DENTSPLY_PROVIDER,
        provider_slug: DENTSPLY_PROVIDER_SLUG,
        source_url: startUrl,
        url,
        title,
        description: cleanText(item?.description, 1200),
        course_type: cleanText(item?.miniTitle || item?.type, 120),
        format,
        topic: cleanText(item?.productTag, 160),
        start_date: startDate,
        end_date: startDate,
        date_text: dateText,
        instructors: cleanText(item?.speakerNames, 240).replace(/,\s*/g, '\n'),
        accreditation: 'Dentsply Sirona Academy',
        tags: buildTags(item),
        metadata: {
          extracted_from: 'dentsply-aem-json',
          source_id: cleanText(item?.id, 300),
          image_url: makeAbsoluteUrl(item?.image?.src),
          page,
        },
      }));
    }

    page += 1;
  }

  console.log(`   • Extracted ${results.length} Dentsply Sirona Academy courses`);
  return results;
}
