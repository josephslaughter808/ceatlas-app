import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { loadLocalEnv } from './load-env.js';
import { filterCurrentOrFutureCourses } from './course-eligibility.js';

loadLocalEnv();

function getSupabaseClient(keyName) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env[keyName];

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(`Missing NEXT_PUBLIC_SUPABASE_URL or ${keyName}`);
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getSupabaseAdmin() {
  return getSupabaseClient('SUPABASE_SERVICE_ROLE_KEY');
}

function getSupabasePublic() {
  return getSupabaseClient('NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

function hashKey(parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function cleanValue(value) {
  return value === undefined ? null : value;
}

function domainFromUrl(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function providerSlug(providerName) {
  return normalizeText(providerName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildProviderSourceKey(course) {
  return hashKey([
    'provider',
    providerSlug(course.provider),
  ]);
}

export function buildCourseSourceKey(course) {
  return hashKey([
    'course',
    providerSlug(course.provider),
    normalizeText(course.url),
    normalizeText(course.title),
    normalizeText(course.course_type),
    normalizeText(course.format),
  ]);
}

export function buildSessionSourceKey(course) {
  return hashKey([
    'session',
    buildCourseSourceKey(course),
    normalizeText(course.start_date),
    normalizeText(course.end_date),
    normalizeText(course.location),
    normalizeText(course.format),
    normalizeText(course.date_text || 'evergreen'),
  ]);
}

function buildProviderRow(course) {
  return {
    name: normalizeText(course.provider),
    slug: providerSlug(course.provider),
    website: cleanValue(domainFromUrl(course.source_url) || domainFromUrl(course.url)),
    source_key: buildProviderSourceKey(course),
    metadata: {
      source_url: course.source_url || null,
      provider_slug: course.provider_slug || null,
    },
  };
}

function buildProviderDirectoryRow(provider) {
  const name = normalizeText(provider.name);
  const slug = providerSlug(name);
  const website = normalizeText(provider.website || provider.url || provider.source_url);

  return {
    name,
    slug,
    website: website || null,
    source_key: hashKey(['provider', slug]),
    metadata: {
      source_url: provider.source_url || null,
      provider_url: provider.url || null,
      external_slug: provider.slug || null,
      country: provider.country || null,
      category: provider.category || null,
      source: provider.source || null,
      event_count: provider.event_count ?? null,
    },
  };
}

function numericPrice(course) {
  if (typeof course.price_amount === 'number') return course.price_amount;
  if (typeof course.price === 'number') return course.price;
  return null;
}

function buildCourseRow(course, providerId) {
  return {
    provider_id: providerId,
    title: cleanValue(course.title),
    description: cleanValue(course.description),
    category: cleanValue(course.course_type || course.topic),
    price: numericPrice(course),
    credits: cleanValue(course.credits),
    source_key: buildCourseSourceKey(course),
    source_url: cleanValue(course.url || course.source_url),
    course_type: cleanValue(course.course_type),
    topic: cleanValue(course.topic),
    audience: cleanValue(course.audience),
    accreditation: cleanValue(course.accreditation),
    registration_url: cleanValue(course.url),
    credits_text: cleanValue(course.credits_text),
    price_text: cleanValue(course.price),
    tags: cleanValue(course.tags || []),
    metadata: cleanValue({
      instructors: course.instructors || null,
      provider_catalog_url: course.source_url || null,
      original_location: course.location || null,
      original_date_text: course.date_text || null,
      original_metadata: course.metadata || null,
    }),
  };
}

function buildSessionRow(course, courseId) {
  return {
    course_id: courseId,
    start_date: cleanValue(course.start_date || null),
    end_date: cleanValue(course.end_date || null),
    location: cleanValue(course.location || 'Online / self-paced'),
    format: cleanValue(course.format || 'Evergreen'),
    source_key: buildSessionSourceKey(course),
    provider_session_url: cleanValue(course.url),
    schedule_text: cleanValue(course.date_text || (course.start_date ? null : 'Evergreen course')),
    city: cleanValue(course.city),
    state: cleanValue(course.state),
    country: cleanValue(course.country),
    registration_deadline: cleanValue(course.registration_deadline),
    metadata: cleanValue({
      source_url: course.source_url || null,
      requirements: course.requirements || null,
      original_metadata: course.metadata || null,
    }),
  };
}

function chunkItems(items, size = 100) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function fetchExistingBySourceKey(supabaseAdmin, table, sourceKeys, selectClause) {
  const existingRows = new Map();

  for (const sourceKeyChunk of chunkItems(sourceKeys)) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(selectClause)
      .in('source_key', sourceKeyChunk);

    if (error) throw error;

    for (const row of data || []) {
      existingRows.set(row.source_key, row);
    }
  }

  return existingRows;
}

async function fetchExistingProvidersByNameOrSlug(supabaseAdmin, providerRows) {
  const existingRows = new Map();

  for (const providerNameChunk of chunkItems(providerRows.map((row) => row.name), 25)) {
    const { data, error } = await supabaseAdmin
      .from('providers')
      .select('id, name, source_key, slug')
      .in('name', providerNameChunk);

    if (error) throw error;

    for (const row of data || []) {
      existingRows.set(normalizeText(row.name).toLowerCase(), row);
    }
  }

  for (const providerSlugChunk of chunkItems(providerRows.map((row) => row.slug), 25)) {
    const { data, error } = await supabaseAdmin
      .from('providers')
      .select('id, name, source_key, slug')
      .in('slug', providerSlugChunk);

    if (error) throw error;

    for (const row of data || []) {
      existingRows.set(normalizeText(row.slug).toLowerCase(), row);
    }
  }

  return existingRows;
}

async function insertRows(supabaseAdmin, table, rows, selectClause) {
  const inserted = [];

  for (const rowChunk of chunkItems(rows)) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .insert(rowChunk)
      .select(selectClause);

    if (error) throw error;
    inserted.push(...(data || []));
  }

  return inserted;
}

async function updateRowsById(supabaseAdmin, table, rows, selectClause) {
  const updated = [];

  for (const rowChunk of chunkItems(rows)) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .upsert(rowChunk, { onConflict: 'id' })
      .select(selectClause);

    if (error) throw error;
    updated.push(...(data || []));
  }

  return updated;
}

function dedupeRowsBySourceKey(rows) {
  const keyedRows = new Map();

  for (const row of rows) {
    keyedRows.set(row.source_key, row);
  }

  return [...keyedRows.values()];
}

export async function syncProviderCatalog(courses) {
  const supabaseAdmin = getSupabaseAdmin();
  const eligibility = filterCurrentOrFutureCourses(courses);
  const eligibleCourses = eligibility.rows;

  if (!eligibleCourses.length) {
    return {
      total: 0,
      skippedPastCourses: eligibility.skipped.length,
      skippedRows: eligibility.skipped.length,
      insertedProviders: 0,
      insertedCourses: 0,
      insertedSessions: 0,
      updatedProviders: 0,
      updatedCourses: 0,
      updatedSessions: 0,
    };
  }

  const providerRows = dedupeRowsBySourceKey(eligibleCourses.map((course) => buildProviderRow(course)));
  const existingProviders = await fetchExistingProvidersByNameOrSlug(supabaseAdmin, providerRows);

  const providerInserts = [];
  const providerUpdates = [];

  for (const row of providerRows) {
    const existing =
      existingProviders.get(normalizeText(row.name).toLowerCase()) ||
      existingProviders.get(normalizeText(row.slug).toLowerCase());
    if (existing?.id) {
      providerUpdates.push({ ...row, id: existing.id });
    } else {
      providerInserts.push(row);
    }
  }

  const insertedProviderRows = await insertRows(
    supabaseAdmin,
    'providers',
    providerInserts,
    'id, source_key, name, slug'
  );
  const updatedProviderRows = await updateRowsById(
    supabaseAdmin,
    'providers',
    providerUpdates,
    'id, source_key, name, slug'
  );

  const providerBySourceKey = new Map();
  for (const row of existingProviders.values()) providerBySourceKey.set(row.source_key, row);
  for (const row of insertedProviderRows) providerBySourceKey.set(row.source_key, row);
  for (const row of updatedProviderRows) providerBySourceKey.set(row.source_key, row);

  const courseRows = dedupeRowsBySourceKey(
    eligibleCourses.map((course) => {
      const provider = providerBySourceKey.get(buildProviderSourceKey(course));
      return buildCourseRow(course, provider.id);
    })
  );

  const existingCourses = await fetchExistingBySourceKey(
    supabaseAdmin,
    'courses',
    courseRows.map((row) => row.source_key),
    'id, source_key'
  );

  const courseInserts = [];
  const courseUpdates = [];

  for (const row of courseRows) {
    const existing = existingCourses.get(row.source_key);
    if (existing?.id) {
      courseUpdates.push({ ...row, id: existing.id });
    } else {
      courseInserts.push(row);
    }
  }

  const insertedCourseRows = await insertRows(
    supabaseAdmin,
    'courses',
    courseInserts,
    'id, source_key'
  );
  const updatedCourseRows = await updateRowsById(
    supabaseAdmin,
    'courses',
    courseUpdates,
    'id, source_key'
  );

  const courseBySourceKey = new Map(existingCourses);
  for (const row of insertedCourseRows) courseBySourceKey.set(row.source_key, row);
  for (const row of updatedCourseRows) courseBySourceKey.set(row.source_key, row);

  const sessionRows = dedupeRowsBySourceKey(
    eligibleCourses.map((course) => {
      const courseRecord = courseBySourceKey.get(buildCourseSourceKey(course));
      return buildSessionRow(course, courseRecord.id);
    })
  );

  const existingSessions = await fetchExistingBySourceKey(
    supabaseAdmin,
    'course_sessions',
    sessionRows.map((row) => row.source_key),
    'id, source_key'
  );

  const sessionInserts = [];
  const sessionUpdates = [];

  for (const row of sessionRows) {
    const existing = existingSessions.get(row.source_key);
    if (existing?.id) {
      sessionUpdates.push({ ...row, id: existing.id });
    } else {
      sessionInserts.push(row);
    }
  }

  await insertRows(supabaseAdmin, 'course_sessions', sessionInserts, 'id, source_key');
  await updateRowsById(supabaseAdmin, 'course_sessions', sessionUpdates, 'id, source_key');

  return {
    total: eligibleCourses.length,
    skippedPastCourses: eligibility.skipped.length,
    skippedRows: eligibility.skipped.length,
    insertedProviders: providerInserts.length,
    insertedCourses: courseInserts.length,
    insertedSessions: sessionInserts.length,
    updatedProviders: providerUpdates.length,
    updatedCourses: courseUpdates.length,
    updatedSessions: sessionUpdates.length,
  };
}

export async function syncProviderDirectory(providers) {
  const supabaseAdmin = getSupabaseAdmin();
  const providerRowsByName = new Map();

  for (const row of dedupeRowsBySourceKey(
    providers
      .map((provider) => buildProviderDirectoryRow(provider))
      .filter((row) => row.name && row.slug)
  )) {
    const key = normalizeText(row.name).toLowerCase();
    if (!providerRowsByName.has(key)) {
      providerRowsByName.set(key, row);
    }
  }

  const providerRows = [...providerRowsByName.values()];

  if (!providerRows.length) {
    return {
      total: 0,
      insertedProviders: 0,
      updatedProviders: 0,
    };
  }

  const existingProviders = await fetchExistingProvidersByNameOrSlug(supabaseAdmin, providerRows);
  const providerInserts = [];
  const providerUpdates = [];

  for (const row of providerRows) {
    const existing =
      existingProviders.get(normalizeText(row.name).toLowerCase()) ||
      existingProviders.get(normalizeText(row.slug).toLowerCase());

    if (existing?.id) {
      providerUpdates.push({ ...row, id: existing.id });
    } else {
      providerInserts.push(row);
    }
  }

  await insertRows(supabaseAdmin, 'providers', providerInserts, 'id, source_key, name, slug');
  await updateRowsById(supabaseAdmin, 'providers', providerUpdates, 'id, source_key, name, slug');

  return {
    total: providerRows.length,
    insertedProviders: providerInserts.length,
    updatedProviders: providerUpdates.length,
  };
}

export async function getCatalogStats() {
  const supabaseAdmin = getSupabaseAdmin();

  const [{ count: providerCount, error: providerError }, { count: courseCount, error: courseError }, { count: sessionCount, error: sessionError }] = await Promise.all([
    supabaseAdmin.from('providers').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('courses').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('course_sessions').select('*', { count: 'exact', head: true }),
  ]);

  if (providerError) throw providerError;
  if (courseError) throw courseError;
  if (sessionError) throw sessionError;

  return {
    providers: providerCount || 0,
    courses: courseCount || 0,
    sessions: sessionCount || 0,
  };
}

const PUBLIC_COURSE_SELECT = `
  id,
  provider_id,
  title,
  description,
  category,
  topic,
  price,
  price_text,
  credits,
  credits_text,
  source_url,
  registration_url,
  tags,
  metadata,
  updated_at,
  providers (
    name,
    website
  ),
  course_sessions (
    id,
    start_date,
    end_date,
    location,
    format,
    created_at
  )
`;

function mapPublicCourseRows(rows) {
  return (rows || []).map((row) => {
    const sessions = [...(row.course_sessions || [])];
    const today = new Date().toISOString().slice(0, 10);

    sessions.sort((a, b) => {
      const aPriority = a.start_date ? (a.start_date >= today ? 0 : 2) : 1;
      const bPriority = b.start_date ? (b.start_date >= today ? 0 : 2) : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return String(a.start_date || '').localeCompare(String(b.start_date || ''));
    });

    const nextSession = sessions[0] || null;

    return {
      id: row.id,
      provider_id: row.provider_id,
      provider_name: row.providers?.name || null,
      provider_website: row.providers?.website || null,
      title: row.title,
      description: row.description,
      category: row.category,
      topic: row.topic,
      price: row.price,
      price_text: row.price_text,
      credits: row.credits,
      credits_text: row.credits_text,
      source_url: row.source_url,
      registration_url: row.registration_url,
      tags: row.tags,
      metadata: row.metadata,
      updated_at: row.updated_at,
      next_session_id: nextSession?.id || null,
      next_start_date: nextSession?.start_date || null,
      next_end_date: nextSession?.end_date || null,
      next_location: nextSession?.location || null,
      next_format: nextSession?.format || null,
      session_count: sessions.length,
    };
  });
}

export async function getPublicCourseCatalog() {
  const supabase = getSupabasePublic();
  const pageSize = 1000;
  const allRows = [];
  let start = 0;

  while (true) {
    const end = start + pageSize - 1;
    const { data, error } = await supabase
      .from('courses')
      .select(PUBLIC_COURSE_SELECT)
      .range(start, end);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows.push(...data);
    if (data.length < pageSize) break;
    start += pageSize;
  }

  return mapPublicCourseRows(allRows);
}

export async function getPublicCourseCatalogPage(page = 1, pageSize = 50) {
  const supabase = getSupabasePublic();
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Math.min(100, Number(pageSize) || 50));
  const start = (safePage - 1) * safePageSize;
  const end = start + safePageSize - 1;

  const { data, error, count } = await supabase
    .from('courses')
    .select(PUBLIC_COURSE_SELECT, { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(start, end);

  if (error) throw error;

  return {
    rows: mapPublicCourseRows(data || []),
    total: count || 0,
  };
}

export async function getPublicCoursesByIds(courseIds = []) {
  const supabase = getSupabasePublic();
  const ids = [...new Set(courseIds.filter(Boolean))];
  if (!ids.length) return [];

  const rows = [];

  for (const idChunk of chunkItems(ids, 100)) {
    const { data, error } = await supabase
      .from('courses')
      .select(PUBLIC_COURSE_SELECT)
      .in('id', idChunk);

    if (error) throw error;
    rows.push(...(data || []));
  }

  return mapPublicCourseRows(rows);
}

export async function getPublicProviders() {
  const supabase = getSupabasePublic();
  const { data, error } = await supabase
    .from('providers')
    .select('id, name, slug, website')
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getPublicCourseProviderNames() {
  const supabase = getSupabasePublic();
  const pageSize = 1000;
  const providers = new Set();
  let start = 0;

  while (true) {
    const end = start + pageSize - 1;
    const { data, error } = await supabase
      .from('courses')
      .select('providers(name)')
      .range(start, end);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      const name = row.providers?.name;
      if (name) providers.add(name);
    }

    if (data.length < pageSize) break;
    start += pageSize;
  }

  return [...providers].sort((a, b) => String(a).localeCompare(String(b)));
}

export async function getPublicCourseProviderFilterRows() {
  const supabase = getSupabasePublic();
  const pageSize = 1000;
  const rows = [];
  let start = 0;

  while (true) {
    const end = start + pageSize - 1;
    const { data, error } = await supabase
      .from('courses')
      .select(`
        source_url,
        registration_url,
        provider_catalog_url:metadata->>provider_catalog_url,
        extracted_from:metadata->original_metadata->>extracted_from,
        providers (
          name
        )
      `)
      .range(start, end);

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < pageSize) break;
    start += pageSize;
  }

  return rows.map((row) => ({
    source_url: row.source_url || null,
    registration_url: row.registration_url || null,
    metadata: {
      provider_catalog_url: row.provider_catalog_url || null,
      original_metadata: {
        extracted_from: row.extracted_from || null,
      },
    },
    provider_name: row.providers?.name || null,
  }));
}

export async function getCourseRatingSummaries() {
  const supabase = getSupabasePublic();
  const { data, error } = await supabase
    .from('course_rating_summary')
    .select('course_id, average_overall_rating, rating_count');

  if (error) {
    if (error.code === '42P01' || /course_rating_summary/i.test(error.message || '')) {
      return [];
    }
    throw error;
  }

  return data || [];
}

export async function getCourseRatingSummariesForCourseIds(courseIds = []) {
  const ids = [...new Set(courseIds.filter(Boolean))];
  if (!ids.length) return [];

  const supabase = getSupabasePublic();
  const rows = [];

  for (const idChunk of chunkItems(ids, 200)) {
    const { data, error } = await supabase
      .from('course_rating_summary')
      .select('course_id, average_overall_rating, rating_count')
      .in('course_id', idChunk);

    if (error) {
      if (error.code === '42P01' || /course_rating_summary/i.test(error.message || '')) {
        return [];
      }
      throw error;
    }

    rows.push(...(data || []));
  }

  return rows;
}

export async function getPublicSessionFormats() {
  const supabase = getSupabasePublic();
  const pageSize = 1000;
  const formats = new Set();
  let start = 0;

  while (true) {
    const end = start + pageSize - 1;
    const { data, error } = await supabase
      .from('course_sessions')
      .select('format')
      .range(start, end);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (row.format) formats.add(row.format);
    }

    if (data.length < pageSize) break;
    start += pageSize;
  }

  return [...formats];
}

export async function getPublicMapSessions() {
  const supabase = getSupabasePublic();
  const today = new Date().toISOString().slice(0, 10);
  const pageSize = 1000;
  const rows = [];
  let start = 0;

  while (true) {
    const end = start + pageSize - 1;
    const { data, error } = await supabase
      .from('course_sessions')
      .select('course_id, start_date, end_date, location, format, city, state, country')
      .not('location', 'is', null)
      .or(`start_date.gte.${today},start_date.is.null`)
      .range(start, end);

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < pageSize) break;
    start += pageSize;
  }

  return rows;
}
