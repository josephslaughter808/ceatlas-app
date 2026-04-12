import {
  getCatalogStats,
  getCourseRatingSummaries,
  getCourseRatingSummariesForCourseIds,
  getPublicCourseCatalog,
  getPublicCourseCatalogPage,
  getPublicCourseProviderFilterRows,
  getPublicCoursesByIds,
  getPublicSessionFormats,
} from './db.js';
import { unstable_cache } from 'next/cache';

type CatalogRow = {
  id: string;
  provider_name: string | null;
  provider_website: string | null;
  title: string | null;
  description: string | null;
  category: string | null;
  topic: string | null;
  price: number | null;
  price_text: string | null;
  credits_text: string | null;
  credits: number | null;
  source_url: string | null;
  registration_url: string | null;
  tags: string[] | null;
  metadata?: {
    instructors?: string | null;
    [key: string]: unknown;
  } | null;
  updated_at: string | null;
  next_session_id: string | null;
  next_start_date: string | null;
  next_end_date: string | null;
  next_location: string | null;
  next_format: string | null;
  next_city?: string | null;
  next_state?: string | null;
  next_country?: string | null;
  next_session_address?: string | null;
  next_session_latitude?: number | null;
  next_session_longitude?: number | null;
  session_count: number | null;
  rating_average?: number | null;
  rating_count?: number | null;
};

type PriceOption = {
  label: string;
  amount: number | null;
};

type CourseSearchParams = {
  search?: string;
  provider?: string | string[];
  format?: string | string[];
  topic?: string | string[];
  sort?: string;
};

type ProviderFilterSource = Pick<CatalogRow, 'source_url' | 'registration_url' | 'metadata'>;

const TOPIC_BUCKETS: Array<{ label: string; patterns: RegExp[] }> = [
  { label: 'Endodontics', patterns: [/\bendo\b/i, /\bendodont/i, /\broot canal/i] },
  { label: 'Implants', patterns: [/\bimplant/i, /\bfull-arch\b/i, /\bosseointegration\b/i] },
  { label: 'Orthodontics', patterns: [/\bortho/i, /\baligner/i, /\borthodont/i] },
  { label: 'Periodontics', patterns: [/\bperio/i, /\bperiodont/i, /\bsoft tissue graft/i] },
  { label: 'Pediatric Dentistry', patterns: [/\bpediatric/i, /\bchild\b/i, /\bchildren\b/i] },
  { label: 'Oral Surgery', patterns: [/\boral surgery/i, /\bmaxillofacial/i, /\bsurgery\b/i, /\bsurgical\b/i] },
  { label: 'Oral Medicine & Pathology', patterns: [/\boral medicine/i, /\boral diagnosis/i, /\bpathology\b/i, /\borofacial pain\b/i, /\btmd\b/i] },
  { label: 'Prosthodontics', patterns: [/\bprosthod/i, /\bdenture/i, /\bveneer/i, /\bcrown/i, /\bbridge\b/i] },
  { label: 'Restorative Dentistry', patterns: [/\brestorative\b/i, /\boperative\b/i, /\bcomposite\b/i, /\bceramic\b/i, /\badhesion\b/i, /\bmaterials\b/i] },
  { label: 'Esthetics & Facial Esthetics', patterns: [/\besthetic/i, /\bcosmetic/i, /\bbotox\b/i, /\bdermal filler/i, /\bfacial esthetic/i, /\bcollagen/i] },
  { label: 'Digital Dentistry & Technology', patterns: [/\bdigital/i, /\bcbct\b/i, /\bimaging\b/i, /\bradiolog/i, /\bphotography\b/i, /\bartificial intelligence/i, /\bai\b/i, /\b3d\b/i] },
  { label: 'Sleep & Airway', patterns: [/\bsleep\b/i, /\bairway\b/i, /\bapnea\b/i, /\bmyofunction/i] },
  { label: 'Anesthesia, Sedation & Emergencies', patterns: [/\banesthesia\b/i, /\bsedation\b/i, /\bpain management\b/i, /\bcpr\b/i, /\bmedical emergency/i] },
  { label: 'Hygiene & Preventive Care', patterns: [/\bhygiene\b/i, /\bprevent/i, /\bcaries\b/i, /\bbleaching\b/i, /\binfection control\b/i] },
  { label: 'Practice Management & Business', patterns: [/\bpractice management\b/i, /\bbusiness\b/i, /\bcoding\b/i, /\bcompliance\b/i, /\bhipaa\b/i, /\bmanagement\b/i, /\bcommunication\b/i, /\bhuman relations\b/i] },
  { label: 'Public Health & Special Care', patterns: [/\bpublic health\b/i, /\bcommunity health\b/i, /\bhealth policy\b/i, /\bspecial patient care\b/i, /\bsubstance use\b/i, /\baddiction\b/i] },
  { label: 'Basic Sciences', patterns: [/\bbasic science/i, /\banatomy\b/i, /\bnutrition\b/i, /\bforensic/i] },
  { label: 'Professional Development', patterns: [/\bself-improvement\b/i, /\bleadership\b/i, /\bpersonal development\b/i, /\bethics\b/i, /\beducator/i] },
  { label: 'General Dentistry', patterns: [/\bmulti-disciplinary\b/i, /\bclinical dentistry\b/i, /\belectives\b/i, /\bgeneral dental/i] },
];

const AGGREGATOR_PROVIDER_LABELS: Array<{ label: string; patterns: RegExp[] }> = [
  {
    label: 'All Conference Alert Dentistry',
    patterns: [/all-conference-alert-dentistry/i, /allconferencealert\.net/i],
  },
  {
    label: 'World Dental Events',
    patterns: [/world-dental-events/i, /worlddental\.events/i],
  },
  {
    label: 'DentEvents Global Dental Events',
    patterns: [/\bdentevents\b/i, /dentevents\.com/i],
  },
  {
    label: 'Conference Index Dentistry',
    patterns: [/conference-index-dentistry/i, /conferenceindex\.org/i],
  },
  {
    label: 'Dental Tribune Events',
    patterns: [/dental-tribune-events/i, /dental-tribune-global/i, /dental-tribune\.com/i],
  },
];

const UNVERIFIED_EVENT_AGGREGATOR_LABELS = new Set(
  AGGREGATOR_PROVIDER_LABELS.map((entry) => entry.label)
);

function titleCaseWord(word: string) {
  if (!word) return word;
  if (/^[A-Z0-9&/-]{2,}$/.test(word) && word.length <= 4) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function formatProviderName(name: string | null | undefined) {
  if (!name) return null;
  if (name !== name.toUpperCase()) return name;
  return name
    .split(/\s+/)
    .map((word) => word.split('-').map(titleCaseWord).join('-'))
    .join(' ');
}

function parseTagList(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function normalizeFormatLabel(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (text.length > 36) return null;
  if (/[.!?]/.test(text)) return null;
  if (/,/.test(text) && text.split(/\s+/).length > 5) return null;
  if (/\b(invited|participants|review logistics|what you will learn|course objectives|register|waitlist)\b/i.test(text)) {
    return null;
  }

  if (/\b(on-demand|on demand|online|webinar|ce online courses|evergreen)\b/i.test(text)) {
    return "Online";
  }

  if (/\b(in person|live training|live course|live workshop|conference session|hands-on|hands on|live)\b/i.test(text)) {
    return "In Person";
  }

  if (/\bhybrid\b/i.test(text)) {
    return "Hybrid";
  }

  return text;
}

function classifyTopicBucket(values: Array<string | null | undefined>) {
  const haystack = uniqueStrings(values).join(' | ');

  for (const bucket of TOPIC_BUCKETS) {
    if (bucket.patterns.some((pattern) => pattern.test(haystack))) {
      return bucket.label;
    }
  }

  return 'General Dentistry';
}

function aggregatorSourceText(row: ProviderFilterSource) {
  return [
    row.source_url,
    row.registration_url,
    row.metadata?.provider_catalog_url,
    typeof row.metadata?.original_metadata === 'object' && row.metadata?.original_metadata
      ? (row.metadata.original_metadata as Record<string, unknown>).extracted_from
      : null,
  ].filter(Boolean).join(' | ');
}

function providerFilterName(row: ProviderFilterSource, providerName: string | null) {
  const sourceText = aggregatorSourceText(row);

  for (const aggregator of AGGREGATOR_PROVIDER_LABELS) {
    if (aggregator.patterns.some((pattern) => pattern.test(sourceText))) {
      return aggregator.label;
    }
  }

  return providerName || 'Unknown provider';
}

function looksLikeInstructor(value: string) {
  if (!value) return false;
  if (value.length > 140) return false;
  if (/\b(learn|achieve|guidance|comprehensive|immediately|hands-on|live patients|treatment planning|your practice|course will|you will)\b/i.test(value)) {
    return false;
  }
  return true;
}

function parsePriceOptions(value: string | null | undefined): PriceOption[] {
  if (!value) return [];

  return value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.*?):\s*\$?\s*(-?\d+(?:\.\d+)?)/);
      if (!match) {
        return { label: part, amount: null };
      }

      return {
        label: match[1].trim(),
        amount: Number(match[2]),
      };
    });
}

function formatMoney(amount: number) {
  return `$${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

function buildCardPrice(priceText: string | null | undefined, price: number | null | undefined) {
  const options = parsePriceOptions(priceText);

  if (options.length > 0) {
    const publicPaidOptions = options.filter(
      (option) => (option.amount ?? 0) > 0 && !/subscription/i.test(option.label)
    );

    if (publicPaidOptions.length > 0) {
      const cheapest = publicPaidOptions.reduce((lowest, option) => (
        lowest.amount !== null && option.amount !== null && option.amount < lowest.amount ? option : lowest
      ));

      return publicPaidOptions.length > 1
        ? `From ${formatMoney(cheapest.amount || 0)}`
        : `${cheapest.label}: ${formatMoney(cheapest.amount || 0)}`;
    }

    const allZero = options.every((option) => option.amount === 0);
    if (allZero) return "Free";
  }

  if (typeof price === "number") {
    return price === 0 ? "Free" : formatMoney(price);
  }

  if (priceText && !/\$0\b/.test(priceText)) {
    return priceText;
  }

  return null;
}

function buildDetailPrice(priceText: string | null | undefined, price: number | null | undefined) {
  const options = parsePriceOptions(priceText);
  if (options.length > 0 && options.every((option) => option.amount === 0)) {
    return "Free";
  }

  if (priceText) return priceText;
  if (typeof price === "number") return price === 0 ? "Free" : formatMoney(price);
  return null;
}

function normalizeCourse(row: CatalogRow) {
  const providerName = formatProviderName(row.provider_name);
  const tags = Array.isArray(row.tags) ? uniqueStrings(row.tags) : [];
  const topicTags = parseTagList(row.topic);
  const normalizedFormat = normalizeFormatLabel(row.next_format);
  const topicBucket = classifyTopicBucket([
    row.topic,
    row.category,
    row.title,
    row.description,
    ...topicTags,
    ...tags,
  ]);
  const category = row.category || normalizedFormat || null;
  const headlineTopic = topicBucket || topicTags.find((tag) => tag !== category) || category;
  const cardPrice = buildCardPrice(row.price_text, row.price);
  const detailPrice = buildDetailPrice(row.price_text, row.price);
  const instructors = uniqueStrings(String(row.metadata?.instructors || '')
    .split('\n')
    .map((item) => item.trim())
    .filter((item) => looksLikeInstructor(item)));

  return {
    ...row,
    provider_name: providerName,
    provider_filter_name: providerFilterName(row, providerName),
    category,
    next_format: normalizedFormat,
    headline_topic: headlineTopic,
    topic_bucket: topicBucket,
    card_price: cardPrice,
    detail_price: detailPrice,
    instructors,
    instructor_display: instructors[0] || null,
    tags,
    topic_tags: uniqueStrings([...topicTags, ...tags]),
  };
}

export type CourseRecord = ReturnType<typeof normalizeCourse>;
export type EventRecord = CourseRecord;

function hasExplicitCeCreditSignal(course: ReturnType<typeof normalizeCourse>) {
  if (typeof course.credits === "number" && Number.isFinite(course.credits) && course.credits > 0) {
    return true;
  }

  const creditsText = String(course.credits_text || "").trim();
  if (!creditsText) return false;

  return /\b(ce|ceu|cde|credit|credits|hour|hours)\b/i.test(creditsText)
    && !/\b(not specified|n\/a|tbd|unknown)\b/i.test(creditsText);
}

function shouldIncludeCatalogCourse(course: ReturnType<typeof normalizeCourse>) {
  const providerFilter = String(course.provider_filter_name || "").trim();
  if (!UNVERIFIED_EVENT_AGGREGATOR_LABELS.has(providerFilter)) {
    return true;
  }

  return hasExplicitCeCreditSignal(course);
}

function shouldIncludeNonCeEvent(course: ReturnType<typeof normalizeCourse>) {
  const providerFilter = String(course.provider_filter_name || "").trim();
  return UNVERIFIED_EVENT_AGGREGATOR_LABELS.has(providerFilter) && !hasExplicitCeCreditSignal(course);
}

function matchesSearch(course: ReturnType<typeof normalizeCourse>, search: string) {
  if (!search) return true;

  const haystack = [
    course.title,
    course.description,
    course.category,
    course.topic,
    course.provider_name,
    course.next_location,
    course.next_format,
    ...(course.tags || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
}

function toList(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => String(item).split(',')).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function numericValue(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function interleaveByProvider(items: Array<ReturnType<typeof normalizeCourse>>) {
  const providerBuckets = new Map<string, Array<ReturnType<typeof normalizeCourse>>>();

  for (const item of items) {
    const provider = item.provider_name || 'Unknown provider';
    const bucket = providerBuckets.get(provider) || [];
    bucket.push(item);
    providerBuckets.set(provider, bucket);
  }

  const orderedProviders = [...providerBuckets.keys()].sort((a, b) => a.localeCompare(b));
  const result: Array<ReturnType<typeof normalizeCourse>> = [];
  let added = true;

  while (added) {
    added = false;

    for (const provider of orderedProviders) {
      const bucket = providerBuckets.get(provider);
      if (!bucket || bucket.length === 0) continue;
      result.push(bucket.shift() as ReturnType<typeof normalizeCourse>);
      added = true;
    }
  }

  return result;
}

function sortCourses(rows: Array<ReturnType<typeof normalizeCourse>>, sortBy = 'balanced') {
  if (sortBy === 'balanced') {
    return interleaveByProvider(rows);
  }

  return [...rows].sort((a, b) => {
    if (sortBy === 'credits-high') {
      return (numericValue(b.credits) ?? -1) - (numericValue(a.credits) ?? -1);
    }

    if (sortBy === 'rating-high') {
      return (numericValue(b.rating_average) ?? -1) - (numericValue(a.rating_average) ?? -1);
    }

    if (sortBy === 'instructor') {
      return String(a.instructor_display || 'ZZZ').localeCompare(String(b.instructor_display || 'ZZZ'));
    }

    if (sortBy === 'price-low') {
      return (numericValue(a.price) ?? Number.MAX_SAFE_INTEGER) - (numericValue(b.price) ?? Number.MAX_SAFE_INTEGER);
    }

    if (sortBy === 'price-high') {
      return (numericValue(b.price) ?? -1) - (numericValue(a.price) ?? -1);
    }

    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}

function compareCourses(a: ReturnType<typeof normalizeCourse>, b: ReturnType<typeof normalizeCourse>) {
  return [
    a.next_start_date || '',
    a.provider_name || '',
    a.title || '',
  ].join('|').localeCompare([
    b.next_start_date || '',
    b.provider_name || '',
    b.title || '',
  ].join('|'));
}

async function getAllNormalizedCatalog() {
  const [rows, ratingRows] = await Promise.all([
    getPublicCourseCatalog(),
    getCourseRatingSummaries(),
  ]);

  const ratingsByCourseId = new Map(
    ratingRows.map((row) => [
      row.course_id,
      {
        rating_average: row.average_overall_rating,
        rating_count: row.rating_count,
      },
    ])
  );

  return rows.map((row: CatalogRow) => normalizeCourse({
    ...(row as CatalogRow),
    ...(ratingsByCourseId.get(row.id) || {}),
  }));
}

async function getAllNormalizedCatalogLite() {
  const rows = await getPublicCourseCatalog();
  return rows.map((row: CatalogRow) => normalizeCourse(row as CatalogRow));
}

async function getNormalizedCatalog() {
  const rows = await getAllNormalizedCatalog();
  return rows.filter(shouldIncludeCatalogCourse);
}

async function getNormalizedCatalogLite() {
  const rows = await getAllNormalizedCatalogLite();
  return rows.filter(shouldIncludeCatalogCourse);
}

const getCachedNormalizedCatalogLite = unstable_cache(
  async () => getNormalizedCatalogLite(),
  ['course-map-catalog-lite'],
  { revalidate: 60 * 30 }
);

const getCachedNormalizedCatalog = unstable_cache(
  async () => getNormalizedCatalog(),
  ['course-catalog-full'],
  { revalidate: 60 * 30 }
);

async function getCatalogRows(
  searchParams: CourseSearchParams = {},
  useLite = false,
) {
  const rows: Array<ReturnType<typeof normalizeCourse>> = useLite
    ? await getCachedNormalizedCatalogLite()
    : await getCachedNormalizedCatalog();
  const search = typeof searchParams.search === 'string' ? searchParams.search.trim() : '';
  const providers = toList(searchParams.provider);
  const formats = toList(searchParams.format);
  const topics = toList(searchParams.topic);
  const sortBy = typeof searchParams.sort === 'string' ? searchParams.sort.trim() : 'balanced';

  return sortCourses(rows
    .filter((course: ReturnType<typeof normalizeCourse>) => matchesSearch(course, search))
    .filter((course: ReturnType<typeof normalizeCourse>) => (providers.length ? providers.includes(course.provider_filter_name || '') : true))
    .filter((course: ReturnType<typeof normalizeCourse>) => (formats.length ? formats.includes(course.next_format || '') : true))
    .filter((course: ReturnType<typeof normalizeCourse>) => (topics.length ? topics.some((topic) => course.topic_bucket === topic || course.topic_tags.includes(topic) || course.headline_topic === topic) : true))
    .sort(compareCourses), sortBy);
}

export async function getCourses(searchParams: CourseSearchParams = {}, take?: number) {
  const filtered = await getCatalogRows(searchParams);

  return typeof take === 'number' ? filtered.slice(0, take) : filtered;
}

export async function getMapCourses(searchParams: CourseSearchParams = {}, take?: number) {
  const filtered = await getCatalogRows(searchParams, true);

  return typeof take === 'number' ? filtered.slice(0, take) : filtered;
}

export async function getCoursesPage(
  searchParams: CourseSearchParams = {},
  page = 1,
  pageSize = 50,
) {
  const safePageSize = pageSize === 100 ? 100 : 50;
  const rows = await getCourses(searchParams);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * safePageSize;
  const end = start + safePageSize;

  return {
    courses: rows.slice(start, end),
    total,
    totalPages,
    currentPage,
    pageSize: safePageSize,
  };
}

export async function getFeaturedCourses(take = 6) {
  const safeTake = Math.max(take, 24);
  const { rows } = await getPublicCourseCatalogPage(1, safeTake);
  const normalized = rows
    .map((row: CatalogRow) => normalizeCourse(row as CatalogRow))
    .filter(shouldIncludeCatalogCourse);

  return normalized.slice(0, take);
}

export async function getCoursesByIds(ids: string[]) {
  const rows = await getPublicCoursesByIds(ids);
  const ratingRows = await getCourseRatingSummariesForCourseIds(rows.map((row: CatalogRow) => row.id));
  const ratingsByCourseId = new Map(
    ratingRows.map((row: { course_id: string; average_overall_rating: number | null; rating_count: number | null }) => [
      row.course_id,
      {
        rating_average: row.average_overall_rating,
        rating_count: row.rating_count,
      },
    ])
  );

  const rowsById = new Map(
    rows.map((row: CatalogRow) => [
      row.id,
      normalizeCourse({
        ...(row as CatalogRow),
        ...(ratingsByCourseId.get(row.id) || {}),
      }),
    ])
  );

  const orderedRows = ids
    .map((id) => rowsById.get(id))
    .filter((course): course is ReturnType<typeof normalizeCourse> => Boolean(course));

  return orderedRows.filter(shouldIncludeCatalogCourse);
}

export async function getCatalogOverview() {
  const stats = await getCatalogStats();

  return {
    courseCount: stats.courses,
    providerCount: stats.providers,
    formatCount: 40,
  };
}

export async function getCourseFilters() {
  const [providerRows, sessionFormats] = await Promise.all([
    getPublicCourseProviderFilterRows(),
    getPublicSessionFormats(),
  ]);

  const formats = [...new Set(sessionFormats.map((format) => normalizeFormatLabel(String(format))).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b)));
  const normalizedTopics = TOPIC_BUCKETS.map((bucket) => bucket.label)
    .sort((a, b) => String(a).localeCompare(String(b)));
  const providerNames = [...new Set(providerRows
    .map((row) => providerFilterName(row, formatProviderName(row.provider_name)))
    .filter(Boolean)
    .filter((provider) => !UNVERIFIED_EVENT_AGGREGATOR_LABELS.has(String(provider))))];

  return {
    providers: providerNames
      .map((provider) => ({
        provider,
        provider_slug: String(provider).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      }))
      .sort((a, b) => String(a.provider).localeCompare(String(b.provider))),
    formats,
    topics: normalizedTopics,
  };
}

export function getDefaultCourseFilters() {
  return {
    providers: [] as Array<{ provider: string; provider_slug: string }>,
    formats: [] as string[],
    topics: TOPIC_BUCKETS.map((bucket) => bucket.label)
      .sort((a, b) => String(a).localeCompare(String(b))),
  };
}

export async function getCourseById(id: string) {
  const rows: Array<ReturnType<typeof normalizeCourse>> = await getNormalizedCatalog();
  return rows.find((row: ReturnType<typeof normalizeCourse>) => row.id === id) || null;
}
