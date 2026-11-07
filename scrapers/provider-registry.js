import { scrapeAGD } from './providers/agd.js';
import { scrapeCDOCS } from './providers/cdocs.js';
import { scrapeGlidewell } from './providers/glidewell.js';
import { scrapeSpear } from './providers/spear.js';

export const PRIORITY_PROVIDERS = [
  {
    key: 'agd',
    name: 'Academy of General Dentistry',
    urls: ['https://www.agd.org/education/learn'],
    matches: (url) => {
      const parsed = new URL(url);
      return parsed.hostname.includes('agd.org') && parsed.pathname.startsWith('/education/learn');
    },
    minimumRows: 3,
    scrape: (url) => scrapeAGD(url),
  },
  {
    key: 'spear',
    name: 'Spear Education',
    urls: ['https://campus.speareducation.com/calendar/'],
    matches: (url) => new URL(url).hostname.includes('speareducation.com'),
    minimumRows: 5,
    scrape: (url) => scrapeSpear(url),
  },
  {
    key: 'cdocs',
    name: 'CDOCS',
    urls: ['https://app.cdocs.com/events/workshops'],
    matches: (url) => new URL(url).hostname.includes('cdocs.com'),
    minimumRows: 3,
    scrape: (url) => scrapeCDOCS(url),
  },
  {
    key: 'glidewell',
    name: 'Glidewell Clinical Education',
    urls: ['https://glidewelldirect.com/collections/education'],
    matches: (url) => {
      const hostname = new URL(url).hostname;
      return hostname.includes('glidewelldental.com') || hostname.includes('glidewelldirect.com');
    },
    minimumRows: 1,
    scrape: () => scrapeGlidewell(),
  },
];

export function getPriorityProviderByKey(key) {
  return PRIORITY_PROVIDERS.find((provider) => provider.key === String(key || '').toLowerCase()) || null;
}

export function getPriorityProviderForUrl(url) {
  return PRIORITY_PROVIDERS.find((provider) => provider.matches(url)) || null;
}

export function assessProviderRun(provider, rows, durationMs = 0) {
  const validRows = Array.isArray(rows) ? rows : [];
  const datedRows = validRows.filter((row) => row.start_date || row.end_date).length;
  const creditedRows = validRows.filter((row) => typeof row.credits === 'number' && row.credits > 0).length;
  const linkedRows = validRows.filter((row) => row.url).length;
  const healthy = validRows.length >= provider.minimumRows;

  return {
    provider_key: provider.key,
    provider_name: provider.name,
    status: healthy ? 'healthy' : 'quarantined',
    healthy,
    rows: validRows.length,
    minimum_rows: provider.minimumRows,
    dated_rows: datedRows,
    credited_rows: creditedRows,
    linked_rows: linkedRows,
    duration_ms: durationMs,
    checked_at: new Date().toISOString(),
    reason: healthy ? null : `Expected at least ${provider.minimumRows} rows but received ${validRows.length}`,
  };
}

