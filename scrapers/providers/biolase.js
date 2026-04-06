import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const BIOLASE_PROVIDER = 'BIOLASE Education';
const BIOLASE_PROVIDER_SLUG = 'biolase-education';
const BIOLASE_WEBINARS_URL = 'https://www.biolase.com/webinars/';
const BIOLASE_ON_DEMAND_URL = 'https://www.biolase.com/webinars-on-demand/';

function cleanText(value = '', max = 500) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = BIOLASE_WEBINARS_URL) {
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

function inferTopic(title = '', classes = []) {
  const classText = Array.isArray(classes) ? classes.join(' ') : String(classes || '');
  const text = `${title} ${classText}`.toLowerCase();
  if (/diode|laser|waterlase/.test(text)) return 'Laser Dentistry';
  if (/pedo|pediatric/.test(text)) return 'Pediatric Dentistry';
  if (/periodontal|perio/.test(text)) return 'Periodontics';
  if (/endo/.test(text)) return 'Endodontics';
  if (/hygiene/.test(text)) return 'Dental Hygiene';
  if (/billing|roi|section 179|practice|profit|marketing|ai/.test(text)) return 'Practice Management & Business';
  if (/restorative|esthetic|veneer/.test(text)) return 'Restorative Dentistry';
  return 'Digital Dentistry & Technology';
}

function parseCredits(text = '') {
  const match = text.match(/(\d+(?:\.\d+)?)\s*CE/i);
  return match ? `${match[1]} CE credit${match[1] === '1' ? '' : 's'}` : '';
}

function parsePrice(text = '') {
  const match = text.match(/\$\s?\d[\d,]*(?:\.\d{2})?/);
  return match ? match[0].replace(/\s+/g, '') : '';
}

function parseSpeaker(text = '') {
  const match = text.match(/Speaker:\s*([^|]+?)(?=(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\.|$)/i);
  return match ? cleanText(match[1], 160) : '';
}

function parseLiveDateText(text = '') {
  const match = text.match(/((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\.,?\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
  return match ? cleanText(match[1], 120) : '';
}

function parseStartDateFromDateText(text = '') {
  const dateText = parseLiveDateText(text).replace(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\.,?\s+/i, '');
  return dateText ? parseIsoDate(dateText) : '';
}

function parseTimeWindow(text = '') {
  const match = text.match(/(\d{1,2}(?::\d{2})?\s*[AP]M\s*[–-]\s*\d{1,2}(?::\d{2})?\s*[AP]M\s*[A-Z]{1,4})/i);
  return match ? cleanText(match[1], 80) : '';
}

function buildLiveRows($) {
  const rows = [];

  $('a[href*="events.biolase.com/event/"][href*="/summary"]').each((_, link) => {
    const anchor = $(link);
    const column = anchor.closest('.elementor-column');
    if (!column.length) return;

    const titleBlock = cleanText(column.find('.elementor-heading-title').first().text(), 250);
    if (!titleBlock) return;

    const textBlocks = column.find('.elementor-widget-text-editor')
      .map((__, el) => cleanText($(el).text(), 300))
      .get()
      .filter(Boolean);
    const combinedText = textBlocks.join(' | ');
    const price = parsePrice(combinedText);
    const instructor = parseSpeaker(combinedText);
    const dateText = parseLiveDateText(combinedText);
    const startDate = parseStartDateFromDateText(combinedText);
    const timeWindow = parseTimeWindow(combinedText);
    const creditsText = parseCredits(titleBlock) || parseCredits(combinedText);
    const registerUrl = absoluteUrl(anchor.attr('href') || '', BIOLASE_WEBINARS_URL);
    const title = cleanText(titleBlock.replace(/\b\d+\s*CE credit[s]?\b/i, ''), 250);
    const topic = inferTopic(title);

    rows.push(normalizeCourse({
      provider: BIOLASE_PROVIDER,
      provider_slug: BIOLASE_PROVIDER_SLUG,
      source_url: BIOLASE_WEBINARS_URL,
      url: registerUrl,
      title,
      description: cleanText(`${title}. ${timeWindow}`.trim(), 300),
      course_type: /training/i.test(title) ? 'Live Training' : 'Live Webinar',
      format: /virtual/i.test(title) || /webinar/i.test(title) ? 'Live Streaming' : 'Live',
      audience: /hygiene|rdh/i.test(title) ? 'Dental Hygienists' : 'Dentists and Dental Team',
      topic,
      credits_text: creditsText,
      price,
      start_date: startDate,
      date_text: [dateText, timeWindow].filter(Boolean).join(' | '),
      location: /virtual|webinar/i.test(title) ? 'Online' : 'See registration page',
      instructors: instructor,
      accreditation: 'BIOLASE Education',
      tags: ['BIOLASE', 'Live', topic].filter(Boolean),
      metadata: {
        extracted_from: 'biolase-live-webinars',
        registration_url: registerUrl,
      },
    }));
  });

  return rows;
}

function parseDateFromTitle(title = '') {
  const match = title.match(/(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return '';
  const [, month, day, year] = match;
  return parseIsoDate(`${year}-${month}-${day}`);
}

function buildOnDemandRows($) {
  return $('.premium-gallery-item')
    .map((_, element) => {
      const item = $(element);
      const title = cleanText(item.find('.premium-gallery-img-name').first().text(), 250);
      const mediaUrl = absoluteUrl(item.find('a.pa-gallery-img-link').first().attr('href') || '', BIOLASE_ON_DEMAND_URL);
      const classes = (item.attr('class') || '').split(/\s+/).filter(Boolean);
      const imageAlt = cleanText(item.find('img').first().attr('alt') || '', 250);
      const titleSource = title || imageAlt;

      if (!titleSource || !mediaUrl) return null;

      const topic = inferTopic(titleSource, classes);
      const date = parseDateFromTitle(titleSource);

      return normalizeCourse({
        provider: BIOLASE_PROVIDER,
        provider_slug: BIOLASE_PROVIDER_SLUG,
        source_url: BIOLASE_ON_DEMAND_URL,
        url: mediaUrl,
        title: titleSource,
        description: '',
        course_type: 'On-Demand Webinar',
        format: 'Online',
        audience: /hygiene|rdh/i.test(titleSource) ? 'Dental Hygienists' : 'Dentists and Dental Team',
        topic,
        start_date: date,
        date_text: date ? cleanText(date, 20) : '',
        location: 'Online',
        accreditation: 'BIOLASE Education',
        tags: ['BIOLASE', 'On Demand', topic, ...classes.filter((name) => !/^premium-gallery-item|elementor-repeater-item|premium-gallery-item-hidden|all$/i.test(name))],
        metadata: {
          extracted_from: 'biolase-on-demand-gallery',
          media_url: mediaUrl,
          image_alt: imageAlt,
        },
      });
    })
    .get()
    .filter(Boolean);
}

export async function scrapeBiolase() {
  console.log('   • Scraping BIOLASE Education public catalog');

  const [$live, $ondemand] = await Promise.all([
    loadHTML(BIOLASE_WEBINARS_URL),
    loadHTML(BIOLASE_ON_DEMAND_URL),
  ]);

  const liveRows = buildLiveRows($live);
  const ondemandRows = buildOnDemandRows($ondemand);
  const seen = new Set();
  const rows = [...liveRows, ...ondemandRows].filter((row) => {
    const key = `${row.title}||${row.url}||${row.start_date}||${row.format}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`   • Extracted ${rows.length} BIOLASE Education rows`);
  return rows;
}
