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

function isInPersonFormat(format = '', location = '') {
  const text = `${format} ${location}`.toLowerCase();
  if (/\bonline|virtual|webinar|on-demand|self-paced\b/.test(text)) return false;
  return /\bin person|conference|seminar|workshop|meeting|symposium|training|lecture|hands-on|onsite|on site\b/.test(text)
    || Boolean(location && !/\bonline\b/i.test(location));
}

function cleanText(value = '', max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function bestVenueAddress(extracted = {}, session = {}) {
  const direct = cleanText(extracted.venue_address || session.metadata?.venue_address || '');
  if (direct) return direct;

  return cleanText([
    extracted.location || session.location,
    extracted.city || session.city,
    extracted.state || session.state,
    extracted.country || session.country,
  ].filter(Boolean).join(', '), 320);
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
      if (metadata.venue_address && typeof metadata.venue_latitude === 'number' && typeof metadata.venue_longitude === 'number') continue;
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
  const pageUrl = session.provider_session_url || course.registration_url || course.source_url;
  if (!pageUrl) {
    return { updated: false, reason: 'missing_url' };
  }

  try {
    const html = await fetchText(pageUrl);
    const $ = cheerio.load(html);
    const extracted = extractCourseDataFromPage($, {
      provider: course.provider,
      providerUrl: course.source_url || pageUrl,
      pageUrl,
    });

    const venueAddress = bestVenueAddress(extracted, session);
    if (!venueAddress || /^see course page$/i.test(venueAddress)) {
      return { updated: false, reason: 'no_address_found' };
    }

    const geocode = await geocodeAddress(venueAddress);
    const nextMetadata = {
      ...(session.metadata || {}),
      venue_address: venueAddress,
      venue_latitude: geocode?.latitude ?? null,
      venue_longitude: geocode?.longitude ?? null,
      venue_geocode_label: geocode?.label ?? null,
      venue_geocode_query: venueAddress,
      venue_address_backfilled_at: new Date().toISOString(),
      venue_address_source_url: pageUrl,
    };

    const { error } = await supabaseAdmin
      .from('course_sessions')
      .update({ metadata: nextMetadata })
      .eq('id', session.id);

    if (error) throw error;

    return { updated: true, reason: geocode ? 'address_and_geocode_saved' : 'address_saved_no_geocode' };
  } catch (error) {
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
