import { normalizeCourse } from '../../lib/normalize.js';

const PROVIDER = 'MyDentalCE';
const PROVIDER_SLUG = 'mydentalce';
const SOURCE_URL = 'https://www.mydentalce.com/products.json?limit=250';
const BASE_URL = 'https://www.mydentalce.com';

function cleanText(value = '', max = 1800) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function creditsFrom(text = '') {
  return cleanText(text.match(/\b(\d+(?:\.\d+)?)\s*(?:ce|ces|credits?|hours?)\b/i)?.[1] || '', 40);
}

function inferTopic(text = '') {
  const value = cleanText(text, 1600).toLowerCase();
  if (/osha|infection|bloodborne|waterline/.test(value)) return 'Infection Control';
  if (/hipaa|practice act|law|ethics|jurisprudence/.test(value)) return 'Ethics & Jurisprudence';
  if (/opioid|prescrib/.test(value)) return 'Pharmacology';
  if (/abuse|neglect|human trafficking/.test(value)) return 'Ethics & Jurisprudence';
  if (/package|mandated|renewal/.test(value)) return 'License Renewal Requirements';
  return 'General Dentistry';
}

function formatPrice(product = {}) {
  const variant = product.variants?.[0] || {};
  const price = Number(variant.price);
  if (!Number.isFinite(price)) return '';
  return price === 0 ? 'Free' : `$${price.toFixed(2)}`;
}

export async function scrapeMyDentalCE() {
  console.log(`   • Scraping ${PROVIDER}`);
  const response = await fetch(SOURCE_URL, {
    headers: {
      Accept: 'application/json,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`MyDentalCE returned ${response.status}`);
  }

  const json = await response.json();
  const rows = (json.products || [])
    .filter((product) => /\b(ce|ceu|osha|hipaa|dental|dentist|hygienist)\b/i.test(`${product.title} ${product.body_html}`))
    .map((product) => {
      const title = cleanText(product.title, 250);
      const description = cleanText(product.body_html || `${title} is listed in MyDentalCE's public product catalog.`, 1800);
      const credits = creditsFrom(`${title} ${description}`);

      return normalizeCourse({
        provider: PROVIDER,
        provider_slug: PROVIDER_SLUG,
        source_url: SOURCE_URL,
        url: `${BASE_URL}/products/${product.handle}`,
        title,
        description,
        course_type: /package/i.test(title) ? 'CE Package' : 'Online Course',
        format: 'Online',
        audience: 'Dentists and Dental Team',
        topic: inferTopic(`${title} ${description}`),
        credits_text: credits ? `${credits} Credits` : '',
        price: formatPrice(product),
        date_text: 'Online',
        location: 'Online',
        country: 'USA',
        accreditation: 'MyDentalCE',
        tags: ['MyDentalCE', 'Online', ...(product.tags || [])].filter(Boolean),
        metadata: {
          extracted_from: 'mydentalce-shopify-products-json',
          product_id: product.id || null,
          product_type: product.product_type || null,
          vendor: product.vendor || null,
        },
      });
    });

  console.log(`   • Extracted ${rows.length} ${PROVIDER} rows`);
  return rows;
}
