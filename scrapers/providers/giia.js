import { normalizeCourse } from '../../lib/normalize.js';

const PROVIDER = 'GIIA USA';
const PROVIDER_SLUG = 'giia-usa';
const SOURCE_URL = 'https://giiausa.com/products.json?limit=250';
const BASE_URL = 'https://giiausa.com';
const MONTHS = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
};

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

function isoFromYmd(year, month, day) {
  if (!year || !month || !day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDates(title = '') {
  const text = cleanText(title, 500);

  const ymdRange = text.match(/\[(20\d{2})\/(\d{1,2})\/(\d{1,2})\s*(?:~|-)\s*(?:(20\d{2})\/)?(?:(\d{1,2})\/)?(\d{1,2})\]/);
  if (ymdRange) {
    const [, startYear, startMonth, startDay, endYearRaw, endMonthRaw, endDay] = ymdRange;
    const endYear = endYearRaw || startYear;
    const endMonth = endMonthRaw || startMonth;
    return {
      start_date: isoFromYmd(startYear, startMonth, startDay),
      end_date: isoFromYmd(endYear, endMonth, endDay),
      date_text: ymdRange[0].slice(1, -1),
    };
  }

  const ymdSingle = text.match(/\[(20\d{2})\/(\d{1,2})\/(\d{1,2})\]/);
  if (ymdSingle) {
    const [, year, month, day] = ymdSingle;
    return {
      start_date: isoFromYmd(year, month, day),
      end_date: isoFromYmd(year, month, day),
      date_text: ymdSingle[0].slice(1, -1),
    };
  }

  const monthRange = text.match(/\[([A-Za-z]+)\s+(\d{1,2})\s*-\s*(\d{1,2}),\s*(20\d{2})\]/i);
  if (monthRange) {
    const [, monthName, startDay, endDay, year] = monthRange;
    const month = MONTHS[monthName.toLowerCase()];
    return {
      start_date: isoFromYmd(year, month, startDay),
      end_date: isoFromYmd(year, month, endDay),
      date_text: monthRange[0].slice(1, -1),
    };
  }

  const monthSingle = text.match(/\[([A-Za-z]+)\s+(\d{1,2}),\s*(20\d{2})\]/i);
  if (monthSingle) {
    const [, monthName, day, year] = monthSingle;
    const month = MONTHS[monthName.toLowerCase()];
    return {
      start_date: isoFromYmd(year, month, day),
      end_date: isoFromYmd(year, month, day),
      date_text: monthSingle[0].slice(1, -1),
    };
  }

  const yearOnly = text.match(/\b(20\d{2})\b/);
  if (yearOnly) {
    return {
      start_date: '',
      end_date: '',
      date_text: yearOnly[1],
    };
  }

  return {
    start_date: '',
    end_date: '',
    date_text: '',
  };
}

function inferTopic(text = '') {
  const value = cleanText(text, 1600).toLowerCase();
  if (/implant|sinus|gbr|full arch|all on|osseointegration/.test(value)) return 'Implants';
  if (/third molar|wisdom teeth|extraction|surgery/.test(value)) return 'Oral Surgery';
  if (/veneer|resin|tooth preparation|esthetic|prosthodontic|restoration|crown/.test(value)) return 'Restorative Dentistry';
  if (/orthodontic|invisalign|mini-tube|uprighting/.test(value)) return 'Orthodontics';
  if (/periodontal|soft tissue|fg[g]?|ctg|plastic surgery/.test(value)) return 'Periodontics';
  if (/photography|digital/.test(value)) return 'Digital Dentistry & Technology';
  if (/endodontic/.test(value)) return 'Endodontics';
  if (/occlusion/.test(value)) return 'Occlusion & TMD';
  return 'General Dentistry';
}

function formatFor(text = '') {
  return /online|webinar/i.test(text) ? 'Online' : 'In Person';
}

function formatPrice(product = {}) {
  const price = Number(product.variants?.[0]?.price);
  if (!Number.isFinite(price)) return '';
  return price === 0 ? 'Free' : `$${price.toFixed(2)}`;
}

function shouldSkip(product = {}) {
  return /\b(sponsor|sponsorship|discount|enrollment)\b/i.test(product.title || '');
}

export async function scrapeGIIA() {
  console.log(`   • Scraping ${PROVIDER}`);
  const response = await fetch(SOURCE_URL, {
    headers: {
      Accept: 'application/json,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) throw new Error(`GIIA USA returned ${response.status}`);
  const json = await response.json();

  const rows = (json.products || [])
    .filter((product) => !shouldSkip(product))
    .map((product) => {
      const title = cleanText(product.title, 250);
      const description = cleanText(product.body_html || `${title} is listed in GIIA USA's public course catalog.`, 1800);
      const dates = parseDates(title);

      return normalizeCourse({
        provider: PROVIDER,
        provider_slug: PROVIDER_SLUG,
        source_url: SOURCE_URL,
        url: `${BASE_URL}/products/${product.handle}`,
        title,
        description,
        course_type: /live surgery/i.test(title) ? 'Live Surgery Course' : 'Dental CE Course',
        format: formatFor(`${title} ${description}`),
        audience: 'Dentists and Dental Team',
        topic: inferTopic(`${title} ${description}`),
        price: formatPrice(product),
        ...dates,
        location: 'See course page',
        country: 'USA',
        accreditation: 'GIIA USA',
        tags: ['GIIA USA', ...(product.tags || [])].filter(Boolean),
        metadata: {
          extracted_from: 'giia-shopify-products-json',
          product_id: product.id || null,
          product_type: product.product_type || null,
          vendor: product.vendor || null,
        },
      });
    });

  console.log(`   • Extracted ${rows.length} ${PROVIDER} rows`);
  return rows;
}
