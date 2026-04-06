import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as cheerio from 'cheerio';
import { normalizeCourse } from '../../lib/normalize.js';

const execFileAsync = promisify(execFile);
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

const PAGES = [
  { url: 'https://worldsymposium.iti.org/main-sessions/', pageLabel: 'Main Sessions' },
  { url: 'https://worldsymposium.iti.org/parallel-sessions/', pageLabel: 'Parallel Sessions' },
  { url: 'https://worldsymposium.iti.org/workshops/', pageLabel: 'Workshops' },
];

function cleanText(value = '', max = 2000) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function toIsoDate(dateText = '') {
  const match = cleanText(dateText, 40).match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!match) return '';

  const [, monthText, dayText, yearText] = match;
  const monthMap = {
    january: '01',
    february: '02',
    march: '03',
    april: '04',
    may: '05',
    june: '06',
    july: '07',
    august: '08',
    september: '09',
    october: '10',
    november: '11',
    december: '12',
  };

  const month = monthMap[monthText.toLowerCase()];
  if (!month) return '';

  return `${yearText}-${month}-${String(Number(dayText)).padStart(2, '0')}`;
}

function inferTopic(text = '') {
  const value = cleanText(text, 1500).toLowerCase();
  if (/implant|edentulous|single gap|esthetic zone|multi-disciplinary/.test(value)) return 'Implants';
  if (/digital|ai|guided|workflow/.test(value)) return 'Digital Dentistry & Technology';
  if (/esthetic|aesthetic/.test(value)) return 'Esthetics & Facial Esthetics';
  if (/workshop/.test(value)) return 'Hands-On Training';
  return 'Implants';
}

function extractDescription($card, $) {
  const paragraphs = $card
    .find('p')
    .map((_, element) => cleanText($(element).text(), 350))
    .get()
    .filter((text) => (
      text
      && text.length > 40
      && !/^speaker$/i.test(text)
      && !/^topic$/i.test(text)
      && !/no events found/i.test(text)
    ));

  return paragraphs.slice(0, 3).join(' ');
}

function extractTimes($card, $) {
  const values = $card
    .find('div')
    .map((_, element) => cleanText($(element).text(), 80))
    .get()
    .filter((text) => /\d{1,2}:\d{2}\s*[ap]m\s*[–-]\s*\d{1,2}:\d{2}\s*[ap]m/i.test(text));

  return [...new Set(values)];
}

function extractCategory($card, $, fallback = '') {
  const values = $card
    .find('div')
    .map((_, element) => cleanText($(element).text(), 120))
    .get();

  return values.find((text) => /session|forum|workshop/i.test(text)) || fallback;
}

function extractSpeakers($card, $) {
  const speakers = $card
    .find('.speaker-name')
    .map((_, element) => cleanText($(element).text(), 120))
    .get()
    .filter(Boolean);

  return [...new Set(speakers)].join('\n');
}

async function loadITIHTML(url) {
  const { stdout } = await execFileAsync('curl', [
    '-L',
    '--max-time',
    '40',
    '-A',
    BROWSER_USER_AGENT,
    '-H',
    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    url,
  ], {
    maxBuffer: 24 * 1024 * 1024,
  });

  return cheerio.load(stdout);
}

export async function scrapeITIWorldSymposium() {
  console.log('   • Scraping ITI World Symposium 2027');

  const rows = [];

  for (const page of PAGES) {
    const $ = await loadITIHTML(page.url);

    $('.event-card').each((_, element) => {
      const $card = $(element);
      const title = cleanText($card.find('h2').first().text(), 250);
      if (!title || /open slot|tbc/i.test(title)) return;

      const dateText = cleanText($card.attr('data-date') || '', 40);
      const startDate = toIsoDate(dateText);
      const times = extractTimes($card, $);
      const category = extractCategory($card, $, page.pageLabel);
      const description = extractDescription($card, $);
      const instructors = extractSpeakers($card, $);
      const anchor = cleanText($card.attr('id') || '', 160);

      rows.push(normalizeCourse({
        provider: 'ITI World Symposium 2027',
        provider_slug: 'iti-world-symposium-2027',
        source_url: page.url,
        url: anchor ? `${page.url}#${anchor}` : page.url,
        title,
        description: description || `ITI World Symposium 2027 ${category.toLowerCase()}: ${title}.`,
        course_type: category,
        format: 'In Person',
        audience: 'Dentists and Implant Teams',
        topic: inferTopic(`${title} ${description} ${category}`),
        start_date: startDate,
        end_date: startDate,
        date_text: [dateText, times[0]].filter(Boolean).join(' • '),
        location: 'Milan, Italy',
        city: 'Milan',
        country: 'Italy',
        instructors,
        accreditation: 'International Team for Implantology',
        tags: ['ITI', 'World Symposium', 'Milan', page.pageLabel, category].filter(Boolean),
        metadata: {
          extracted_from: 'iti-world-symposium-program',
          page: page.pageLabel,
          category,
          session_times: times,
        },
      }));
    });
  }

  console.log(`   • Extracted ${rows.length} ITI World Symposium rows`);
  return rows;
}
