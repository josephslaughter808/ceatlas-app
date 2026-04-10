import * as cheerio from 'cheerio';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const BASE_URL = 'https://www.worlddentalevents.com';
const SOURCE_URL = `${BASE_URL}/organisations`;
const MAX_PAGES = 220;
const PAGE_CONCURRENCY = 8;

function cleanText(value = '', max = 300) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function slugFromUrl(value = '') {
  try {
    const pathname = new URL(value, BASE_URL).pathname;
    return pathname.split('/').filter(Boolean).pop() || '';
  } catch {
    return '';
  }
}

function absoluteUrl(value = '') {
  try {
    return new URL(value, BASE_URL).href;
  } catch {
    return SOURCE_URL;
  }
}

async function fetchPage(url, attempt = 1) {
  try {
    const { stdout } = await execFileAsync('curl', [
      '-L',
      '--max-time',
      '30',
      '-A',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      url,
    ], {
      maxBuffer: 12 * 1024 * 1024,
    });

    return stdout;
  } catch (error) {
    if (attempt >= 3) throw error;
    await new Promise((resolve) => {
      setTimeout(resolve, attempt * 1000);
    });
    return fetchPage(url, attempt + 1);
  }
}

function parsePage(html = '', pageUrl = SOURCE_URL) {
  const $ = cheerio.load(html);
  const providers = [];
  const maxPageText = $('.page-jump-input').attr('max') || $('.page-info strong').last().text();
  const maxPage = Number.parseInt(maxPageText, 10);

  $('a.similar-card[href*="/organisations/"]').each((_, card) => {
    const item = $(card);
    const name = cleanText(item.find('.sc-name').first().text(), 180);
    const url = absoluteUrl(item.attr('href'));
    const country = cleanText(item.find('.sc-country').first().text(), 120);
    const eventCountText = cleanText(item.find('.sc-events').first().text(), 80);
    const eventCountMatch = eventCountText.match(/\d+/);

    if (!name) return;

    providers.push({
      name,
      slug: slugFromUrl(url),
      website: url,
      url,
      country,
      category: 'Dental Organisation',
      source: 'World Dental Events Organisations',
      source_url: pageUrl,
      event_count: eventCountMatch ? Number(eventCountMatch[0]) : null,
    });
  });

  return {
    providers,
    maxPage: Number.isFinite(maxPage) && maxPage > 0 ? maxPage : 1,
  };
}

export async function scrapeWorldDentalOrganisations() {
  console.log('   • Scraping World Dental Events organisation directory');

  const rows = [];
  const seen = new Set();
  const firstPage = parsePage(await fetchPage(SOURCE_URL), SOURCE_URL);
  const totalPages = Math.min(firstPage.maxPage, MAX_PAGES);

  function collect(providers) {
    for (const provider of providers) {
      const key = provider.slug || provider.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(provider);
    }
  }

  collect(firstPage.providers);

  for (let startPage = 2; startPage <= totalPages; startPage += PAGE_CONCURRENCY) {
    const pages = Array.from(
      { length: Math.min(PAGE_CONCURRENCY, totalPages - startPage + 1) },
      (_, index) => startPage + index
    );

    const results = await Promise.allSettled(
      pages.map(async (page) => {
        const pageUrl = `${SOURCE_URL}?page=${page}`;
        return {
          page,
          providers: parsePage(await fetchPage(pageUrl), pageUrl).providers,
        };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        collect(result.value.providers);
      } else {
        console.log(`      ⚠️ organisations page skipped: ${result.reason.message}`);
      }
    }
  }

  console.log(`   • Extracted ${rows.length} World Dental Events organisations`);
  return rows;
}
