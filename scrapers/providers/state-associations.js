import { loadHTML } from '../../lib/fetch.js';
import {
  extractCourseDataFromPage,
  extractRelevantLinks,
  isLikelyCoursePage,
} from '../lib/course-helpers.js';

const MAX_PAGES_PER_PROVIDER = 30;

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

export async function crawlStateAssociation(config) {
  const queue = uniq([config.startUrl, ...(config.seedUrls || [])]);
  const discovered = new Set(queue);
  const visited = new Set();
  const rows = [];
  const courseKeys = new Set();

  while (queue.length > 0 && visited.size < MAX_PAGES_PER_PROVIDER) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    let $;
    try {
      $ = await loadHTML(url);
    } catch (error) {
      console.error(`      ⚠️ Failed to load ${url}: ${error.message}`);
      continue;
    }

    const row = extractCourseDataFromPage($, {
      provider: config.provider,
      providerUrl: config.startUrl,
      pageUrl: url,
    });

    const enriched = {
      ...row,
      provider: config.provider,
      provider_slug: config.providerSlug,
      accreditation: row.accreditation || config.provider,
      location: row.location || config.defaultLocation || '',
      state: row.state || config.state || '',
      country: row.country || 'USA',
      metadata: {
        ...(row.metadata || {}),
        scraped_from_state_association: true,
      },
    };

    if (isLikelyCoursePage(enriched)) {
      const key = `${enriched.title}||${enriched.url}`;
      if (!courseKeys.has(key)) {
        courseKeys.add(key);
        rows.push(enriched);
      }
    }

    const links = extractRelevantLinks($, url);
    for (const link of links) {
      if (!discovered.has(link)) {
        discovered.add(link);
        queue.push(link);
      }
    }
  }

  console.log(`   • ${config.provider}: crawled ${visited.size} pages and extracted ${rows.length} rows`);
  return rows;
}

export const STATE_ASSOCIATION_WAVE_1 = [
  {
    provider: 'California Dental Association CE',
    providerSlug: 'california-dental-association-ce',
    startUrl: 'https://www.cda.org/',
    defaultLocation: 'California',
    state: 'CA',
  },
  {
    provider: 'Colorado Dental Association CE',
    providerSlug: 'colorado-dental-association-ce',
    startUrl: 'https://www.cdaonline.org/',
    defaultLocation: 'Colorado',
    state: 'CO',
  },
  {
    provider: 'Connecticut State Dental Association CE',
    providerSlug: 'connecticut-state-dental-association-ce',
    startUrl: 'https://www.csda.com/',
    defaultLocation: 'Connecticut',
    state: 'CT',
  },
  {
    provider: 'Delaware State Dental Society CE',
    providerSlug: 'delaware-state-dental-society-ce',
    startUrl: 'https://www.delawarestatedentalsociety.org/',
    defaultLocation: 'Delaware',
    state: 'DE',
  },
  {
    provider: 'Florida Dental Association CE',
    providerSlug: 'florida-dental-association-ce',
    startUrl: 'https://www.floridadental.org/',
    defaultLocation: 'Florida',
    state: 'FL',
  },
  {
    provider: 'Georgia Dental Association CE',
    providerSlug: 'georgia-dental-association-ce',
    startUrl: 'https://www.gadental.org/',
    defaultLocation: 'Georgia',
    state: 'GA',
  },
  {
    provider: 'Illinois State Dental Society CE',
    providerSlug: 'illinois-state-dental-society-ce',
    startUrl: 'https://www.isds.org/',
    defaultLocation: 'Illinois',
    state: 'IL',
  },
  {
    provider: 'Maryland State Dental Association CE',
    providerSlug: 'maryland-state-dental-association-ce',
    startUrl: 'https://msda.com/continuing-education/',
    seedUrls: [
      'https://msda.com/',
      'https://msda.com/continuing-education/',
    ],
    defaultLocation: 'Maryland',
    state: 'MD',
  },
  {
    provider: 'Massachusetts Dental Society CE',
    providerSlug: 'massachusetts-dental-society-ce',
    startUrl: 'https://www.massdental.org/',
    defaultLocation: 'Massachusetts',
    state: 'MA',
  },
  {
    provider: 'Michigan Dental Association CE',
    providerSlug: 'michigan-dental-association-ce',
    startUrl: 'https://www.smilemichigan.com/',
    defaultLocation: 'Michigan',
    state: 'MI',
  },
  {
    provider: 'Texas Dental Association CE',
    providerSlug: 'texas-dental-association-ce',
    startUrl: 'https://www.tda.org/',
    defaultLocation: 'Texas',
    state: 'TX',
  },
];

export const STATE_ASSOCIATION_WAVE_2 = [
  {
    provider: 'Alabama Dental Association CE',
    providerSlug: 'alabama-dental-association-ce',
    startUrl: 'https://www.aldaonline.org/',
    defaultLocation: 'Alabama',
    state: 'AL',
  },
  {
    provider: 'Arizona Dental Association CE',
    providerSlug: 'arizona-dental-association-ce',
    startUrl: 'https://www.azda.org/',
    defaultLocation: 'Arizona',
    state: 'AZ',
  },
  {
    provider: 'Hawaii Dental Association CE',
    providerSlug: 'hawaii-dental-association-ce',
    startUrl: 'https://www.hawaiidentalassociation.net/',
    defaultLocation: 'Hawaii',
    state: 'HI',
  },
  {
    provider: 'Indiana Dental Association CE',
    providerSlug: 'indiana-dental-association-ce',
    startUrl: 'https://indental.org/',
    defaultLocation: 'Indiana',
    state: 'IN',
  },
  {
    provider: 'Iowa Dental Association CE',
    providerSlug: 'iowa-dental-association-ce',
    startUrl: 'https://www.iowadental.org/',
    defaultLocation: 'Iowa',
    state: 'IA',
  },
  {
    provider: 'Kansas Dental Association CE',
    providerSlug: 'kansas-dental-association-ce',
    startUrl: 'https://www.ksdental.org/',
    defaultLocation: 'Kansas',
    state: 'KS',
  },
  {
    provider: 'Kentucky Dental Association CE',
    providerSlug: 'kentucky-dental-association-ce',
    startUrl: 'https://www.kyda.org/',
    defaultLocation: 'Kentucky',
    state: 'KY',
  },
  {
    provider: 'Louisiana Dental Association CE',
    providerSlug: 'louisiana-dental-association-ce',
    startUrl: 'https://www.ladental.org/',
    defaultLocation: 'Louisiana',
    state: 'LA',
  },
  {
    provider: 'Maine Dental Association CE',
    providerSlug: 'maine-dental-association-ce',
    startUrl: 'https://www.medental.org/',
    defaultLocation: 'Maine',
    state: 'ME',
  },
  {
    provider: 'Mississippi Dental Association CE',
    providerSlug: 'mississippi-dental-association-ce',
    startUrl: 'https://www.msdental.org/',
    defaultLocation: 'Mississippi',
    state: 'MS',
  },
  {
    provider: 'Minnesota Dental Association CE',
    providerSlug: 'minnesota-dental-association-ce',
    startUrl: 'https://www.mndental.org/',
    defaultLocation: 'Minnesota',
    state: 'MN',
  },
  {
    provider: 'Nebraska Dental Association CE',
    providerSlug: 'nebraska-dental-association-ce',
    startUrl: 'https://www.nedental.org/',
    defaultLocation: 'Nebraska',
    state: 'NE',
  },
  {
    provider: 'Nevada Dental Association CE',
    providerSlug: 'nevada-dental-association-ce',
    startUrl: 'https://www.nvda.org/',
    defaultLocation: 'Nevada',
    state: 'NV',
  },
  {
    provider: 'New Hampshire Dental Society CE',
    providerSlug: 'new-hampshire-dental-society-ce',
    startUrl: 'https://www.nhds.org/',
    defaultLocation: 'New Hampshire',
    state: 'NH',
  },
  {
    provider: 'New Jersey Dental Association CE',
    providerSlug: 'new-jersey-dental-association-ce',
    startUrl: 'https://www.njda.org/',
    defaultLocation: 'New Jersey',
    state: 'NJ',
  },
  {
    provider: 'North Carolina Dental Society CE',
    providerSlug: 'north-carolina-dental-society-ce',
    startUrl: 'https://www.ncdental.org/',
    defaultLocation: 'North Carolina',
    state: 'NC',
  },
  {
    provider: 'North Dakota Dental Association CE',
    providerSlug: 'north-dakota-dental-association-ce',
    startUrl: 'https://www.smilenorthdakota.org/',
    defaultLocation: 'North Dakota',
    state: 'ND',
  },
  {
    provider: 'Ohio Dental Association CE',
    providerSlug: 'ohio-dental-association-ce',
    startUrl: 'https://www.oda.org/',
    defaultLocation: 'Ohio',
    state: 'OH',
  },
];

export const STATE_ASSOCIATION_WAVE_3 = [
  {
    provider: 'Alaska Dental Society CE',
    providerSlug: 'alaska-dental-society-ce',
    startUrl: 'https://www.akdental.org/',
    defaultLocation: 'Alaska',
    state: 'AK',
  },
  {
    provider: 'Idaho Dental Association CE',
    providerSlug: 'idaho-dental-association-ce',
    startUrl: 'https://www.theisda.org/',
    defaultLocation: 'Idaho',
    state: 'ID',
  },
  {
    provider: 'New Mexico Dental Association CE',
    providerSlug: 'new-mexico-dental-association-ce',
    startUrl: 'https://www.nmdental.org/',
    defaultLocation: 'New Mexico',
    state: 'NM',
  },
  {
    provider: 'Oklahoma Dental Association CE',
    providerSlug: 'oklahoma-dental-association-ce',
    startUrl: 'https://www.okda.org/',
    defaultLocation: 'Oklahoma',
    state: 'OK',
  },
  {
    provider: 'Oregon Dental Association CE',
    providerSlug: 'oregon-dental-association-ce',
    startUrl: 'https://www.oregondental.org/',
    defaultLocation: 'Oregon',
    state: 'OR',
  },
  {
    provider: 'Pennsylvania Dental Association CE',
    providerSlug: 'pennsylvania-dental-association-ce',
    startUrl: 'https://www.padental.org/',
    defaultLocation: 'Pennsylvania',
    state: 'PA',
  },
  {
    provider: 'Rhode Island Dental Association CE',
    providerSlug: 'rhode-island-dental-association-ce',
    startUrl: 'https://www.ridental.org/',
    defaultLocation: 'Rhode Island',
    state: 'RI',
  },
  {
    provider: 'South Carolina Dental Association CE',
    providerSlug: 'south-carolina-dental-association-ce',
    startUrl: 'https://www.scda.org/',
    defaultLocation: 'South Carolina',
    state: 'SC',
  },
  {
    provider: 'Tennessee Dental Association CE',
    providerSlug: 'tennessee-dental-association-ce',
    startUrl: 'https://www.tndental.org/',
    defaultLocation: 'Tennessee',
    state: 'TN',
  },
  {
    provider: 'Virginia Dental Association CE',
    providerSlug: 'virginia-dental-association-ce',
    startUrl: 'https://www.vadental.org/',
    defaultLocation: 'Virginia',
    state: 'VA',
  },
  {
    provider: 'Washington State Dental Association CE',
    providerSlug: 'washington-state-dental-association-ce',
    startUrl: 'https://www.wsda.org/',
    defaultLocation: 'Washington',
    state: 'WA',
  },
  {
    provider: 'Utah Dental Association CE',
    providerSlug: 'utah-dental-association-ce',
    startUrl: 'https://www.uda.org/',
    defaultLocation: 'Utah',
    state: 'UT',
  },
  {
    provider: 'Wisconsin Dental Association CE',
    providerSlug: 'wisconsin-dental-association-ce',
    startUrl: 'https://www.wda.org/',
    defaultLocation: 'Wisconsin',
    state: 'WI',
  },
];

export const STATE_ASSOCIATION_WAVE_4 = [
  {
    provider: 'Arkansas State Dental Association CE',
    providerSlug: 'arkansas-state-dental-association-ce',
    startUrl: 'https://www.arkansasdentistry.org/',
    defaultLocation: 'Arkansas',
    state: 'AR',
  },
  {
    provider: 'District of Columbia Dental Society CE',
    providerSlug: 'district-of-columbia-dental-society-ce',
    startUrl: 'https://www.dcdental.org/',
    defaultLocation: 'District of Columbia',
    state: 'DC',
  },
  {
    provider: 'Maryland State Dental Association CE',
    providerSlug: 'maryland-state-dental-association-ce',
    startUrl: 'https://msda.com/continuing-education/',
    seedUrls: [
      'https://msda.com/',
      'https://msda.com/continuing-education/',
    ],
    defaultLocation: 'Maryland',
    state: 'MD',
  },
  {
    provider: 'Missouri Dental Association CE',
    providerSlug: 'missouri-dental-association-ce',
    startUrl: 'https://www.modental.org/',
    defaultLocation: 'Missouri',
    state: 'MO',
  },
  {
    provider: 'Montana Dental Association CE',
    providerSlug: 'montana-dental-association-ce',
    startUrl: 'https://www.montanadental.org/',
    defaultLocation: 'Montana',
    state: 'MT',
  },
  {
    provider: 'New York State Dental Association CE',
    providerSlug: 'new-york-state-dental-association-ce',
    startUrl: 'https://www.nysdental.org/',
    defaultLocation: 'New York',
    state: 'NY',
  },
  {
    provider: 'South Dakota Dental Association CE',
    providerSlug: 'south-dakota-dental-association-ce',
    startUrl: 'https://www.sddental.org/',
    defaultLocation: 'South Dakota',
    state: 'SD',
  },
  {
    provider: 'Vermont State Dental Society CE',
    providerSlug: 'vermont-state-dental-society-ce',
    startUrl: 'https://www.vsds.org/',
    defaultLocation: 'Vermont',
    state: 'VT',
  },
  {
    provider: 'West Virginia Dental Association CE',
    providerSlug: 'west-virginia-dental-association-ce',
    startUrl: 'https://wvdental.org/',
    defaultLocation: 'West Virginia',
    state: 'WV',
  },
  {
    provider: 'Wyoming Dental Association CE',
    providerSlug: 'wyoming-dental-association-ce',
    startUrl: 'https://wyda.org/',
    defaultLocation: 'Wyoming',
    state: 'WY',
  },
];

export const STATE_ASSOCIATION_WAVE_2A = STATE_ASSOCIATION_WAVE_2.slice(0, 9);
export const STATE_ASSOCIATION_WAVE_2B = STATE_ASSOCIATION_WAVE_2.slice(9);
export const STATE_ASSOCIATION_WAVE_3A = STATE_ASSOCIATION_WAVE_3.slice(0, 7);
export const STATE_ASSOCIATION_WAVE_3B = STATE_ASSOCIATION_WAVE_3.slice(7);
export const STATE_ASSOCIATION_WAVE_4A = STATE_ASSOCIATION_WAVE_4.slice(0, 5);
export const STATE_ASSOCIATION_WAVE_4B = STATE_ASSOCIATION_WAVE_4.slice(5);

export const ALL_STATE_ASSOCIATION_WAVES = [
  ...STATE_ASSOCIATION_WAVE_1,
  ...STATE_ASSOCIATION_WAVE_2,
  ...STATE_ASSOCIATION_WAVE_3,
  ...STATE_ASSOCIATION_WAVE_4,
];

async function scrapeStateAssociations(configs, label) {
  console.log(`   • Scraping ${label}`);

  const allRows = [];
  for (const config of configs) {
    const rows = await crawlStateAssociation(config);
    allRows.push(...rows);
  }

  return allRows;
}

export async function scrapeStateAssociationsWave1() {
  return scrapeStateAssociations(STATE_ASSOCIATION_WAVE_1, 'state association wave 1');
}

export async function scrapeStateAssociationsWave2() {
  return scrapeStateAssociations(STATE_ASSOCIATION_WAVE_2, 'state association wave 2');
}

export async function scrapeStateAssociationsWave2A() {
  return scrapeStateAssociations(STATE_ASSOCIATION_WAVE_2A, 'state association wave 2A');
}

export async function scrapeStateAssociationsWave2B() {
  return scrapeStateAssociations(STATE_ASSOCIATION_WAVE_2B, 'state association wave 2B');
}

export async function scrapeStateAssociationsWave3() {
  return scrapeStateAssociations(STATE_ASSOCIATION_WAVE_3, 'state association wave 3');
}

export async function scrapeStateAssociationsWave3A() {
  return scrapeStateAssociations(STATE_ASSOCIATION_WAVE_3A, 'state association wave 3A');
}

export async function scrapeStateAssociationsWave3B() {
  return scrapeStateAssociations(STATE_ASSOCIATION_WAVE_3B, 'state association wave 3B');
}

export async function scrapeStateAssociationsWave4() {
  return scrapeStateAssociations(STATE_ASSOCIATION_WAVE_4, 'state association wave 4');
}

export async function scrapeStateAssociationsWave4A() {
  return scrapeStateAssociations(STATE_ASSOCIATION_WAVE_4A, 'state association wave 4A');
}

export async function scrapeStateAssociationsWave4B() {
  return scrapeStateAssociations(STATE_ASSOCIATION_WAVE_4B, 'state association wave 4B');
}
