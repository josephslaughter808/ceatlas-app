import * as cheerio from 'cheerio';
import { gunzipSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';

const OUTPUT = new URL('../data/discipline-proof-courses.json', import.meta.url);
const LIMIT = 3;
const USER_AGENT = 'Mozilla/5.0 (compatible; CEAtlasProofBot/0.1; +https://ceatlas.co)';

const sources = {
  achieve: 'https://achievece.com/courses/sitemap.xml',
  apta: 'https://www.apta.org/your-career/courses-and-events',
  avma: 'https://axon.avma.org/page/latest-webinars',
  lawline: 'https://www.lawline.com/sitemap.xml',
  cpe: 'https://cpesociety.com/webinars',
};

function clean(value = '', max = 900) {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function absolute(value, base) {
  try { return new URL(value, base).href; } catch { return ''; }
}

async function fetchResponse(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xml;q=0.9,*/*;q=0.8' } });
  if (!response.ok) throw new Error(`${response.status} from ${url}`);
  return response;
}

async function fetchText(url) {
  return (await fetchResponse(url)).text();
}

function row(discipline, provider, sourceUrl, input) {
  const url = absolute(input.url, sourceUrl);
  return {
    id: `${discipline}-${Buffer.from(url).toString('base64url').slice(-14)}`,
    discipline,
    provider,
    title: clean(input.title, 220),
    description: clean(input.description, 360),
    credits: clean(input.credits, 80) || 'See provider for credit details',
    format: input.format || 'Online',
    start_date: input.start_date || null,
    location: clean(input.location || 'Online', 100),
    url,
    source_url: sourceUrl,
    status: input.start_date ? 'Upcoming' : 'On demand',
  };
}

function isoDate(value = '') {
  const date = new Date(clean(value));
  return Number.isNaN(date.valueOf()) ? null : date.toISOString().slice(0, 10);
}

async function scrapeAchieve() {
  const xml = await fetchText(sources.achieve);
  const urls = [...xml.matchAll(/<loc>\s*([^<]+)<\/loc>/gi)].map((match) => clean(match[1], 500));
  const rules = {
    medicine: { include: /(?:physician|clinician|osteopathic|cardiac|measles|ebola|ventricular|organ-and-tissue)/i, exclude: /(?:pharmac|pharmacy|nurs)/i },
    nursing: { include: /(?:nurs|rn-|aprn)/i },
    pharmacy: { include: /(?:pharmacist|pharmacy|compounding|medication-safety)/i, exclude: /(?:for-nurses|nursing)/i },
    'mental-health': { include: /(?:mental-health|behavioral-health|trauma|suicide|depression|substance-use)/i },
  };
  const result = [];

  for (const [discipline, rule] of Object.entries(rules)) {
    const candidates = urls.filter((url) => rule.include.test(url) && !rule.exclude?.test(url)).slice(0, 10);
    for (const url of candidates) {
      if (result.filter((item) => item.discipline === discipline).length >= LIMIT) break;
      try {
        const html = await fetchText(url);
        const $ = cheerio.load(html);
        const meta = (name) => clean($(`meta[${name}]`).attr('content') || '', 1800);
        const title = meta('property="og:title"').replace(/\s*\|\s*(?:Continuing Education Course(?:\s*\|\s*)?)?AchieveCE.*$/i, '').replace(/\s*\|\s*Continuing Education Course\s*$/i, '') || clean($('h1').first().text(), 220);
        if (!title) continue;
        const description = meta('name="description"') || meta('property="og:description"');
        const summary = meta('name="ai-summary"');
        const duration = html.match(/"productDuration":\s*(\d+(?:\.\d+)?)/);
        const summaryDuration = summary.match(/Duration:\s*(\d+(?:\.\d+)?)/i);
        const rawDuration = duration?.[1] || summaryDuration?.[1];
        const hours = rawDuration ? (Number(rawDuration) > 12 ? Math.round((Number(rawDuration) / 60) * 10) / 10 : Number(rawDuration)) : null;
        result.push(row(discipline, 'AchieveCE', sources.achieve, {
          url, title, description,
          credits: hours ? `${hours} CE ${hours === 1 ? 'credit' : 'credits'}` : '',
          format: 'Self-paced online', location: 'Online',
        }));
      } catch (error) {
        console.warn(`AchieveCE skipped ${url}: ${error.message}`);
      }
    }
  }
  return result;
}

async function scrapeApta() {
  const html = await fetchText(sources.apta);
  const $ = cheerio.load(html);
  const today = new Date().toISOString().slice(0, 10);
  return $('.card:has(.clickable__anchor)').map((_, element) => {
    const card = $(element);
    const anchor = card.find('.clickable__anchor').first();
    const details = clean(card.find('p.text-muted').text(), 200);
    const dateText = details.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+20\d{2}/i)?.[0] || '';
    const location = clean(details.replace(dateText, ''), 100);
    return row('physical-therapy', 'American Physical Therapy Association', sources.apta, {
      title: anchor.text(), url: anchor.attr('href'), description: 'An upcoming education event listed in APTA’s public courses and events catalog.',
      credits: 'APTA education event', format: location ? 'In person' : 'Online', start_date: isoDate(dateText), location: location || 'Online',
    });
  }).get().filter((item) => item.title && (!item.start_date || item.start_date >= today)).slice(0, LIMIT);
}

async function scrapeAvma() {
  const landing = await fetchText(sources.avma);
  const $landing = cheerio.load(landing);
  const encoded = $landing('.brr-auto-load').last().attr('url');
  if (!encoded) return [];
  const endpoint = encoded.replace(/&amp;/g, '&');
  const payload = await (await fetchResponse(endpoint)).json();
  const markup = payload?.message?.text || payload?.html || '';
  const $ = cheerio.load(markup);
  return $('.catalog-tile').map((_, element) => {
    const card = $(element);
    const anchor = card.find('a[href*="product"]').first();
    const title = clean(card.find('.catalog-title').first().text() || anchor.text(), 220);
    return row('veterinary', 'AVMA Axon', sources.avma, {
      title, url: anchor.attr('href'), description: clean(card.text().replace(title, ''), 360) || 'Veterinary continuing education listed in AVMA Axon.',
      credits: card.text().match(/\d+(?:\.\d+)?\s+(?:CE|credit|hour)s?/i)?.[0] || 'AVMA Axon CE', format: 'Online', location: 'Online',
    });
  }).get().filter((item) => item.title && item.url).slice(0, LIMIT);
}

async function scrapeLawline() {
  const index = await fetchText(sources.lawline);
  const productMap = [...index.matchAll(/<loc>([^<]*products[^<]*\.xml\.gz)<\/loc>/gi)][0]?.[1];
  if (!productMap) return [];
  const zipped = Buffer.from(await (await fetchResponse(productMap)).arrayBuffer());
  const xml = gunzipSync(zipped).toString('utf8');
  const urls = [...xml.matchAll(/<loc>(https:\/\/www\.lawline\.com\/course\/[^<]+)<\/loc>/gi)].slice(0, 6).map((match) => match[1]);
  const result = [];
  for (const url of urls) {
    if (result.length >= LIMIT) break;
    try {
      const html = await fetchText(url);
      const $ = cheerio.load(html);
      const title = clean($('meta[property="og:title"]').attr('content') || $('h1').first().text(), 220);
      const description = clean($('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content'), 360);
      if (!title) continue;
      result.push(row('law', 'Lawline', sources.lawline, { title, description, url, credits: $('body').text().match(/\d+(?:\.\d+)?\s+(?:CLE|credit)s?/i)?.[0] || 'CLE credit', format: 'On-demand online', location: 'Online' }));
    } catch (error) { console.warn(`Lawline skipped ${url}: ${error.message}`); }
  }
  return result;
}

async function scrapeCpe() {
  const html = await fetchText(sources.cpe);
  const $ = cheerio.load(html);
  return $('a[href^="/webinars/"]').map((_, element) => {
    const card = $(element);
    const title = clean(card.find('h3').first().text(), 220);
    const date = card.find('time[datetime]').first().attr('datetime') || '';
    return row('accounting', 'CPE Society', sources.cpe, {
      title, url: card.attr('href'), description: card.find('p.text-slate-600').first().text(),
      credits: card.find('span').filter((__, span) => /CPE Credit/i.test($(span).text())).first().text(),
      format: 'Live webinar', start_date: isoDate(date), location: 'Online',
    });
  }).get().filter((item) => item.title && item.start_date).slice(0, LIMIT);
}

async function main() {
  const settled = await Promise.allSettled([scrapeAchieve(), scrapeApta(), scrapeAvma(), scrapeLawline(), scrapeCpe()]);
  const courses = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  settled.forEach((result) => { if (result.status === 'rejected') console.warn(result.reason); });
  const missing = ['medicine', 'nursing', 'pharmacy', 'mental-health', 'physical-therapy', 'veterinary', 'law', 'accounting']
    .filter((discipline) => !courses.some((course) => course.discipline === discipline));
  if (missing.length) throw new Error(`No proof courses found for: ${missing.join(', ')}`);
  const payload = { generated_at: new Date().toISOString(), course_count: courses.length, sources, courses };
  await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${courses.length} proof courses across 8 disciplines to ${OUTPUT.pathname}`);
  for (const discipline of [...new Set(courses.map((course) => course.discipline))]) {
    console.log(`  ${discipline}: ${courses.filter((course) => course.discipline === discipline).length}`);
  }
}

await main();
