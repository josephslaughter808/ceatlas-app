import { scrapeTownCE } from './townce.js';

export async function scrapeOrthotown() {
  return scrapeTownCE({
    provider: 'Orthotown CE',
    providerSlug: 'orthotown-ce',
    startUrl: 'https://www.orthotown.com/onlinece/viewall?pg=1',
    baseUrl: 'https://www.orthotown.com',
    tag: 'Orthotown',
    audience: 'Orthodontists and Dental Team',
    metadataSource: 'orthotown-viewall',
  });
}
