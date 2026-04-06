import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const UBC_CPE_PROVIDER = 'UBC CPE Catalog';
const UBC_CPE_PROVIDER_SLUG = 'ubc-cpe-catalog';
const UBC_CPE_URL = 'https://courses.cpe.ubc.ca/browse/ubcv/faculty-of-dentistry/continuing-dental-education/';

function cleanText(value = '', max = 1200) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function parseProductsFromPage(html = '') {
  const match = html.match(/ENV\s*=\s*(\{.*?\})\s*ENV\.flashAlerts/s);
  if (!match) return [];

  try {
    const env = JSON.parse(match[1]);
    return env?.products_initial_data?.products || [];
  } catch {
    return [];
  }
}

function normalizeDate(value = '') {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function inferTopic(text = '') {
  const value = cleanText(text, 400).toLowerCase();
  if (/sleep|apnea|airway/.test(value)) return 'Sleep & Airway';
  if (/occlusion/.test(value)) return 'Restorative Dentistry';
  if (/veneer|esthetic|aesthetic/.test(value)) return 'Esthetics & Facial Esthetics';
  if (/anesthesia|anaesthetic/.test(value)) return 'General Dentistry';
  if (/xerostomia|oral lesion|ulcer|lump|osteonecrosis/.test(value)) return 'Oral Medicine';
  if (/implant|peri-implant/.test(value)) return 'Implants';
  if (/periodontal/.test(value)) return 'Periodontics';
  if (/surgical|surgery/.test(value)) return 'Oral Surgery';
  if (/opioid|medication|emergency|smoke|vape/.test(value)) return 'General Dentistry';
  return 'General Dentistry';
}

export async function scrapeUBCCPE() {
  console.log('   • Scraping UBC CPE catalog');

  const $ = await loadHTML(UBC_CPE_URL);
  const html = $.html();
  const products = parseProductsFromPage(html);

  const rows = products
    .map((product) => normalizeCourse({
      provider: UBC_CPE_PROVIDER,
      provider_slug: UBC_CPE_PROVIDER_SLUG,
      source_url: UBC_CPE_URL,
      url: product.url,
      title: cleanText(product.title, 250).replace(/^[A-Z]{2,}\s*\d+[A-Z]?:\s*/i, '').trim(),
      description: cleanText(product.teaser, 1800),
      course_type: product.type || 'Online Course',
      format: 'Online',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${product.title} ${product.teaser}`),
      credits: product.credits,
      credits_text: product.credits ? `${product.credits} credits` : product.measurement || '',
      price_amount: product.price,
      price: product.price ? `${product.currency || 'CAD'} ${product.price}` : '',
      currency: product.currency || 'CAD',
      start_date: normalizeDate(product.startDate),
      end_date: normalizeDate(product.endDate),
      date_text: product.endDate ? `Available until ${normalizeDate(product.endDate)}` : '',
      location: 'Online',
      country: 'Canada',
      accreditation: 'UBC Continuing Dental Education',
      tags: ['UBC', 'Online', inferTopic(product.title)].filter(Boolean),
      metadata: {
        extracted_from: 'ubc-cpe-products-initial-data',
        image: product.image || '',
      },
    }))
    .filter((row) => row.title && row.url);

  console.log(`   • Extracted ${rows.length} UBC CPE rows`);
  return rows;
}
