import { gunzipSync } from 'node:zlib';
import { normalizeCourse } from '../../lib/normalize.js';

const CATALOG_URL = 'https://www.lawline.com/cle/courses';
function decode(value = '') { return value.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'); }
function titleFromUrl(url) { const slug = new URL(url).pathname.split('/').filter(Boolean).pop() || ''; return decodeURIComponent(slug).replace(/_[0-9]{4}-[0-9]{2}-[0-9]{2}$/i, '').split('-').map((word) => /^(ai|adr|llc|irs|sec|eeoc|ip)$/i.test(word) ? word.toUpperCase() : `${word[0]?.toUpperCase() || ''}${word.slice(1)}`).join(' '); }
function practiceArea(title) {
  const rules = [
    ['Ethics & Professional Responsibility', /ethic|professional responsibility|disciplin|malpractice/i], ['Litigation & Trial Practice', /litigat|trial|evidence|deposition|arbitration|mediation/i],
    ['Business & Corporate Law', /business|corporate|contract|merger|securities|startup/i], ['Criminal Law', /criminal|crime|prosecut|defense|sentencing/i],
    ['Family Law', /family law|divorce|custody|matrimonial|adoption/i], ['Estate Planning & Probate', /estate|probate|trust|elder law|guardianship/i],
    ['Employment Law', /employ|labor|workplace|eeoc|erisa/i], ['Intellectual Property', /intellectual property|patent|trademark|copyright/i],
    ['Real Estate', /real estate|property|landlord|tenant|zoning|construction/i], ['Tax Law', /tax|irs/i], ['Immigration Law', /immigration|asylum|visa/i],
    ['Technology & AI', /artificial intelligence|\bAI\b|cyber|technology|privacy|data/i], ['Health Law', /health|medical|medicare|hipaa/i],
  ];
  return rules.find(([, pattern]) => pattern.test(title))?.[0] || 'General Legal Practice';
}
function compact(course) { const { provider, url, title, description, course_type, format, audience, topic, credits, credits_text, price, start_date, end_date, location, accreditation, metadata } = course; return { provider, url, title, description, course_type, format, audience, topic, credits, credits_text, price, start_date, end_date, location, accreditation, metadata }; }
function makeCourse({ provider, catalog, url, title, metadata = {} }) {
  const topic = practiceArea(title);
  return compact(normalizeCourse({ provider, source_url: catalog, url, title, description: `${title} is currently published in ${provider}'s continuing legal education catalog. Open the provider page to confirm credit for your jurisdiction.`, course_type: 'On-Demand CLE', format: 'Online', audience: 'Attorneys', topic, credits_text: 'CLE — jurisdiction varies', location: 'Online', accreditation: `${provider} CLE; course credit is jurisdiction-specific`, metadata: { discipline: 'law', current_catalog: true, ...metadata } }));
}
async function fetchText(url, options) { const response = await fetch(url, options); if (!response.ok) throw new Error(`${url} returned ${response.status}`); return response.text(); }
async function lawlineCourses(generatedAt) {
  const index = await fetchText('https://www.lawline.com/sitemap.xml');
  const sitemapUrl = index.match(/<loc>(https:[^<]+products[^<]+\.xml\.gz)<\/loc>/)?.[1];
  if (!sitemapUrl) throw new Error('Lawline product sitemap was not found');
  const response = await fetch(sitemapUrl); const xml = gunzipSync(Buffer.from(await response.arrayBuffer())).toString('utf8');
  const urls = [...new Set([...xml.matchAll(/<loc>(https:\/\/www\.lawline\.com\/course\/[^<]+)<\/loc>/g)].map((match) => match[1]))];
  return urls.map((url) => makeCourse({ provider: 'Lawline', catalog: CATALOG_URL, url, title: titleFromUrl(url), metadata: { scraped_at: generatedAt } }));
}
async function barbriCourses(generatedAt) {
  const endpoint = 'https://www.barbri.com/professional-development/cle?p_p_id=com_barbri_sf_product_search_BarbriSfProductSearchPortlet&p_p_lifecycle=0&p_p_state=exclusive&p_p_mode=view&_com_barbri_sf_product_search_BarbriSfProductSearchPortlet_mvcRenderCommandName=fetchSearchResults';
  const urls = new Set();
  for (let page = 1; page <= 9; page += 1) {
    const body = new URLSearchParams({ searchKeyword: '', itemsPerPage: '500', pageNumber: String(page), start: String((page - 1) * 500), end: String(page * 500), filters: 'creditType:1495592;', sortBy: 'Relevance', preferenceFilters: 'creditType:1495592;', familyType: 'Webinar', selectedFilter: 'creditType', selectedFilterValue: '1495592', browserName: 'CEAtlas', referer: '' });
    const html = await fetchText(endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
    for (const match of html.matchAll(/href="(https:\/\/www\.barbri\.com\/course\/professional-development\/cle\/[^"?#]+)["?#]/g)) urls.add(decode(match[1]));
  }
  return [...urls].map((url) => makeCourse({ provider: 'BARBRI Professional Education', catalog: 'https://www.barbri.com/professional-development/cle', url, title: titleFromUrl(url), metadata: { scraped_at: generatedAt } }));
}
async function nbiCourses(generatedAt) {
  const index = await fetchText('https://nbi-sems.com/sitemap.xml');
  const sitemapUrls = [...index.matchAll(/<loc>(https:\/\/nbi-sems\.com\/sitemap_products_[^<]+)<\/loc>/g)].map((match) => decode(match[1])); const urls = new Map();
  for (const sitemap of sitemapUrls) {
    const xml = await fetchText(sitemap);
    for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
      const url = decode(block[1].match(/<loc>(https:\/\/nbi-sems\.com\/products\/[^<]+)<\/loc>/)?.[1] || '');
      if (!url || /subscription|gift-card|cle-pass|shipping|membership/i.test(url)) continue;
      const title = decode(block[1].match(/<image:title>([^<]+)<\/image:title>/)?.[1] || '') || titleFromUrl(url); urls.set(url, title);
    }
  }
  return [...urls].map(([url, title]) => makeCourse({ provider: 'National Business Institute', catalog: 'https://nbi-sems.com/pages/nbi-cle', url, title, metadata: { scraped_at: generatedAt } }));
}
async function sitemapCourses({ sitemap, path, provider, catalog, generatedAt }) {
  const xml = await fetchText(sitemap); const urls = [...new Set([...xml.matchAll(/<loc>(https:[^<]+)<\/loc>/g)].map((match) => decode(match[1])).filter((url) => new URL(url).pathname.startsWith(path)))];
  return urls.map((url) => makeCourse({ provider, catalog, url, title: titleFromUrl(url), metadata: { scraped_at: generatedAt } }));
}
async function pbiCourses(generatedAt) {
  const urls = new Set();
  for (let page = 1; page <= 5; page += 1) {
    const xml = await fetchText(`https://www.pbi.org/product-sitemap${page}.xml`);
    for (const match of xml.matchAll(/<loc>(https:\/\/www\.pbi\.org\/product\/[^<]+)<\/loc>/g)) urls.add(decode(match[1]));
  }
  return [...urls].map((url) => makeCourse({ provider: 'Pennsylvania Bar Institute', catalog: 'https://www.pbi.org/', url, title: titleFromUrl(url), metadata: { jurisdiction: 'Pennsylvania and listed reciprocal jurisdictions', scraped_at: generatedAt } }));
}
async function lormanCourses(generatedAt) {
  const xml = await fetchText('https://www.lorman.com/sitemap.xml');
  const candidates = [...new Set([...xml.matchAll(/<loc>(https:\/\/www\.lorman\.com\/training\/[^<]+)<\/loc>/g)].map((match) => decode(match[1])))];
  const courses = [];
  for (let offset = 0; offset < candidates.length; offset += 20) {
    const batch = candidates.slice(offset, offset + 20);
    const pages = await Promise.all(batch.map(async (url) => {
      try { return [url, await fetchText(url)]; } catch { return [url, '']; }
    }));
    for (const [url, html] of pages) {
      if (!/class="credit-type"[^>]*>\s*CLE\s*</i.test(html)) continue;
      const title = decode(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '') || titleFromUrl(url);
      courses.push(makeCourse({ provider: 'Lorman Education Services', catalog: 'https://www.lorman.com/training/solutions/cle', url, title, metadata: { scraped_at: generatedAt } }));
    }
  }
  return courses;
}
export async function scrapeLawlineCle({ onProgress } = {}) {
  const generatedAt = new Date().toISOString();
  const sources = [
    ['Lawline', () => lawlineCourses(generatedAt)], ['BARBRI', () => barbriCourses(generatedAt)], ['NBI', () => nbiCourses(generatedAt)],
    ['PLI', () => sitemapCourses({ sitemap: 'https://www.pli.edu/sitemap.xml', path: '/programs/', provider: 'Practising Law Institute', catalog: 'https://www.pli.edu/programs', generatedAt })],
    ['LexVid', () => sitemapCourses({ sitemap: 'https://lexvid.com/sitemap.xml', path: '/cle-course/', provider: 'LexVid', catalog: 'https://lexvid.com/courses', generatedAt })],
    ['PBI', () => pbiCourses(generatedAt)],
    ['Lorman', () => lormanCourses(generatedAt)],
  ];
  const courses = new Map(); const sourceCounts = {};
  for (const [name, load] of sources) { const items = await load(); sourceCounts[name] = items.length; for (const course of items) courses.set(course.url, course); onProgress?.({ source: name, sourceCount: items.length, accepted: courses.size }); }
  if (courses.size < 10000) throw new Error(`Law catalog minimum not met: ${courses.size} current activities`);
  return { courses: [...courses.values()], report: { scraped_at: generatedAt, sources: sourceCounts, minimum: 10000, accepted: courses.size, rejected: { duplicate: Object.values(sourceCounts).reduce((sum, count) => sum + count, 0) - courses.size } } };
}
