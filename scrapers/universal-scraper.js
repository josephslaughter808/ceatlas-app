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
import { scrapeAchieveCE } from './providers/achievece.js';
import { scrapeADHA } from './providers/adha.js';
import { scrapeAGD } from './providers/agd.js';
import { scrapeAAFE } from './providers/aafe.js';
import { scrapeBiolase } from './providers/biolase.js';
import { scrapeBU } from './providers/bu.js';
import { scrapeBuffalo } from './providers/buffalo.js';
import { scrapeCarestream } from './providers/carestream.js';
import { scrapeCEZoom } from './providers/cezoom.js';
import { scrapeColoradoCE } from './providers/colorado.js';
import { scrapeDigitellConference } from './providers/digitell.js';
import { scrapeDMG } from './providers/dmg.js';
import { scrapeDACE } from './providers/dace.js';
import { scrapeDDSCommunities } from './providers/dds-communities.js';
import { scrapeDDSWorld } from './providers/ddsworld.js';
import { scrapeDentaltown } from './providers/dentaltown.js';
import { scrapeDimensions } from './providers/dimensions.js';
import { scrapeGIDE } from './providers/gide.js';
import { scrapeGNYDM } from './providers/gnydm.js';
import { scrapeHenryScheinOrtho } from './providers/henryscheinortho.js';
import { scrapeHygienetown } from './providers/hygienetown.js';
import { scrapeIHS } from './providers/ihs.js';
import { scrapeColumbia } from './providers/columbia.js';
import { scrapeEventscribeConference } from './providers/eventscribe.js';
import { scrapeGlidewell } from './providers/glidewell.js';
import { scrapeHinman } from './providers/hinman.js';
import { scrapeIowa } from './providers/iowa.js';
import { scrapeIvoclar } from './providers/ivoclar.js';
import { scrapeKuraray } from './providers/kuraray.js';
import { scrapeLLU } from './providers/llu.js';
import { scrapeMarylandMSDA } from './providers/maryland.js';
import { scrapeNetCE } from './providers/netce.js';
import { scrapeNova } from './providers/nova.js';
import { scrapeOHIS } from './providers/ohis.js';
import { scrapePenn } from './providers/penn.js';
import { scrapePennLectureHall } from './providers/penn-lecturehall.js';
import { scrapePlanmeca } from './providers/planmeca.js';
import { scrapeCDEWorld } from './providers/cdeworld.js';
import { scrapeCDOCS } from './providers/cdocs.js';
import { scrapeDOCSEducation } from './providers/docseducation.js';
import { scrapeColgate } from './providers/colgate.js';
import { scrapeEAOBatch } from './providers/eao-batch.js';
import { scrapeDentsply } from './providers/dentsply.js';
import { scrapePikos } from './providers/pikos.js';
import { scrapePDC } from './providers/pdc.js';
import { scrapeSpear } from './providers/spear.js';
import { scrapeStraumannSeeded } from './providers/straumann-seeded.js';
import { scrapeAnthogyrSeeded } from './providers/anthogyr-seeded.js';
import {
  ALL_STATE_ASSOCIATION_WAVES,
  crawlStateAssociation,
} from './providers/state-associations.js';
import { scrapeTemple } from './providers/temple.js';
import { scrapeITIWorldSymposium } from './providers/iti-world-symposium.js';
import { scrapeStyleItalianoBatch } from './providers/styleitaliano-batch.js';
import { scrapeTufts } from './providers/tufts.js';
import { scrapeTuftsGlobalEurope } from './providers/tufts-global-europe.js';
import { scrapeUBCCPE } from './providers/ubc-cpe.js';
import { scrapeUBC } from './providers/ubc.js';
import { scrapeUFBatch } from './providers/uf-batch.js';
import { scrapeUIC } from './providers/uic.js';
import { scrapeUCLA } from './providers/ucla.js';
import { scrapeUltradent } from './providers/ultradent.js';
import { scrapeUMN } from './providers/umn.js';
import { scrapeUKYBatch } from './providers/uky-batch.js';
import { scrapeUW } from './providers/uw.js';
import { scrapeViva, scrapeVivaDirectOnDemand } from './providers/viva.js';
import { scrapeWorldDentalAcademy } from './providers/worlddentalacademy.js';
import { scrapeYankee } from './providers/yankee.js';
import { scrapeZahn } from './providers/zahn.js';
import { scrapeOsteologyBatch } from './providers/osteology-batch.js';
import { scrapeOrthotown } from './providers/orthotown.js';

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

const STATE_ASSOCIATION_PROVIDERS = Object.fromEntries(
  ALL_STATE_ASSOCIATION_WAVES.map((config) => [new URL(config.startUrl).hostname.replace('www.', ''), config]),
);
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

  if (hostname.includes('achievece.com')) {
    return scrapeAchieveCE();
  }

  if (hostname.includes('adha.org') || hostname.includes('mymembership.adha.org')) {
    return scrapeADHA();
  }

  if (hostname.includes('dentaltown.com')) {
    return scrapeDentaltown();
  }

  if (hostname.includes('dentalacademyofce.com')) {
    return scrapeDACE();
  }

  if (hostname.includes('dimensionsofdentalhygiene.com')) {
    return scrapeDimensions();
  }

  if (hostname.includes('hygienetown.com')) {
    return scrapeHygienetown();
  }

  if (hostname.includes('orthotown.com')) {
    return scrapeOrthotown();
  }

  if (hostname.includes('dds.world')) {
    return scrapeDDSWorld();
  }

  if (hostname.includes('events.gidedental.com') || hostname.includes('gidedental.com')) {
    return scrapeGIDE();
  }

  if (hostname.includes('dtstudyclub.com') && providerUrl.includes('dds-world-communities')) {
    return scrapeDDSCommunities();
  }

  if (hostname.includes('henryscheinortho.com')) {
    return scrapeHenryScheinOrtho();
  }

  if (hostname.includes('ihs.gov') && providerUrl.includes('dentalcde')) {
    return scrapeIHS();
  }

  if (hostname.includes('straumann.com') && providerUrl.includes('/anthogyr/')) {
    return scrapeAnthogyrSeeded();
  }

  if (hostname.includes('straumann.com')) {
    return scrapeStraumannSeeded();
  }

  if (hostname.includes('dental.buffalo.edu')) {
    return scrapeBuffalo();
  }

  if (hostname.includes('dental.cuanschutz.edu')) {
    return scrapeColoradoCE();
  }

  if (hostname.includes('henryschein.com') && providerUrl.includes('/Zahn/Events/ContinuingEducation.aspx')) {
    return scrapeZahn();
  }

  if (hostname.includes('campus.speareducation.com') || hostname.includes('speareducation.com')) {
    return scrapeSpear(providerUrl.includes('campus.speareducation.com') ? providerUrl : 'https://campus.speareducation.com/calendar/');
  }

  if (hostname.includes('facialesthetics.org')) {
    return scrapeAAFE(providerUrl);
  }

  if (hostname.includes('biolase.com') || hostname.includes('events.biolase.com')) {
    return scrapeBiolase();
  }

  if (hostname.includes('bu.edu')) {
    return scrapeBU();
  }

  if (hostname.includes('carestreamdental.com')) {
    return scrapeCarestream();
  }

  if (hostname.includes('cezoom.com')) {
    return scrapeCEZoom();
  }

  if (hostname.includes('dental.columbia.edu')) {
    return scrapeColumbia();
  }

  if (hostname.includes('dmg-america.com')) {
    return scrapeDMG();
  }

  if (hostname === 'msda.com' || hostname === 'www.msda.com') {
    return scrapeMarylandMSDA();
  }

  if (hostname.includes('netce.com')) {
    return scrapeNetCE();
  }

  if (hostname.includes('ohi-s.com')) {
    return scrapeOHIS();
  }

  if (hostname.includes('resources.ivoclar.com') || hostname.includes('ivoclar.com')) {
    return scrapeIvoclar();
  }

  if (hostname.includes('kuraraydental.com')) {
    return scrapeKuraray();
  }

  if (hostname.includes('dentistry.llu.edu')) {
    return scrapeLLU();
  }

  if (hostname.includes('cde.dental.upenn.edu')) {
    return scrapePennLectureHall();
  }

  if (hostname.includes('dental.upenn.edu')) {
    return scrapePenn();
  }

  if (hostname.includes('planmeca.com')) {
    return scrapePlanmeca();
  }

  if (hostname.includes('pikosinstitute.com')) {
    return scrapePikos(providerUrl);
  }

  if (hostname.includes('cdocs.com')) {
    return scrapeCDOCS(providerUrl);
  }

  if (hostname.includes('docseducation.com')) {
    return scrapeDOCSEducation(providerUrl);
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

  if (hostname.includes('glidewelldental.com') || hostname.includes('glidewelldirect.com')) {
    return scrapeGlidewell();
  }

  if (hostname.includes('eao.org')) {
    return scrapeEAOBatch();
  }

  if (hostname.includes('gnydm.com')) {
    return scrapeGNYDM(providerUrl);
  }

  if (hostname.includes('dentistry.uiowa.edu')) {
    return scrapeIowa();
  }

  if (hostname.includes('hinman.org')) {
    return scrapeHinman(providerUrl);
  }

  if (hostname.includes('dental.tufts.edu')) {
    if (providerUrl.includes('/global-academy')) {
      return scrapeTuftsGlobalEurope();
    }
    return scrapeTufts();
  }

  if (hostname.includes('courses.styleitaliano.org')) {
    return scrapeStyleItalianoBatch();
  }

  if (hostname.includes('worldsymposium.iti.org')) {
    return scrapeITIWorldSymposium();
  }

  if (hostname.includes('osteology.org')) {
    return scrapeOsteologyBatch();
  }

  if (hostname.includes('noncredit.temple.edu') || hostname.includes('dentistry.temple.edu')) {
    return scrapeTemple();
  }

  if (hostname.includes('courses.cpe.ubc.ca')) {
    return scrapeUBCCPE();
  }

  if (hostname.includes('dentistry.ubc.ca')) {
    return scrapeUBC();
  }

  if (hostname.includes('dentistry.uic.edu')) {
    return scrapeUIC();
  }

  if (hostname.includes('dentistry.ucla.edu')) {
    return scrapeUCLA();
  }

  if (hostname.includes('dentistry.umn.edu')) {
    return scrapeUMN();
  }

  if (hostname.includes('ce.dental.ufl.edu')) {
    return scrapeUFBatch();
  }

  if (hostname.includes('dentistry.uky.edu') || (hostname.includes('reg.learningstream.com') && providerUrl.includes('aid=UKCOD'))) {
    return scrapeUKYBatch();
  }

  if (hostname.includes('dental.nova.edu') || hostname.includes('reg.learningstream.com')) {
    return scrapeNova();
  }

  if (hostname.includes('dental.washington.edu')) {
    return scrapeUW();
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

  if (hostname.includes('vivalearning.com')) {
    return scrapeVivaDirectOnDemand();
  }

  if (hostname.includes('courses.worlddentalacademy.com') || hostname.includes('worlddentalacademy.com')) {
    return scrapeWorldDentalAcademy();
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

  if (STATE_ASSOCIATION_PROVIDERS[hostname]) {
    return crawlStateAssociation(STATE_ASSOCIATION_PROVIDERS[hostname]);
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
