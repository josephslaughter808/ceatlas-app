import fs from 'fs';
import path from 'path';
import { loadHTML } from '../lib/fetch.js';
import {
  extractCourseDataFromPage,
  extractEmbeddedCourses,
  extractRelevantLinks,
  isLikelyCoursePage,
} from './lib/course-helpers.js';
import { scrapeADA } from './providers/ada.js';
import { scrapeAGD } from './providers/agd.js';
import { scrapeAAFE } from './providers/aafe.js';
import { scrapeDigitellConference } from './providers/digitell.js';
import { scrapeEventscribeConference } from './providers/eventscribe.js';
import { scrapeHinman } from './providers/hinman.js';
import { scrapeCDEWorld } from './providers/cdeworld.js';
import { scrapeColgate } from './providers/colgate.js';
import { scrapeDentsply } from './providers/dentsply.js';
import { scrapePikos } from './providers/pikos.js';
import { scrapePDC } from './providers/pdc.js';
import { scrapeSpear } from './providers/spear.js';
import { scrapeUltradent } from './providers/ultradent.js';
import { scrapeViva } from './providers/viva.js';
import { scrapeYankee } from './providers/yankee.js';

const EVENTSCRIBE_PROVIDERS = {
  'odc2026.eventscribe.net': {
    provider: 'ODC',
    providerSlug: 'odc',
    startUrl: 'https://odc2026.eventscribe.net/agenda.asp?all=1',
    accreditation: 'Oregon Dental Conference',
    sessionConcurrency: 3,
    city: 'Portland',
    state: 'OR',
    country: 'USA',
    defaultLocation: 'Portland, OR',
  },
  'aapd2026.eventscribe.net': {
    provider: 'AAPD',
    providerSlug: 'aapd',
    startUrl: 'https://aapd2026.eventscribe.net/agenda.asp?BCFO=&embedded=true&enddate=5%2F23%2F2026&fa=&fb=&fc=&fd=&pfp=&startdate=5%2F23%2F2026',
    accreditation: 'American Academy of Pediatric Dentistry',
    sessionConcurrency: 2,
    city: '',
    state: '',
    country: 'USA',
    defaultLocation: 'AAPD 2026 Annual Session',
  },
  'nohc2026.eventscribe.net': {
    provider: 'NOHC',
    providerSlug: 'nohc',
    startUrl: 'https://nohc2026.eventscribe.net/agenda.asp?pfp=FullSchedule',
    accreditation: 'National Oral Health Conference',
    sessionConcurrency: 1,
    city: '',
    state: '',
    country: 'USA',
    defaultLocation: 'National Oral Health Conference 2026',
  },
  'pndc2026.eventscribe.net': {
    provider: 'PNDC',
    providerSlug: 'pndc',
    startUrl: 'https://pndc2026.eventscribe.net/agenda.asp?pfp=BrowsebyDay',
    accreditation: 'Pacific Northwest Dental Conference',
    sessionConcurrency: 1,
    city: '',
    state: '',
    country: 'USA',
    defaultLocation: 'Pacific Northwest Dental Conference 2026',
  },
};

const DIGITELL_PROVIDERS = {
  'education.aaoinfo.org': {
    provider: 'AAO',
    providerSlug: 'aao',
    scheduleUrl: 'https://education.aaoinfo.org/live/1013/page/5556',
    accreditation: 'American Association of Orthodontists Annual Session 2026',
    city: 'Orlando',
    state: 'FL',
    country: 'USA',
    format: 'In Person',
  },
};

const MAX_PAGES_PER_PROVIDER = 60;
const DEFAULT_PROVIDER_TIMEOUT_MS = 120000;
const SLOW_PROVIDER_TIMEOUT_MS = 300000;

function providerTimeoutMs(providerUrl) {
  const hostname = new URL(providerUrl).hostname.replace('www.', '');

  if (
    hostname.includes('facialesthetics.org')
    || hostname.includes('nohc2026.eventscribe.net')
    || hostname.includes('pndc2026.eventscribe.net')
    || hostname.includes('odc2026.eventscribe.net')
    || hostname.includes('agd2026.eventscribe.net')
  ) {
    return SLOW_PROVIDER_TIMEOUT_MS;
  }

  return DEFAULT_PROVIDER_TIMEOUT_MS;
}

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function scrapeCoursePage(url, provider, providerUrl) {
  console.log(`      → Scraping page: ${url}`);
  const $ = await loadHTML(url);
  return extractCourseDataFromPage($, {
    provider,
    providerUrl,
    pageUrl: url,
  });
}

async function crawlProvider(providerUrl, provider) {
  const queue = [providerUrl];
  const visited = new Set();
  const discovered = new Set([providerUrl]);
  const rows = [];

  while (queue.length > 0 && visited.size < MAX_PAGES_PER_PROVIDER) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;

    visited.add(url);
    console.log(`      → Visiting: ${url}`);

    let $;
    try {
      $ = await loadHTML(url);
    } catch (error) {
      console.error(`      ⚠️ Failed to load ${url}: ${error.message}`);
      continue;
    }

    const row = extractCourseDataFromPage($, {
      provider,
      providerUrl,
      pageUrl: url,
    });

    const embeddedRows = extractEmbeddedCourses($, {
      provider,
      providerUrl,
      pageUrl: url,
    });

    for (const embeddedRow of embeddedRows) {
      rows.push(embeddedRow);
    }

    if (isLikelyCoursePage(row)) {
      rows.push(row);
    }

    const links = extractRelevantLinks($, url);

    for (const link of links) {
      if (discovered.has(link)) continue;
      discovered.add(link);
      queue.push(link);
    }
  }

  if (rows.length === 0) {
    const fallbackRow = await scrapeCoursePage(providerUrl, provider, providerUrl);
    if (isLikelyCoursePage(fallbackRow)) {
      rows.push(fallbackRow);
    }
  }

  console.log(`   • Crawled ${visited.size} pages and extracted ${rows.length} likely courses`);
  return rows;
}

async function scrapeProvider(providerUrl) {
  console.log(`▶️ Provider URL: ${providerUrl}`);

  const hostname = new URL(providerUrl).hostname.replace('www.', '');
  const provider = hostname.split('.')[0].toUpperCase();

  if (provider === 'ADA') {
    return scrapeADA(providerUrl);
  }

  if (hostname.includes('campus.speareducation.com') || hostname.includes('speareducation.com')) {
    return scrapeSpear(providerUrl.includes('campus.speareducation.com') ? providerUrl : 'https://campus.speareducation.com/calendar/');
  }

  if (hostname.includes('facialesthetics.org')) {
    return scrapeAAFE(providerUrl);
  }

  if (hostname.includes('pikosinstitute.com')) {
    return scrapePikos(providerUrl);
  }

  if (hostname.includes('dentsplysirona.com')) {
    return scrapeDentsply(providerUrl);
  }

  if (hostname.includes('ultradent.cdeworld.com')) {
    return scrapeUltradent(providerUrl);
  }

  if (hostname.includes('cdeworld.com')) {
    return scrapeCDEWorld(providerUrl);
  }

  if (hostname.includes('colgateoralhealthnetwork.com')) {
    return scrapeColgate(providerUrl);
  }

  if (hostname.includes('hinman.org')) {
    return scrapeHinman(providerUrl);
  }

  if (hostname.includes('pacificdentalconference.com') || hostname.includes('pdconf.com')) {
    return scrapePDC('https://pacificdentalconference.com/schedule/');
  }

  if (hostname.includes('yankeedental.com')) {
    return scrapeYankee(providerUrl);
  }

  if (hostname.includes('ce.edu.dental')) {
    return scrapeViva(providerUrl);
  }

  if (hostname.includes('agd2026.eventscribe.net')) {
    return scrapeAGD(providerUrl);
  }

  if (DIGITELL_PROVIDERS[hostname]) {
    return scrapeDigitellConference(DIGITELL_PROVIDERS[hostname]);
  }

  if (EVENTSCRIBE_PROVIDERS[hostname]) {
    return scrapeEventscribeConference(EVENTSCRIBE_PROVIDERS[hostname]);
  }

  if (hostname.includes('mymembership.adha.org')) {
    console.log('   • Provider requires login / CE Smart – skipping');
    return [];
  }

  return crawlProvider(providerUrl, provider);
}

export async function scrapeFromList(listPath) {
  const fullPath = path.join(process.cwd(), listPath);
  const urls = fs.readFileSync(fullPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  console.log(`📄 Found ${urls.length} provider URLs`);

  const allRows = [];

  for (const url of urls) {
    try {
      const rows = await withTimeout(
        scrapeProvider(url),
        providerTimeoutMs(url),
        `Provider ${url}`,
      );
      allRows.push(...rows);
      console.log(`   • Provider completed with ${rows.length} rows`);
    } catch (error) {
      console.error(`⚠️ Error scraping provider ${url}: ${error.message}`);
    }
  }

  console.log(`\n✅ Universal scraping complete. Collected ${allRows.length} rows.`);
  return allRows;
}
