import { scrapeTownCE } from './townce.js';

export async function scrapeHygienetown() {
  return scrapeTownCE({
    provider: 'Hygienetown CE',
    providerSlug: 'hygienetown-ce',
    startUrl: 'https://www.hygienetown.com/onlinece/viewall?pg=1',
    baseUrl: 'https://www.hygienetown.com',
    tag: 'Hygienetown',
    audience: 'Dental Hygienists and Dental Team',
    metadataSource: 'hygienetown-viewall',
  });
}
