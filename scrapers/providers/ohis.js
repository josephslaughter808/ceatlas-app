import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const PROVIDER = 'OHI-S Dental CE';
const PROVIDER_SLUG = 'ohi-s-dental-ce';
const BASE_URL = 'https://www.ohi-s.com';
const SOURCE_URL = 'https://www.ohi-s.com/courses';
const MAX_PAGES = 40;

function cleanText(value = '', max = 1800) {
  return String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = BASE_URL) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function inferTopic(text = '') {
  const value = cleanText(text, 1000).toLowerCase();
  if (/implant|papilla|peri-implant/.test(value)) return 'Implants';
  if (/root canal|endodont|retreatment/.test(value)) return 'Endodontics';
  if (/orthodont|aligner/.test(value)) return 'Orthodontics';
  if (/periodont|periodontal|soft tissue|gingiv|hygienist/.test(value)) return 'Periodontics';
  if (/occlusion|craniomandibular|cmd|tmj|gnathology/.test(value)) return 'TMD / Occlusion';
  if (/aesthetic|facial|filler|botulin|skin|rejuvenation|laser|exosome|cosmet/.test(value)) return 'Esthetics & Facial Esthetics';
  if (/surgery|surgical/.test(value)) return 'Oral Surgery';
  if (/prosthodont|denture|veneer|restor/.test(value)) return 'Restorative Dentistry';
  if (/pediatric/.test(value)) return 'Pediatric Dentistry';
  if (/digital|cad|cam|cbct|3d|scan/.test(value)) return 'Digital Dentistry & Technology';
  if (/hygien|prevention|biofilm/.test(value)) return 'Dental Hygiene';
  return 'General Dentistry';
}

function parseDuration(cardText = '') {
  return cleanText(cardText.match(/\b\d+h(?:\s+\d+min)?\b|\b\d+min\b/i)?.[0] || '', 80);
}

function parseCredits(cardText = '') {
  const match = cardText.match(/\b\d+(?:\.\d+)?\s+CE Credits?\b/i);
  return cleanText(match?.[0] || '', 80);
}

function parseCourseType(text = '') {
  const match = cleanText(text, 200).match(/\b(?:Online course|Webinar|Offline event|Lecture|Master class)\b/i);
  return cleanText(match?.[0] || 'Online Course', 120);
}

async function scrapePage(page) {
  const pageUrl = page === 1 ? SOURCE_URL : `${SOURCE_URL}?page=${page}`;
  const $ = await loadHTML(pageUrl);
  const rows = [];

  $('a.product-card[href*="/webinars-courses/"]').each((_, card) => {
    const node = $(card);
    const title = cleanText(node.find('.product-card__title').first().text(), 250);
    const url = absoluteUrl(node.attr('href') || '', pageUrl);
    if (!title || !url) return;

    const cardText = cleanText(node.text(), 2500);
    const subtitle = cleanText(node.find('.product-card__subdued').first().text(), 160);
    const instructors = cleanText(node.find('.product-card__lecturers').first().text(), 250);
    const creditsText = parseCredits(cardText);
    const duration = parseDuration(cardText);
    const accessLabel = cleanText(node.find('.product-card-controls__info__label').first().text(), 140);
    const topic = inferTopic(`${title} ${subtitle}`);

    rows.push(normalizeCourse({
      provider: PROVIDER,
      provider_slug: PROVIDER_SLUG,
      source_url: pageUrl,
      url,
      title,
      description: `${title} is listed in the OHI-S public dental CE course catalog.${duration ? ` Duration: ${duration}.` : ''}`,
      course_type: parseCourseType(subtitle),
      format: 'Online',
      audience: 'Dentists and Dental Team',
      topic,
      credits_text: creditsText,
      price: accessLabel || '',
      location: 'Online',
      country: 'International',
      instructors,
      accreditation: creditsText ? 'OHI-S / ADA CERP listed course' : 'OHI-S',
      tags: ['OHI-S', 'Online', topic, accessLabel].filter(Boolean),
      metadata: {
        extracted_from: 'ohi-s-course-listing',
        duration: duration || null,
        subtitle: subtitle || null,
        access_label: accessLabel || null,
      },
    }));
  });

  return rows;
}

export async function scrapeOHIS() {
  console.log(`   • Scraping ${PROVIDER}`);

  const rows = [];
  const seen = new Set();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const pageRows = await scrapePage(page);
    let newRows = 0;

    for (const row of pageRows) {
      const key = `${row.title}::${row.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
      newRows += 1;
    }

    if (!pageRows.length || (page > 1 && newRows === 0)) break;
  }

  console.log(`   • Extracted ${rows.length} ${PROVIDER} rows`);
  return rows;
}
