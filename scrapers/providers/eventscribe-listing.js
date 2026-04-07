import * as cheerio from 'cheerio';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeCourse } from '../../lib/normalize.js';

const execFileAsync = promisify(execFile);
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

const FUTURE_IN_PERSON_CONFERENCES = [
  {
    provider: 'AAPD 2026',
    providerSlug: 'aapd-2026',
    sourceUrl: 'https://aapd2026.eventscribe.net/agenda.asp?BCFO=&pfp=FullSchedule&fa=&fb=&fc=&fd=&all=1',
    accreditation: 'American Academy of Pediatric Dentistry Annual Session 2026',
    location: 'San Diego, CA',
    city: 'San Diego',
    state: 'CA',
    country: 'USA',
    topic: 'Pediatric Dentistry',
  },
  {
    provider: 'AAOMS 2026',
    providerSlug: 'aaoms-2026',
    sourceUrl: 'https://aaoms-annual-meeting-2026.eventscribe.net/agenda.asp?BCFO=EE|G|IP|M&pfp=FullSchedule&fa=&fb=&fc=&fd=&all=1',
    accreditation: 'American Association of Oral and Maxillofacial Surgeons Annual Meeting 2026',
    location: 'Portland, OR',
    city: 'Portland',
    state: 'OR',
    country: 'USA',
    topic: 'Oral Surgery',
  },
  {
    provider: 'PNDC 2026',
    providerSlug: 'pndc-2026',
    sourceUrl: 'https://pndc2026.eventscribe.net/agenda.asp?pfp=BrowsebyDay&all=1',
    accreditation: 'Pacific Northwest Dental Conference 2026',
    location: 'Seattle Convention Center, Seattle, WA',
    city: 'Seattle',
    state: 'WA',
    country: 'USA',
    topic: 'General Dentistry',
  },
  {
    provider: 'NOHC 2026',
    providerSlug: 'nohc-2026',
    sourceUrl: 'https://nohc2026.eventscribe.net/agenda.asp?pfp=BrowsebyDay&all=1',
    accreditation: 'National Oral Health Conference 2026',
    location: 'Oklahoma City, OK',
    city: 'Oklahoma City',
    state: 'OK',
    country: 'USA',
    topic: 'Dental Public Health',
  },
  {
    provider: 'ODC 2026',
    providerSlug: 'odc-2026',
    sourceUrl: 'https://odc2026.eventscribe.net/agenda.asp?all=1',
    accreditation: 'Oregon Dental Conference 2026',
    location: 'Portland, OR',
    city: 'Portland',
    state: 'OR',
    country: 'USA',
    topic: 'General Dentistry',
  },
  {
    provider: 'AGD 2026',
    providerSlug: 'agd-2026',
    sourceUrl: 'https://agd2026.eventscribe.net/agenda.asp?pfp=BrowsebyDay&all=1',
    accreditation: 'Academy of General Dentistry Scientific Session 2026',
    location: 'Louisville, KY',
    city: 'Louisville',
    state: 'KY',
    country: 'USA',
    topic: 'General Dentistry',
  },
];

const EXCLUDED_TITLE_PATTERN = /\b(registration|information|headquarters|speaker ready|committee|caucus|board meeting|business meeting|executive committee|delegates|luggage|first aid|mothers[’']? room|breakfast|lunch|dinner|reception|exhibit hall|coffee break|poster setup|staff meeting|volunteer|orientation)\b/i;

function cleanText(value = '', max = 1200) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = '') {
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function parseDayRow(value = '') {
  const text = cleanText(value, 120);
  if (!text) return '';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function inferTopic(config, title = '') {
  const value = title.toLowerCase();
  if (/implant|graft|orthognathic|zygoma/.test(value)) return 'Implants';
  if (/anesthesia|sedation|opioid|pain|pharmac/.test(value)) return 'Pharmacology';
  if (/pathology|medicine|cancer|lesion/.test(value)) return 'Oral Medicine';
  if (/sleep|airway|apnea/.test(value)) return 'Sleep & Airway';
  if (/pediatric|child|infant|adolescent/.test(value)) return 'Pediatric Dentistry';
  if (/surgery|surgical|maxillofacial|trauma|tmj/.test(value)) return 'Oral Surgery';
  return config.topic || 'Conference Session';
}

function shouldKeepTitle(title = '') {
  const text = cleanText(title, 250);
  if (!text || text.length < 8) return false;
  if (EXCLUDED_TITLE_PATTERN.test(text)) return false;
  return true;
}

async function fetchHTML(url) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'User-Agent': BROWSER_USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`Eventscribe listing returned ${response.status} for ${url}`);
    }

    return response.text();
  } catch (error) {
    if (!['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT'].includes(error?.cause?.code || error?.code)) {
      throw error;
    }

    const { stdout } = await execFileAsync('curl', [
      '-L',
      '--max-time',
      '35',
      '-A',
      BROWSER_USER_AGENT,
      '-H',
      'Accept: text/html,application/xhtml+xml,*/*;q=0.8',
      url,
    ], {
      maxBuffer: 20 * 1024 * 1024,
    });

    return stdout;
  }
}

function parseRows(config, html = '') {
  const $ = cheerio.load(html);
  const rows = [];
  const seen = new Set();
  let currentDayText = '';
  let currentIsoDate = '';

  function parseSession(element) {
    const item = $(element);
    const detailPath = item.attr('data-url') || '';
    const detailUrl = absoluteUrl(detailPath, config.sourceUrl);
    const title = cleanText(item.find('.list-row-primary').first().text(), 300);
    const timeText = cleanText(item.find('.prestime').first().text(), 120);

    if (!detailUrl || seen.has(detailUrl) || !shouldKeepTitle(title)) return;
    seen.add(detailUrl);

    rows.push(normalizeCourse({
      provider: config.provider,
      provider_slug: config.providerSlug,
      source_url: config.sourceUrl,
      url: detailUrl,
      title,
      description: `${title} is listed as an in-person conference session in ${config.accreditation}.`,
      course_type: 'Conference Session',
      format: 'In Person',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(config, title),
      credits_text: '',
      price: '',
      start_date: currentIsoDate,
      end_date: currentIsoDate,
      date_text: [currentDayText, timeText].filter(Boolean).join(' • '),
      location: config.location,
      city: config.city,
      state: config.state,
      country: config.country || 'USA',
      accreditation: config.accreditation,
      tags: ['Conference', 'In Person', config.provider, inferTopic(config, title)].filter(Boolean),
      metadata: {
        extracted_from: 'eventscribe-lightweight-listing',
        presentation_id: item.attr('data-presid') || null,
        build_code: item.attr('data-buildcode') || null,
      },
    }));
  }

  $('#agenda').children().each((_, element) => {
    const item = $(element);

    if (item.is('li.dayrow')) {
      currentDayText = cleanText(item.text(), 120);
      currentIsoDate = parseDayRow(currentDayText);
      return;
    }

    if (item.is('li.loadbyurl')) {
      parseSession(element);
      return;
    }

    item.find('li.loadbyurl').each((__, nested) => {
      parseSession(nested);
    });
  });

  return rows;
}

export async function scrapeFutureInPersonEventscribeListings() {
  console.log('   • Scraping future in-person Eventscribe conference listings');
  const rows = [];

  for (const config of FUTURE_IN_PERSON_CONFERENCES) {
    try {
      const html = await fetchHTML(config.sourceUrl);
      const parsed = parseRows(config, html);
      rows.push(...parsed);
      console.log(`      • ${config.provider}: ${parsed.length} in-person listing rows`);
    } catch (error) {
      console.log(`      ⚠️ ${config.provider} skipped: ${error.message}`);
    }
  }

  console.log(`   • Extracted ${rows.length} future in-person Eventscribe rows`);
  return rows;
}
