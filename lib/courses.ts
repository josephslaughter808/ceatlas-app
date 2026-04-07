import { getCourseRatingSummaries, getPublicCourseCatalog, getPublicProviders } from './db.js';

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
  provider?: string;
  format?: string;
  topic?: string;
};

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

function aggregatorSourceText(row: CatalogRow) {
  return [
    row.source_url,
    row.registration_url,
    row.metadata?.provider_catalog_url,
    typeof row.metadata?.original_metadata === 'object' && row.metadata?.original_metadata
      ? (row.metadata.original_metadata as Record<string, unknown>).extracted_from
      : null,
  ].filter(Boolean).join(' | ');
}

function providerFilterName(row: CatalogRow, providerName: string | null) {
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

async function getNormalizedCatalog() {
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

  return rows.map((row) => normalizeCourse({
    ...(row as CatalogRow),
    ...(ratingsByCourseId.get(row.id) || {}),
  }));
}

export async function getCourses(searchParams: CourseSearchParams = {}, take?: number) {
  const rows = await getNormalizedCatalog();
  const search = typeof searchParams.search === 'string' ? searchParams.search.trim() : '';
  const provider = typeof searchParams.provider === 'string' ? searchParams.provider.trim() : '';
  const format = typeof searchParams.format === 'string' ? searchParams.format.trim() : '';
  const topic = typeof searchParams.topic === 'string' ? searchParams.topic.trim() : '';

  const filtered = rows
    .filter((course) => matchesSearch(course, search))
    .filter((course) => (provider ? course.provider_filter_name === provider : true))
    .filter((course) => (format ? course.next_format === format : true))
    .filter((course) => (topic ? course.topic_tags.includes(topic) || course.headline_topic === topic : true))
    .sort(compareCourses);

  return typeof take === 'number' ? filtered.slice(0, take) : filtered;
}

export async function getFeaturedCourses(take = 6) {
  const rows = await getNormalizedCatalog();
  return [...rows]
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
    .slice(0, take);
}

export async function getCatalogOverview() {
  const [rows, providers] = await Promise.all([
    getNormalizedCatalog(),
    getPublicProviders(),
  ]);

  return {
    courseCount: rows.length,
    providerCount: providers.length,
    formatCount: new Set(rows.map((row) => row.next_format).filter(Boolean)).size,
  };
}

export async function getCourseFilters() {
  const rows = await getNormalizedCatalog();

  const formats = [...new Set(rows.map((row) => row.next_format).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b)));
  const topics = [...new Set(rows.flatMap((row) => row.topic_tags || []).filter(Boolean))]
    .map((topic) => classifyTopicBucket([topic]))
    .filter(Boolean);
  const normalizedTopics = [...new Set(topics)].sort((a, b) => String(a).localeCompare(String(b)));

  return {
    providers: [...new Set(rows.map((row) => row.provider_filter_name).filter(Boolean))]
      .map((provider) => ({
        provider,
        provider_slug: String(provider).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      }))
      .sort((a, b) => String(a.provider).localeCompare(String(b.provider))),
    formats,
    topics: normalizedTopics,
  };
}

export async function getCourseById(id: string) {
  const rows = await getNormalizedCatalog();
  return rows.find((row) => row.id === id) || null;
}
