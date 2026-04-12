function cleanText(value, max = 500) {
  if (value === null || value === undefined) return '';

  let text = String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return '';
  if (text.includes('<') || text.includes('>')) return '';

  return text.slice(0, max);
}

function cleanMultilineText(value, max = 1200) {
  if (value === null || value === undefined) return '';

  let text = String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!text) return '';

  text = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');

  return text.slice(0, max);
}

function slugify(value) {
  const text = cleanText(value, 120).toLowerCase();
  if (!text) return '';

  return text
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;

  const text = String(value).replace(/,/g, '');
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferCurrency(priceText = '') {
  if (!priceText) return '';
  if (/\bUSD\b|\$/i.test(priceText)) return 'USD';
  if (/\bCAD\b|C\$/i.test(priceText)) return 'CAD';
  if (/\bEUR\b|€/i.test(priceText)) return 'EUR';
  if (/\bGBP\b|£/i.test(priceText)) return 'GBP';
  return '';
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => cleanText(item, 120)).filter(Boolean))];
  }

  const text = cleanText(value, 500);
  if (!text) return [];

  return [...new Set(text.split(/[|,;/]/).map((item) => cleanText(item, 120)).filter(Boolean))];
}

function looksLikeInstructorLine(value) {
  const text = cleanText(value, 200);
  if (!text) return false;
  if (text.length > 140) return false;
  if (/\b(learn|achieve|guidance|comprehensive|immediately|hands-on|live patients|treatment planning|your practice|course will|you will)\b/i.test(text)) {
    return false;
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 14) return false;

  const personLikeTokenCount = words.filter((word) => /^[A-Z][a-z'’-]+$/.test(word) || /^[A-Z]{2,}$/.test(word)).length;
  return personLikeTokenCount >= 2 || /,|\(|\)/.test(text);
}

function normalizeInstructors(value) {
  if (!value) return '';

  return String(value)
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => cleanText(line, 200))
    .filter((line) => looksLikeInstructorLine(line))
    .join('\n');
}

function jsonValue(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value) && value.length === 0) return null;
  if (typeof value === 'object' && Object.keys(value).length === 0) return null;
  return value;
}

export function normalizeCourse(raw = {}) {
  const provider = cleanText(raw.provider, 80);
  const title = cleanText(raw.title, 250);
  const url = cleanText(raw.url || raw.course_url, 500);
  const sourceUrl = cleanText(raw.source_url, 500);
  const priceText = cleanText(raw.price || raw.price_text, 120);
  const creditsText = cleanText(raw.credits_text || raw.credits, 120);
  const dateText = cleanMultilineText(raw.date_text || raw.schedule_text, 500);
  const description = cleanMultilineText(raw.description, 2000);
  const location = cleanMultilineText(raw.location || raw.location_text, 300);
  const venueAddress = cleanMultilineText(raw.venue_address || raw.address, 400);
  const tags = normalizeList(raw.tags);

  const metadata = raw.metadata && typeof raw.metadata === 'object'
    ? raw.metadata
    : null;

  return {
    provider,
    provider_slug: cleanText(raw.provider_slug, 120) || slugify(provider),
    source_url: sourceUrl,
    url,
    title,
    description,
    course_type: cleanText(raw.course_type, 120),
    format: cleanText(raw.format, 120),
    audience: cleanText(raw.audience, 250),
    topic: cleanText(raw.topic, 250),
    credits_text: creditsText,
    credits: raw.credits !== undefined && raw.credits !== null && raw.credits !== ''
      ? parseNumber(raw.credits)
      : parseNumber(creditsText),
    price: priceText,
    price_amount: raw.price_amount !== undefined && raw.price_amount !== null && raw.price_amount !== ''
      ? parseNumber(raw.price_amount)
      : parseNumber(priceText),
    currency: cleanText(raw.currency, 12) || inferCurrency(priceText),
    start_date: cleanText(raw.start_date, 120),
    end_date: cleanText(raw.end_date, 120),
    date_text: dateText,
    location,
    city: cleanText(raw.city, 120),
    state: cleanText(raw.state, 120),
    country: cleanText(raw.country, 120),
    instructors: normalizeInstructors(raw.instructors),
    accreditation: cleanMultilineText(raw.accreditation, 500),
    registration_deadline: cleanText(raw.registration_deadline, 120),
    requirements: cleanMultilineText(raw.requirements, 500),
    venue_address: venueAddress,
    venue_latitude: raw.venue_latitude !== undefined && raw.venue_latitude !== null && raw.venue_latitude !== ''
      ? parseNumber(raw.venue_latitude)
      : null,
    venue_longitude: raw.venue_longitude !== undefined && raw.venue_longitude !== null && raw.venue_longitude !== ''
      ? parseNumber(raw.venue_longitude)
      : null,
    tags,
    metadata: jsonValue(metadata),
  };
}
