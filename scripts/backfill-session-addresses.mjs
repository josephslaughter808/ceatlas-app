import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import { loadLocalEnv } from '../lib/load-env.js';
import { extractCourseDataFromPage } from '../scrapers/lib/course-helpers.js';

loadLocalEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PAGE_SIZE = 500;
const CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 15000;
const GEOCODE_TIMEOUT_MS = 12000;
const FAILURE_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_FOLLOW_UP_PAGES = 6;
const STREET_HINT_RE = /\b(?:ave|avenue|blvd|boulevard|cir|circle|ct|court|dr|drive|hwy|highway|ln|lane|pkwy|parkway|pl|place|rd|road|st|street|suite|ste|way)\b/i;
const RELATED_LINK_KEYWORDS = [
  'location',
  'locations',
  'venue',
  'venues',
  'campus',
  'training-center',
  'training-centers',
  'training center',
  'training centers',
  'meeting',
  'conference',
  'hotel',
  'contact',
  'directions',
  'map',
];

function isInPersonFormat(format = '', location = '') {
  const text = `${format} ${location}`.toLowerCase();
  if (/\bonline|virtual|webinar|on-demand|self-paced\b/.test(text)) return false;
  return /\bin person|conference|seminar|workshop|meeting|symposium|training|lecture|hands-on|onsite|on site\b/.test(text)
    || Boolean(location && !/\bonline\b/i.test(location));
}

function cleanText(value = '', max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function slugify(value = '') {
  return cleanText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeCountry(value = '') {
  const text = cleanText(value, 80);
  if (!text) return '';
  if (/^united states$/i.test(text)) return 'USA';
  return text;
}

function sanitizeVenueAddress(value = '') {
  const text = cleanText(value, 320);
  if (!text) return '';
  if (/^see (?:course|event|registration) page$/i.test(text)) return '';
  if (/^(?:location|venue|address)\s*[,:\-]*\s*$/i.test(text)) return '';
  if (/^(?:location|venue)\b/i.test(text)) return '';
  if (/^address\b/i.test(text) && !/\d/.test(text) && !STREET_HINT_RE.test(text)) return '';
  return text;
}

function composeLocationText(parts = []) {
  return cleanText(parts.filter(Boolean).join(', '), 320);
}

function uniqueCandidates(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function comparableText(value = '') {
  return cleanText(value, 320).toLowerCase();
}

function isSpecificVenueAddress(value = '', genericPlaces = []) {
  const text = sanitizeVenueAddress(value);
  if (!text) return false;

  const comparable = comparableText(text);
  if (genericPlaces.some((candidate) => comparable && comparable === comparableText(candidate))) {
    return false;
  }

  if (!/\d/.test(text) && !STREET_HINT_RE.test(text) && text.split(',').length <= 2) {
    return false;
  }

  return true;
}

function buildVenueCandidates(extracted = {}, session = {}) {
  const normalizedCountry = normalizeCountry(extracted.country || session.country);
  const sessionPlace = composeLocationText([
    session.city,
    session.state,
    normalizedCountry,
  ]);
  const extractedPlace = composeLocationText([
    extracted.city,
    extracted.state,
    normalizeCountry(extracted.country),
  ]);
  const locationOnly = composeLocationText([
    extracted.location || session.location,
    extracted.city || session.city,
    extracted.state || session.state,
    normalizedCountry,
  ]);
  const directSource = extracted.venue_address || session.metadata?.venue_address || '';
  const direct = isSpecificVenueAddress(directSource, [
    session.location,
    sessionPlace,
    extractedPlace,
    locationOnly,
  ])
    ? sanitizeVenueAddress(directSource)
    : '';

  const geocodeQueries = uniqueCandidates([
    direct,
    direct && sessionPlace ? composeLocationText([direct, sessionPlace]) : '',
    direct && extractedPlace ? composeLocationText([direct, extractedPlace]) : '',
    locationOnly,
    sessionPlace,
    extractedPlace,
  ]);

  return {
    venueAddress: direct,
    geocodeQueries,
  };
}

function buildPageUrls(session = {}, course = {}) {
  const originalMetadata = typeof session.metadata?.original_metadata === 'object'
    ? session.metadata.original_metadata
    : {};
  const urls = [
    session.provider_session_url,
    course.registration_url,
    course.source_url,
    originalMetadata.detail_url,
    originalMetadata.registration_url,
    originalMetadata.register_url,
    originalMetadata.event_url,
  ].filter(Boolean);

  return uniqueCandidates(
    urls.flatMap((value) => {
      const text = cleanText(value, 1000);
      if (!text) return [];
      const withoutHash = text.split('#')[0];
      return uniqueCandidates([text, withoutHash]);
    })
  );
}

function sameHostname(left, right) {
  try {
    return new URL(left).hostname === new URL(right).hostname;
  } catch {
    return false;
  }
}

function scoreRelatedLink(url, text, session = {}) {
  const haystack = `${cleanText(url, 400)} ${cleanText(text, 200)}`.toLowerCase();
  let score = 0;

  for (const keyword of RELATED_LINK_KEYWORDS) {
    if (haystack.includes(keyword)) score += 2;
  }

  const citySlug = slugify(session.city);
  const stateSlug = slugify(session.state);
  const locationSlug = slugify(session.location);

  if (citySlug && haystack.includes(citySlug)) score += 4;
  if (stateSlug && haystack.includes(stateSlug)) score += 2;
  if (locationSlug && haystack.includes(locationSlug)) score += 2;
  if (/maps\.google|google\.com\/maps|apple\.com\/maps/.test(haystack)) score += 5;
  if (/login|signin|register|checkout|cart|account/.test(haystack)) score -= 4;

  return score;
}

function collectRelatedPageUrls($, baseUrl, session = {}) {
  const candidates = [];

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    const text = $(element).text();

    let full = '';
    try {
      full = new URL(href, baseUrl).href;
    } catch {
      full = '';
    }

    if (!full || !sameHostname(full, baseUrl)) return;

    const score = scoreRelatedLink(full, text, session);
    if (score <= 0) return;

    candidates.push({
      url: full.split('#')[0],
      score,
    });
  });

  return [...new Map(
    candidates
      .sort((a, b) => b.score - a.score)
      .map((item) => [item.url, item])
  ).values()]
    .slice(0, MAX_FOLLOW_UP_PAGES)
    .map((item) => item.url);
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'CEAtlas/1.0 (support@ceatlas.co)',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

async function geocodeAddress(query) {
  const normalized = cleanText(query, 320);
  if (!normalized) return null;

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', normalized);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'CEAtlas/1.0 (support@ceatlas.co)',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) return null;

  const data = await response.json();
  const first = data?.[0];
  const latitude = Number(first?.lat);
  const longitude = Number(first?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    latitude,
    longitude,
    label: cleanText(first?.display_name || normalized, 320),
  };
}

async function reverseGeocode(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  url.searchParams.set('format', 'jsonv2');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'CEAtlas/1.0 (support@ceatlas.co)',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: controller.signal,
  });
  clearTimeout(timeout);

  if (!response.ok) return null;

  const data = await response.json();
  const displayName = cleanText(data?.display_name || '', 320);
  if (!displayName) return null;

  return {
    address: displayName,
    latitude,
    longitude,
    label: displayName,
  };
}

async function geocodeFirstMatch(queries = []) {
  for (const query of queries) {
    const result = await geocodeAddress(query);
    if (result) {
      return { ...result, query };
    }
  }

  return null;
}

async function extractFromPage(candidateUrl, course, session) {
  const html = await fetchText(candidateUrl);
  const $ = cheerio.load(html);
  const extracted = extractCourseDataFromPage($, {
    provider: course.provider,
    providerUrl: course.source_url || candidateUrl,
    pageUrl: candidateUrl,
  });

  return {
    extracted,
    relatedUrls: collectRelatedPageUrls($, candidateUrl, session),
  };
}

function mergeExtractedRows(primary = {}, secondary = {}) {
  return {
    ...primary,
    ...secondary,
    venue_address: primary.venue_address || secondary.venue_address || '',
    location: primary.location || secondary.location || '',
    city: primary.city || secondary.city || '',
    state: primary.state || secondary.state || '',
    country: primary.country || secondary.country || '',
    venue_latitude: primary.venue_latitude ?? secondary.venue_latitude ?? null,
    venue_longitude: primary.venue_longitude ?? secondary.venue_longitude ?? null,
  };
}

async function getSessionsNeedingAddresses(limit = 200) {
  const sessions = [];
  let start = 0;

  while (sessions.length < limit) {
    const end = start + PAGE_SIZE - 1;
    const { data, error } = await supabaseAdmin
      .from('course_sessions')
      .select('id, course_id, location, city, state, country, format, provider_session_url, metadata, schedule_text')
      .range(start, end);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      const metadata = row.metadata || {};
      if (!isInPersonFormat(row.format, row.location)) continue;
      const lastAttemptAt = metadata.venue_address_backfill_attempted_at
        ? Date.parse(metadata.venue_address_backfill_attempted_at)
        : NaN;
      const recentFailure = Number.isFinite(lastAttemptAt)
        && (Date.now() - lastAttemptAt) < FAILURE_COOLDOWN_MS
        && metadata.venue_address_backfill_status === 'failed';
      const permanentFailure = metadata.venue_address_backfill_status === 'failed'
        && /HTTP 403|HTTP 404|missing_url/i.test(String(metadata.venue_address_backfill_reason || ''));
      const finalizedTba = metadata.venue_address === 'TBA'
        && metadata.venue_address_backfill_reason === 'exhaustive_search_tba';

      if (metadata.venue_address && typeof metadata.venue_latitude === 'number' && typeof metadata.venue_longitude === 'number') continue;
      if (recentFailure || permanentFailure || finalizedTba) continue;
      sessions.push(row);
      if (sessions.length >= limit) break;
    }

    if (data.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }

  return sessions;
}

async function getCourseMap(courseIds) {
  const ids = [...new Set(courseIds.filter(Boolean))];
  const map = new Map();

  for (let start = 0; start < ids.length; start += 200) {
    const chunk = ids.slice(start, start + 200);
    const { data, error } = await supabasePublic
      .from('courses')
      .select('id, title, source_url, registration_url, providers(name)')
      .in('id', chunk);

    if (error) throw error;

    for (const row of data || []) {
      map.set(row.id, {
        title: row.title || '',
        source_url: row.source_url || '',
        registration_url: row.registration_url || '',
        provider: row.providers?.name || '',
      });
    }
  }

  return map;
}

async function enrichSession(session, course) {
  const seedUrls = buildPageUrls(session, course);
  const pageUrl = seedUrls[0];
  if (!pageUrl) {
    return { updated: false, reason: 'missing_url' };
  }

  try {
    let extracted = null;
    let successfulPageUrl = pageUrl;
    let lastError = null;
    const queue = [...seedUrls];
    const visited = new Set();
    let exhaustiveSearchCount = 0;

    while (queue.length > 0 && exhaustiveSearchCount < (seedUrls.length + MAX_FOLLOW_UP_PAGES)) {
      const candidateUrl = queue.shift();
      if (!candidateUrl || visited.has(candidateUrl)) continue;
      visited.add(candidateUrl);
      exhaustiveSearchCount += 1;

      try {
        const result = await extractFromPage(candidateUrl, course, session);
        extracted = mergeExtractedRows(extracted || {}, result.extracted || {});
        successfulPageUrl = candidateUrl;
        const hasUsefulLocation =
          Boolean(extracted?.venue_address)
          || (Number.isFinite(extracted?.venue_latitude) && Number.isFinite(extracted?.venue_longitude));
        for (const relatedUrl of result.relatedUrls || []) {
          if (!visited.has(relatedUrl)) queue.push(relatedUrl);
        }
        if (hasUsefulLocation) break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!extracted) {
      throw lastError || new Error('no_extractable_page');
    }

    let { venueAddress, geocodeQueries } = buildVenueCandidates(extracted, session);
    let geocode = await geocodeFirstMatch(geocodeQueries);

    if (!venueAddress && Number.isFinite(extracted.venue_latitude) && Number.isFinite(extracted.venue_longitude)) {
      const reversed = await reverseGeocode(extracted.venue_latitude, extracted.venue_longitude);
      venueAddress = sanitizeVenueAddress(reversed?.address || '');
      geocode = reversed
        ? {
            latitude: reversed.latitude,
            longitude: reversed.longitude,
            label: reversed.label,
            query: `reverse:${extracted.venue_latitude},${extracted.venue_longitude}`,
          }
        : geocode;
    }

    if (!venueAddress) {
      venueAddress = 'TBA';
    }
    const nextMetadata = {
      ...(session.metadata || {}),
      venue_address: venueAddress,
      venue_latitude: geocode?.latitude ?? extracted.venue_latitude ?? null,
      venue_longitude: geocode?.longitude ?? extracted.venue_longitude ?? null,
      venue_geocode_label: geocode?.label ?? null,
      venue_geocode_query: geocode?.query || geocodeQueries[0] || venueAddress,
      venue_address_backfill_status: 'success',
      venue_address_backfill_reason: venueAddress === 'TBA'
        ? 'exhaustive_search_tba'
        : (geocode ? 'address_and_geocode_saved' : 'address_saved_no_geocode'),
      venue_address_backfill_attempted_at: new Date().toISOString(),
      venue_address_backfilled_at: new Date().toISOString(),
      venue_address_source_url: successfulPageUrl,
    };

    const { error } = await supabaseAdmin
      .from('course_sessions')
      .update({ metadata: nextMetadata })
      .eq('id', session.id);

    if (error) throw error;

    return { updated: true, reason: geocode ? 'address_and_geocode_saved' : 'address_saved_no_geocode' };
  } catch (error) {
    const nextMetadata = {
      ...(session.metadata || {}),
      venue_address_backfill_status: 'failed',
      venue_address_backfill_reason: error.message,
      venue_address_backfill_attempted_at: new Date().toISOString(),
      venue_address_source_url: pageUrl,
    };

    await supabaseAdmin
      .from('course_sessions')
      .update({ metadata: nextMetadata })
      .eq('id', session.id);

    return { updated: false, reason: error.message };
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

async function main() {
  const limit = Math.max(1, Number(process.argv[2]) || 200);
  const sessions = await getSessionsNeedingAddresses(limit);
  const courseMap = await getCourseMap(sessions.map((session) => session.course_id));

  console.log(`Found ${sessions.length} in-person sessions missing venue address metadata`);

  const results = await mapWithConcurrency(sessions, CONCURRENCY, async (session) => {
    const course = courseMap.get(session.course_id);
    if (!course) {
      return { sessionId: session.id, updated: false, reason: 'missing_course' };
    }

    const result = await enrichSession(session, course);
    return {
      sessionId: session.id,
      title: course.title,
      provider: course.provider,
      ...result,
    };
  });

  const updated = results.filter((result) => result.updated).length;
  const failures = results.length - updated;

  console.log(JSON.stringify({
    attempted: results.length,
    updated,
    failures,
    sampleFailures: results.filter((result) => !result.updated).slice(0, 20),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
