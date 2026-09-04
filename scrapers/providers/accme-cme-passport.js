import { normalizeCourse } from '../../lib/normalize.js';

const API_URL = 'https://cmefinderservicesprd.accme.org/api/activities/search';
const CATALOG_URL = 'https://www.cmepassport.org/activity/search';
const PAGE_SIZE = 100;
const PHYSICIAN_CREDIT = /(?:AMA\s+PRA\s+Category\s+1|AOA\s+Category\s+1)/i;
const BAD_URL = /(?:notarealurl|example\.(?:com|org|net)|localhost|\.nil(?:\/|$))/i;

function clean(value = '', max = 1200) {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function isoDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toISOString().slice(0, 10);
}

function validPublicUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !BAD_URL.test(url.href);
  } catch {
    return false;
  }
}

function listNames(value) {
  return Array.isArray(value) ? value.map((item) => clean(item?.name || item, 140)).filter(Boolean) : [];
}

function inferSpecialty(activity) {
  const title = activity.title || '';
  const rules = [
    ['Cardiology', /cardio|heart|vascular/i],
    ['Emergency Medicine', /emergency|trauma|acute care/i],
    ['Family Medicine', /family medicine|primary care/i],
    ['Internal Medicine', /internal medicine|hospital medicine/i],
    ['Neurology', /neuro|stroke|brain/i],
    ['Oncology', /oncolog|cancer|tumor/i],
    ['Pediatrics', /pediatric|children|adolescent/i],
    ['Psychiatry', /psychiatr|behavioral health|depression|anxiety/i],
    ['Surgery', /surgery|surgical|perioperative/i],
    ['Women’s Health', /obstetric|gynecol|maternal|women's health/i],
  ];
  const titleMatch = rules.find(([, pattern]) => pattern.test(title))?.[0];
  if (titleMatch) return titleMatch;
  const areas = listNames(activity.practiceAreas).filter((name) => !/^all practice areas/i.test(name));
  if (areas.length === 1) return areas[0];
  const boards = listNames(activity.boards);
  if (boards.length === 1) return boards[0].replace(/^American Board of\s+/i, '');
  return 'General Medicine';
}

function physicianCredit(activity) {
  return (activity.creditTypes || []).find((credit) => PHYSICIAN_CREDIT.test(credit?.name || '') && Number(credit?.credits) > 0);
}

function activityFormat(activity) {
  const value = clean(activity.cmeFinderType || activity.locationType || activity.type, 100);
  if (/online|internet|enduring|journal/i.test(value)) return 'Online';
  if (/live|course|conference|in.person/i.test(value)) return 'In Person';
  return value || 'CME Activity';
}

function rejectionReason(activity, today) {
  if (!activity || activity.isDeleted || activity.isCmeFinder === false) return 'not_public';
  if (!/^active$/i.test(activity.status || '')) return 'not_active';
  const endDate = isoDate(activity.endDate);
  if (!endDate || endDate < today) return 'expired';
  if (!physicianCredit(activity)) return 'missing_physician_credit';
  if (!clean(activity.title) || !clean(activity.providerName)) return 'missing_identity';
  if (!validPublicUrl(activity.url)) return 'missing_registration_url';
  return '';
}

function normalizeActivity(activity, scrapedAt) {
  const credit = physicianCredit(activity);
  const startDate = isoDate(activity.startDate);
  const endDate = isoDate(activity.endDate);
  const specialty = inferSpecialty(activity);
  const format = activityFormat(activity);
  const location = [activity.city, activity.state, activity.country].map((item) => clean(item, 100)).filter(Boolean).join(', ');
  const boardNames = listNames(activity.boards);
  const practiceAreas = listNames(activity.practiceAreas);
  const creditTypes = (activity.creditTypes || []).map((item) => ({ name: clean(item.name, 160), credits: Number(item.credits) || 0 }));

  return normalizeCourse({
    provider: clean(activity.providerName, 120),
    provider_slug: '',
    source_url: CATALOG_URL,
    url: activity.url,
    title: activity.title,
    description: activity.description || `${activity.title} is an active accredited CME activity listed by ACCME CME Passport.`,
    course_type: clean(activity.type || 'Accredited CME', 120),
    format,
    audience: 'Physicians',
    topic: specialty,
    credits: Number(credit.credits),
    credits_text: `${Number(credit.credits)} ${clean(credit.name, 100)}`,
    price: clean(activity.participationFee, 120),
    start_date: startDate,
    end_date: endDate,
    date_text: startDate === endDate ? startDate : `${startDate} – ${endDate}`,
    location: location || (format === 'Online' ? 'Online' : 'See provider'),
    city: activity.city,
    state: activity.state,
    country: activity.country,
    accreditation: `ACCME-accredited provider; ${clean(credit.name, 160)}`,
    tags: ['Medicine', 'Physician CME', specialty, format, ...boardNames.slice(0, 4)],
    metadata: {
      discipline: 'medicine',
      accme_activity_id: String(activity.id || ''),
      accme_business_id: clean(activity.businessId, 80),
      accme_provider_id: clean(activity.providerId, 120),
      accme_status: clean(activity.status, 40),
      registration: clean(activity.registration, 80),
      providership: clean(activity.providership, 80),
      practice_areas: practiceAreas,
      certifying_boards: boardNames,
      credit_types: creditTypes,
      is_moc: Boolean(activity.isMoc),
      scraped_at: scrapedAt,
      catalog: 'ACCME CME Passport',
    },
  });
}

async function fetchPage(skip, signal) {
  const response = await fetch(API_URL, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://cmefinderprd.accme.org',
      Referer: 'https://cmefinderprd.accme.org/',
      'User-Agent': 'Mozilla/5.0 (compatible; CEAtlasCatalogBot/1.0; +https://ceatlas.co)',
    },
    body: JSON.stringify({ top: PAGE_SIZE, skip, sortBy: 'Timestamp', sortAscending: false }),
  });
  if (!response.ok) throw new Error(`ACCME search returned ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.results)) throw new Error(payload.message || 'ACCME search returned no results array');
  return payload;
}

export async function scrapeAccmePhysicianCme({ target = 10000, maxPages = 390, onProgress } = {}) {
  const scrapedAt = new Date().toISOString();
  const today = scrapedAt.slice(0, 10);
  const accepted = [];
  const rejected = {};
  const seen = new Set();
  let totalAvailable = 0;
  let scanned = 0;

  for (let page = 0; page < maxPages && accepted.length < target; page += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let payload;
    try {
      payload = await fetchPage(page * PAGE_SIZE, controller.signal);
    } finally {
      clearTimeout(timeout);
    }
    totalAvailable = Number(payload.totalCount) || totalAvailable;
    if (!payload.results.length) break;

    for (const result of payload.results) {
      const activity = result?.document || result;
      scanned += 1;
      const reason = rejectionReason(activity, today);
      if (reason) {
        rejected[reason] = (rejected[reason] || 0) + 1;
        continue;
      }
      const key = `${clean(activity.providerName, 160)}|${clean(activity.title, 260)}|${clean(activity.url, 600)}`.toLowerCase();
      if (seen.has(key)) {
        rejected.duplicate = (rejected.duplicate || 0) + 1;
        continue;
      }
      seen.add(key);
      accepted.push(normalizeActivity(activity, scrapedAt));
      if (accepted.length >= target) break;
    }

    onProgress?.({ page: page + 1, scanned, accepted: accepted.length, totalAvailable, rejected });
  }

  return { courses: accepted, report: { scraped_at: scrapedAt, source: CATALOG_URL, total_available: totalAvailable, scanned, accepted: accepted.length, rejected } };
}
