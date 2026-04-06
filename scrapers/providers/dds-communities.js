import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeCourse } from '../../lib/normalize.js';

const execFileAsync = promisify(execFile);
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';
const SOURCE_URL = 'https://www.dds.world/en/';
const TODAY = new Date().toISOString().slice(0, 10);

const PROVIDER_MAP = {
  'www.nsk-academy.com': {
    provider: 'NSK Academy',
    providerSlug: 'nsk-academy',
    accreditation: 'NSK Academy',
  },
  'www.branemarkacademy.com': {
    provider: 'Branemark Academy',
    providerSlug: 'branemark-academy',
    accreditation: 'Branemark Academy',
  },
  'www.fgmdentalgroupcampus.com': {
    provider: 'FGM Dental Group Campus',
    providerSlug: 'fgm-dental-group-campus',
    accreditation: 'FGM Dental Group Campus',
  },
  'www.vvardis-campus.com': {
    provider: 'Vvardis Campus',
    providerSlug: 'vvardis-campus',
    accreditation: 'Vvardis Campus',
  },
  'www.tokuyamadentalacademy.com': {
    provider: 'Tokuyama Dental Academy',
    providerSlug: 'tokuyama-dental-academy',
    accreditation: 'Tokuyama Dental Academy',
  },
};

function cleanText(value = '', max = 2000) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function inferTopic(text = '') {
  const value = cleanText(text, 500).toLowerCase();
  if (/implant|anterior aesthetics/.test(value)) return 'Implants';
  if (/ortho|aligner/.test(value)) return 'Orthodontics';
  if (/periodontal|regeneration/.test(value)) return 'Periodontics';
  if (/restoration|veneer|aesthetic/.test(value)) return 'Restorative Dentistry';
  if (/curodont|caries/.test(value)) return 'Preventive Dentistry';
  return 'General Dentistry';
}

function extractDateRange(matchText = '') {
  const match = String(matchText).match(/[?&]dates=(\d{8})T\d{6}Z\/(\d{8})T\d{6}Z/i);
  if (!match) return { startDate: '', endDate: '' };

  const toIso = (value) => `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  return {
    startDate: toIso(match[1]),
    endDate: toIso(match[2]),
  };
}

async function loadDDSHTML(url) {
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

  return stdout;
}

export async function scrapeDDSCommunities() {
  console.log('   • Scraping DDS-linked international academy webinars');

  const html = await loadDDSHTML(SOURCE_URL);
  const rows = [];
  const seen = new Set();

  const pattern = /href="http:\/\/www\.google\.com\/calendar\/render\?action=TEMPLATE&text=([^"]+?)&dates=([^"]+?)&details=([^"]+?)&location=(https:\/\/[^"&]+)[^"]*"/g;
  let match;

  while ((match = pattern.exec(html))) {
    const title = cleanText(decodeURIComponent(match[1]), 220);
    const details = cleanText(decodeURIComponent(match[3]), 1800);
    const courseUrl = decodeURIComponent(match[4]);
    if (seen.has(courseUrl)) continue;

    const host = new URL(courseUrl).hostname;
    const providerConfig = PROVIDER_MAP[host];
    if (!providerConfig) continue;

    const { startDate, endDate } = extractDateRange(match[0]);
    if (!startDate || startDate < TODAY) continue;

    seen.add(courseUrl);

    rows.push(normalizeCourse({
      provider: providerConfig.provider,
      provider_slug: providerConfig.providerSlug,
      source_url: SOURCE_URL,
      url: courseUrl,
      title,
      description: details || `${providerConfig.provider} webinar: ${title}.`,
      course_type: 'Webinar',
      format: 'Online',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${title} ${details}`),
      start_date: startDate,
      end_date: endDate || startDate,
      date_text: startDate,
      location: 'Online',
      country: 'International',
      accreditation: providerConfig.accreditation,
      tags: [providerConfig.provider, 'DDS-linked', inferTopic(`${title} ${details}`)].filter(Boolean),
      metadata: {
        extracted_from: 'dds-world-community-webinars',
      },
    }));
  }

  console.log(`   • Extracted ${rows.length} DDS community rows`);
  return rows;
}
