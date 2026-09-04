import { gunzipSync } from 'node:zlib';
import { normalizeCourse } from '../../lib/normalize.js';

const SITEMAP_INDEX = 'https://www.lawline.com/sitemap.xml';
const CATALOG_URL = 'https://www.lawline.com/cle/courses';

function titleFromUrl(url) {
  const slug = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
  return slug.split('-').map((word) => /^(ai|adr|llc|irs|sec|eeoc|ip)$/i.test(word) ? word.toUpperCase() : `${word[0]?.toUpperCase() || ''}${word.slice(1)}`).join(' ');
}

function practiceArea(title) {
  const rules = [
    ['Ethics & Professional Responsibility', /ethic|professional responsibility|disciplin|malpractice/i],
    ['Litigation & Trial Practice', /litigat|trial|evidence|deposition|arbitration|mediation/i],
    ['Business & Corporate Law', /business|corporate|contract|merger|securities|startup/i],
    ['Criminal Law', /criminal|crime|prosecut|defense|sentencing/i],
    ['Family Law', /family law|divorce|custody|matrimonial|adoption/i],
    ['Estate Planning & Probate', /estate|probate|trust|elder law|guardianship/i],
    ['Employment Law', /employ|labor|workplace|eeoc/i],
    ['Intellectual Property', /intellectual property|patent|trademark|copyright/i],
    ['Real Estate', /real estate|property|landlord|tenant|zoning/i],
    ['Tax Law', /tax|irs/i],
    ['Immigration Law', /immigration|asylum|visa/i],
    ['Technology & AI', /artificial intelligence|\bAI\b|cyber|technology|privacy|data/i],
    ['Health Law', /health|medical|medicare|hipaa/i],
  ];
  return rules.find(([, pattern]) => pattern.test(title))?.[0] || 'General Legal Practice';
}

export async function scrapeLawlineCle() {
  const index = await (await fetch(SITEMAP_INDEX)).text();
  const sitemapUrl = index.match(/<loc>(https:[^<]+products[^<]+\.xml\.gz)<\/loc>/)?.[1];
  if (!sitemapUrl) throw new Error('Lawline product sitemap was not found');
  const compressed = Buffer.from(await (await fetch(sitemapUrl)).arrayBuffer());
  const xml = gunzipSync(compressed).toString('utf8');
  const urls = [...xml.matchAll(/<loc>(https:\/\/www\.lawline\.com\/course\/[^<]+)<\/loc>/g)].map((match) => match[1]);
  const generatedAt = new Date().toISOString();
  const courses = [...new Set(urls)].map((url) => {
    const title = titleFromUrl(url);
    const topic = practiceArea(title);
    return normalizeCourse({
      provider: 'Lawline', source_url: CATALOG_URL, url, title,
      description: `${title} is a currently published Lawline on-demand continuing legal education course. Open the course page to review credit availability for your jurisdiction.`,
      course_type: 'On-Demand CLE', format: 'Online', audience: 'Attorneys', topic,
      credits_text: 'CLE — jurisdiction varies', location: 'Online',
      accreditation: 'Lawline CLE; course credit is jurisdiction-specific',
      tags: ['Law', 'CLE', 'Online', topic],
      metadata: { discipline: 'law', lawline_slug: new URL(url).pathname.split('/').pop(), current_catalog: true, scraped_at: generatedAt },
    });
  });
  return { courses, report: { scraped_at: generatedAt, source: CATALOG_URL, accepted: courses.length, rejected: { duplicate: urls.length - courses.length } } };
}
