import { normalizeCourse } from '../../lib/normalize.js';

const API_URL = 'https://courses.cebroker.com/api/offerings';
const CATALOG_URL = 'https://courses.cebroker.com/search/aavsb/veterinarian';
const PROFESSIONS = [
  { id: 4354, audience: 'Veterinarians' },
  { id: 4352, audience: 'Veterinary Technicians' },
];
const PAGE_SIZE = 500;
const TARGET = 10000;
const SOURCE_FIELDS = [
  'id', 'price', 'isFree', 'endDate', 'startDate', 'location',
  'course.id', 'course.name', 'course.description', 'course.deliveryMethod',
  'course.registrationWebsite', 'course.provider.name', 'course.provider.id',
  'course.rating', 'course.ratingCount', 'course.type',
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
    ['Emergency & Critical Care', /emergency|critical care|trauma|triage/i],
    ['Internal Medicine', /internal medicine|endocrin|diabetes|renal|kidney/i],
    ['Surgery', /surg|orthop|fracture|wound/i],
    ['Dermatology', /dermat|skin|allerg/i],
    ['Dentistry', /dental|dentistry|oral health|periodont/i],
    ['Cardiology', /cardio|cardiac|heart disease|heart failure/i],
    ['Neurology', /neuro|seizure|brain/i],
    ['Oncology', /oncolog|cancer|tumor/i],
    ['Anesthesia & Pain', /anesthe|analgesi|pain management/i],
    ['Behavior', /behavio|fear free|anxiety/i],
    ['Equine', /equine|horse|mare|foal/i],
    ['Food Animal', /bovine|cattle|ruminant|swine|poultry|food animal/i],
    ['Exotics & Wildlife', /exotic|avian|wildlife|reptile|zoo/i],
    ['Practice Management', /practice management|leadership|wellness|communication/i],
  ];
  return rules.find(([, pattern]) => pattern.test(title))?.[0] || 'General Veterinary Medicine';
}

function detailUrl(offering, professionId) {
  const course = offering.course || {};
  return `https://courses.cebroker.com/courses/${offering.id}-${slugify(course.name)}?courseId=${course.id}&profession=${professionId}`;
}

async function fetchPage(professionId, pageIndex) {
  const params = new URLSearchParams({
    pageIndex: String(pageIndex), pageSize: String(PAGE_SIZE), sortField: 'RELEVANCE',
    expand: 'totalItems', profession: String(professionId), _source: SOURCE_FIELDS,
  });
  const response = await fetch(`${API_URL}?${params}`, { headers: { 'ceb-web-version': 'mkt-mx-cs-web@2026.9.1.0' } });
  if (!response.ok) throw new Error(`CE Broker returned ${response.status}`);
  return response.json();
}

export async function scrapeVeterinaryCe({ onProgress } = {}) {
  const scrapedAt = new Date().toISOString();
  const today = scrapedAt.slice(0, 10);
  const courses = new Map();
  const rejected = { expired: 0, missing_identity: 0 };

  for (const profession of PROFESSIONS) {
    let page = 1;
    let total = Infinity;
    while (courses.size < TARGET && (page - 1) * PAGE_SIZE < total) {
      const payload = await fetchPage(profession.id, page);
      total = Number(payload.totalItems) || 0;
      for (const offering of payload.items || []) {
        const course = offering.course || {};
        const endDate = isoDate(offering.endDate);
        if (endDate && endDate < today) { rejected.expired += 1; continue; }
        if (!clean(course.name) || !clean(course.provider?.name)) { rejected.missing_identity += 1; continue; }
        const key = String(offering.id);
        const prior = courses.get(key);
        if (prior) {
          prior.audience = [...new Set(`${prior.audience}, ${profession.audience}`.split(', '))].join(', ');
          prior.metadata.audiences = prior.audience.split(', ');
          continue;
        }
        const format = /live/i.test(course.type || '') ? 'Live' : /seminar|interactive/i.test(course.deliveryMethod?.description || '') ? 'Interactive' : 'Online';
        const topic = specialty(course.name);
        courses.set(key, normalizeCourse({
          provider: course.provider.name,
          source_url: CATALOG_URL,
          url: detailUrl(offering, profession.id),
          title: course.name,
          description: course.description || `${course.name} is listed in CE Broker's official AAVSB RACE-approved catalog.`,
          course_type: 'RACE-approved veterinary CE',
          format,
          audience: profession.audience,
          topic,
          credits_text: 'RACE-approved veterinary CE',
          price: offering.isFree ? 'Free' : Number(offering.price) > 0 ? `$${Number(offering.price).toFixed(2)}` : '',
          start_date: isoDate(offering.startDate),
          end_date: endDate,
          date_text: endDate ? `Available through ${endDate}` : 'Current on-demand activity',
          location: clean(offering.location?.name || offering.location?.city) || (format === 'Online' ? 'Online' : 'See provider'),
          accreditation: 'AAVSB RACE approved',
          tags: ['Veterinary Medicine', 'RACE Approved', topic, format],
          metadata: { discipline: 'veterinary', cebroker_offering_id: key, cebroker_course_id: String(course.id), audiences: [profession.audience], scraped_at: scrapedAt },
        }));
        if (courses.size >= TARGET) break;
      }
      onProgress?.({ audience: profession.audience, page, total, accepted: courses.size });
      if (!(payload.items || []).length) break;
      page += 1;
    }
  }
  return { courses: [...courses.values()], report: { scraped_at: scrapedAt, source: CATALOG_URL, accepted: courses.size, rejected } };
}
