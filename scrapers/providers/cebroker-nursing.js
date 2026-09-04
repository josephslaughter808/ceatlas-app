import { normalizeCourse } from '../../lib/normalize.js';

const API_URL = 'https://courses.cebroker.com/api/offerings';
const CATALOG_URL = 'https://courses.cebroker.com/search/fl/registered-nurse?tab=courses';
const PROFESSION = { id: 36, audience: 'Registered Nurses', scope: 'Florida Registered Nurse' };
const PAGE_SIZE = 475;
const SOURCE_FIELDS = [
  'id', 'price', 'isFree', 'endDate', 'startDate', 'location',
  'course.id', 'course.name', 'course.description', 'course.deliveryMethod',
  'course.registrationWebsite', 'course.provider.name', 'course.provider.id',
  'course.rating', 'course.ratingCount', 'course.type', 'course.nowStatusCode',
].join(',');

function clean(value = '', max = 1200) {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function isoDate(value) {
  if (!value || /^0?1\/0?1\/0{3}[01]/.test(value)) return '';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toISOString().slice(0, 10);
}

function slugify(value) {
  return clean(value, 140).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function specialty(title = '') {
  const rules = [
    ['Critical Care & Emergency', /critical care|emergency|trauma|triage|icu/i],
    ['Advanced Practice & Pharmacology', /pharmacol|prescrib|controlled substance|nurse practitioner|aprn/i],
    ['Patient Safety & Quality', /patient safety|medical error|quality improvement|infection control/i],
    ['Behavioral & Mental Health', /mental health|psychiatr|behavioral|substance use|suicide/i],
    ['Maternal, Newborn & Pediatrics', /maternal|obstetric|pregnan|newborn|neonatal|pediatric|child/i],
    ['Geriatrics & Long-Term Care', /geriatric|older adult|aging|dementia|long-term care/i],
    ['Cardiovascular Nursing', /cardiac|cardio|heart|stroke|hypertension/i],
    ['Oncology Nursing', /oncolog|cancer|chemotherap|tumor/i],
    ['Pain & Palliative Care', /pain|palliative|hospice|end.of.life/i],
    ['Ethics, Law & Compliance', /ethic|law|rules|human trafficking|domestic violence|workplace impairment/i],
    ['Leadership & Professional Practice', /leadership|management|delegat|communication|documentation|preceptor/i],
  ];
  return rules.find(([, pattern]) => pattern.test(title))?.[0] || 'General Nursing';
}

function detailUrl(offering, professionId) {
  const course = offering.course || {};
  return `https://courses.cebroker.com/courses/${offering.id}-${slugify(course.name)}?courseId=${course.id}&profession=${professionId}`;
}

function compactCourse(course) {
  const { provider, url, title, description, course_type, format, audience, topic, credits, credits_text, price, start_date, end_date, location, accreditation, metadata } = course;
  return { provider, url, title, description, course_type, format, audience, topic, credits, credits_text, price, start_date, end_date, location, accreditation, metadata };
}

async function fetchPage(professionId, pageIndex) {
  const params = new URLSearchParams({
    pageIndex: String(pageIndex), pageSize: String(PAGE_SIZE), sortField: 'RELEVANCE',
    expand: 'totalItems', state: 'FL', profession: String(professionId), courseType: 'CD_ANYTIME', _source: SOURCE_FIELDS,
  });
  const response = await fetch(`${API_URL}?${params}`, { headers: { 'ceb-web-version': 'mkt-mx-cs-web@2026.9.1.0' } });
  if (!response.ok) throw new Error(`CE Broker returned ${response.status}`);
  return response.json();
}

async function fetchProviders(pageIndex) {
  const params = new URLSearchParams({ pageIndex: String(pageIndex), pageSize: '500', term: '', profession: '36', state: 'FL' });
  const response = await fetch(`https://courses.cebroker.com/api/providers?${params}`);
  if (!response.ok) throw new Error(`CE Broker providers returned ${response.status}`);
  return response.json();
}

async function fetchProviderOfferings(providerId, pageIndex) {
  const params = new URLSearchParams({
    pageIndex: String(pageIndex), pageSize: String(PAGE_SIZE), sortField: 'RELEVANCE', expand: 'totalItems',
    state: 'FL', profession: '36', courseType: 'CD_ANYTIME', providerId: String(providerId), _source: SOURCE_FIELDS,
  });
  const response = await fetch(`${API_URL}?${params}`, { headers: { 'ceb-web-version': 'mkt-mx-cs-web@2026.9.1.0' } });
  if (!response.ok) throw new Error(`CE Broker provider ${providerId} returned ${response.status}`);
  return response.json();
}

export async function scrapeNursingCe({ onProgress } = {}) {
  const scrapedAt = new Date().toISOString();
  const today = scrapedAt.slice(0, 10);
  const courses = new Map();
  const rejected = { expired: 0, unpublished: 0, missing_identity: 0 };
  const sourceTotals = {};
  const profession = PROFESSION;
  const firstPage = await fetchPage(profession.id, 1);
  sourceTotals[profession.scope] = Number(firstPage.totalItems) || 0;
  const providers = [];
  let providerPage = 1;
  let providerTotal = Infinity;
  while ((providerPage - 1) * 500 < providerTotal) {
    const payload = await fetchProviders(providerPage);
    providerTotal = Number(payload.totalItems) || 0;
    providers.push(...(payload.items || []));
    if (!(payload.items || []).length) break;
    providerPage += 1;
  }

  function accept(offering) {
      const course = offering.course || {};
      const endDate = isoDate(offering.endDate);
      if (endDate && endDate < today) { rejected.expired += 1; return; }
      if (course.nowStatusCode && course.nowStatusCode !== 'PUBLISHED') { rejected.unpublished += 1; return; }
      if (!clean(course.name) || !clean(course.provider?.name)) { rejected.missing_identity += 1; return; }
      if (courses.has(String(offering.id))) return;
      const format = /live/i.test(course.type || '') ? 'Live' : /seminar|interactive/i.test(course.deliveryMethod?.description || '') ? 'Interactive' : 'Online';
      const topic = specialty(course.name);
      courses.set(String(offering.id), compactCourse(normalizeCourse({
        provider: course.provider.name,
        source_url: CATALOG_URL,
        url: detailUrl(offering, profession.id),
        title: course.name,
        description: clean(course.description, 320) || `${course.name} is listed in CE Broker's Florida Board of Nursing-approved catalog.`,
        course_type: 'Board-approved nursing CE',
        format,
        audience: profession.audience,
        topic,
        credits_text: 'Florida Board of Nursing-approved CE',
        price: offering.isFree ? 'Free' : Number(offering.price) > 0 ? `$${Number(offering.price).toFixed(2)}` : '',
        start_date: isoDate(offering.startDate),
        end_date: endDate,
        date_text: endDate ? `Available through ${endDate}` : 'Current on-demand activity',
        location: clean(offering.location?.name || offering.location?.city) || (format === 'Online' ? 'Online' : 'See provider'),
        accreditation: `Pre-approved for ${profession.scope} CE via CE Broker`,
        tags: ['Nursing', 'Florida Board Approved', topic, format],
        metadata: { discipline: 'nursing', approval_scope: profession.scope, cebroker_offering_id: String(offering.id), cebroker_course_id: String(course.id), scraped_at: scrapedAt },
      })));
  }

  let completedProviders = 0;
  for (let offset = 0; offset < providers.length; offset += 12) {
    const batch = providers.slice(offset, offset + 12);
    await Promise.all(batch.map(async (provider) => {
      let page = 1;
      let total = Infinity;
      while ((page - 1) * PAGE_SIZE < total) {
        const payload = await fetchProviderOfferings(provider.id, page);
        total = Number(payload.totalItems) || 0;
        for (const offering of payload.items || []) accept(offering);
        if (!(payload.items || []).length) break;
        page += 1;
      }
      completedProviders += 1;
    }));
    onProgress?.({ audience: profession.audience, providers: completedProviders, providerTotal: providers.length, total: sourceTotals[profession.scope], accepted: courses.size, rejected: { ...rejected } });
  }
  if (courses.size < 10000) {
    throw new Error(`Nursing catalog minimum not met: ${courses.size} current activities`);
  }
  return { courses: [...courses.values()], report: { scraped_at: scrapedAt, source: CATALOG_URL, source_totals: sourceTotals, providers_scanned: providers.length, minimum: 10000, accepted: courses.size, approval_scope: profession.scope, rejected } };
}
