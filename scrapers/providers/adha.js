import axios from 'axios';
import { normalizeCourse } from '../../lib/normalize.js';

const ADHA_PROVIDER = 'ADHA CE Smart';
const ADHA_PROVIDER_SLUG = 'adha-ce-smart';
const ADHA_SOURCE_URL = 'https://mymembership.adha.org/ce_smart';
const ADHA_CATALOG_URL = 'https://catalog.devmatics.io/product?key=CXkd83Loi5r213Gkjl67';

function cleanText(value = '', max = 2200) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function inferFormat(attributes = [], text = '') {
  const joined = `${attributes.map((item) => item.value).join(' ')} ${text}`.toLowerCase();
  if (/recorded webinar|virtual seminar|interactive course/.test(joined)) return 'Online';
  if (/conference session/.test(joined)) return 'Conference / Symposium';
  return 'Online';
}

function inferTopic(product = {}) {
  const value = cleanText(`${product.category} ${product.title} ${product.description}`, 800).toLowerCase();
  if (/clinical/.test(value)) return 'Clinical Dentistry';
  if (/research/.test(value)) return 'Research';
  if (/professional development/.test(value)) return 'Practice Management & Business';
  if (/educational methodologies|educator/.test(value)) return 'Education';
  return 'Dental Hygiene';
}

function extractCredits(product = {}) {
  const fromDescription = cleanText(product.description || '', 1500).match(/CE Credit Hours:\s*([\d.]+)/i);
  if (fromDescription) return fromDescription[1];

  const attr = (product.attributes || []).find((item) => /^\d/.test(item.value));
  return attr ? attr.value : '';
}

export async function scrapeADHA() {
  console.log('   • Scraping ADHA CE Smart catalog');

  const { data } = await axios.get(ADHA_CATALOG_URL, {
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CEAtlasBot/1.0)',
      Accept: 'application/json',
    },
  });

  const products = data?.data?.products || [];
  const rows = products
    .map((product) => {
      const credits = extractCredits(product);
      const format = inferFormat(product.attributes || [], product.description || '');

      return normalizeCourse({
        provider: ADHA_PROVIDER,
        provider_slug: ADHA_PROVIDER_SLUG,
        source_url: ADHA_SOURCE_URL,
        url: product.detailLink || '',
        title: cleanText(product.title, 250),
        description: cleanText(product.description, 2000),
        course_type: format === 'Conference / Symposium' ? 'Conference Session' : 'Online Course',
        format,
        audience: 'Dental Hygienists and Oral Health Professionals',
        topic: inferTopic(product),
        credits,
        credits_text: credits ? `${credits} credits` : '',
        price: cleanText(product.price, 220),
        date_text: product.publishDate ? `Published ${cleanText(product.publishDate, 40)}` : '',
        location: 'Online',
        country: 'USA',
        accreditation: 'American Dental Hygienists Association',
        tags: ['ADHA', product.category, format].filter(Boolean),
        metadata: {
          extracted_from: 'adha-devmatics-catalog',
          product_code: product.productCode || '',
          attributes: (product.attributes || []).map((item) => item.value),
        },
      });
    })
    .filter((row) => row.title && row.url);

  console.log(`   • Extracted ${rows.length} ADHA CE Smart rows`);
  return rows;
}
