import * as cheerio from 'cheerio';
import { normalizeCourse } from '../../lib/normalize.js';

const COURSE_KEYWORDS = [
  'course',
  'courses',
  'ce',
  'continuing education',
  'webinar',
  'workshop',
  'seminar',
  'training',
  'event',
  'on-demand',
  'ondemand',
  'self-study',
  'self paced',
  'live',
  'lecture',
  'program',
  'certificate',
];

const EXCLUDED_LINK_KEYWORDS = [
  'privacy',
  'accessibility',
  'library',
  'research',
  'careers',
  'students',
  'testing',
  'press',
  'publications',
  'signin',
  'login',
  'cart',
  'checkout',
  'account',
  'contact',
  'about',
  'faq',
  'support',
  'terms',
  'policy',
  'donate',
  'membership',
  'mission-goals',
];

const FORMAT_PATTERNS = [
  { pattern: /\bon-?demand\b|\bself-?paced\b|\banytime\b/i, value: 'On-Demand' },
  { pattern: /\bwebinar\b/i, value: 'Webinar' },
  { pattern: /\blive online\b|\bvirtual\b/i, value: 'Live Online' },
  { pattern: /\bin-person\b|\bon-site\b|\bon campus\b/i, value: 'In Person' },
  { pattern: /\blive\b/i, value: 'Live' },
];

const TYPE_PATTERNS = [
  { pattern: /\bworkshop\b/i, value: 'Workshop' },
  { pattern: /\bwebinar\b/i, value: 'Webinar' },
  { pattern: /\bseminar\b/i, value: 'Seminar' },
  { pattern: /\bon-?demand\b|\bself-?paced\b/i, value: 'On-Demand Course' },
  { pattern: /\blive course\b|\blive training\b/i, value: 'Live Course' },
  { pattern: /\bevent\b/i, value: 'Event' },
  { pattern: /\bcertificate\b/i, value: 'Certificate Program' },
  { pattern: /\btraining\b/i, value: 'Training' },
  { pattern: /\blecture\b/i, value: 'Lecture' },
  { pattern: /\bcourse\b/i, value: 'Course' },
];

const LABEL_PATTERNS = {
  credits_text: /(ce credits?|credits?|hours?|ceu?s?)/i,
  price: /(price|tuition|cost|member price|non-member price|fee)/i,
  audience: /(audience|who should attend|intended for|ideal for)/i,
  instructors: /(instructor|faculty|speaker|presenter|lecturer)/i,
  accreditation: /(accreditation|approved by|recognized by|provider statement|agd|coda|ada c.e.r.p)/i,
  requirements: /(prerequisite|requirements?|what you need|materials needed)/i,
  registration_deadline: /(registration deadline|register by|deadline)/i,
  location: /(location|venue|address|headquarters)/i,
  date_text: /(date|dates|schedule|time|when)/i,
};

function cleanText(value, max = 600) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanMultiline(value, max = 2000) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, max);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function safeUrl(value, baseUrl) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function stripNonContent($) {
  $('script, style, noscript, svg').remove();
}

function collectJsonLdNodes(node, bucket = []) {
  if (!node) return bucket;

  if (Array.isArray(node)) {
    for (const item of node) collectJsonLdNodes(item, bucket);
    return bucket;
  }

  if (typeof node === 'object') {
    bucket.push(node);
    for (const value of Object.values(node)) {
      if (typeof value === 'object') collectJsonLdNodes(value, bucket);
    }
  }

  return bucket;
}

export function extractJsonLd($) {
  const nodes = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text().trim();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      collectJsonLdNodes(parsed, nodes);
    } catch {
      return;
    }
  });

  return nodes;
}

export function extractNextData($) {
  const raw = $('#__NEXT_DATA__').contents().text().trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function textFromJsonLdEntity(entity) {
  if (!entity) return '';
  if (typeof entity === 'string') return cleanText(entity, 250);
  if (typeof entity === 'object') {
    return cleanText(entity.name || entity.title || entity.description || '', 250);
  }
  return '';
}

function pickFirst(...values) {
  return values.map((value) => cleanText(value)).find(Boolean) || '';
}

function findMetaContent($, selector) {
  return cleanText($(selector).attr('content') || '', 400);
}

function findFirstText($, selectors, max = 400) {
  for (const selector of selectors) {
    const text = cleanText($(selector).first().text(), max);
    if (text) return text;
  }
  return '';
}

function getBodyLines($) {
  const clone = cheerio.load($.html());
  stripNonContent(clone);
  const text = clone('body').text();

  return unique(
    text
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => line && line.length >= 3)
  );
}

function extractLabeledValues($) {
  const labels = {};

  $('dt').each((_, element) => {
    const label = cleanText($(element).text(), 120).toLowerCase();
    const value = cleanMultiline($(element).next('dd').text(), 500);
    if (label && value) labels[label] = value;
  });

  $('tr').each((_, element) => {
    const cells = $(element).find('th, td');
    if (cells.length < 2) return;

    const label = cleanText($(cells[0]).text(), 120).toLowerCase();
    const value = cleanMultiline($(cells[1]).text(), 500);
    if (label && value && !labels[label]) labels[label] = value;
  });

  $('p, li, div').each((_, element) => {
    const text = cleanMultiline($(element).text(), 500);
    if (!text || text.length > 220) return;

    const match = text.match(/^([^:]{2,40}):\s+(.+)$/);
    if (!match) return;

    const label = cleanText(match[1], 120).toLowerCase();
    const value = cleanText(match[2], 400);
    if (label && value && !labels[label]) labels[label] = value;
  });

  return labels;
}

function pickLabeledValue(labels, matcher) {
  for (const [label, value] of Object.entries(labels)) {
    if (matcher.test(label) && value) return value;
  }
  return '';
}

function extractPriceFromText(text) {
  const match = text.match(/\b(?:free|price[:\s]+\$?\d[\d,.]*(?:\.\d{2})?|cost[:\s]+\$?\d[\d,.]*(?:\.\d{2})?|tuition[:\s]+\$?\d[\d,.]*(?:\.\d{2})?|member price[:\s]+\$?\d[\d,.]*(?:\.\d{2})?|non-member price[:\s]+\$?\d[\d,.]*(?:\.\d{2})?|\$[\d,.]+(?:\.\d{2})?)\b/i);
  return match ? cleanText(match[0], 120) : '';
}

function extractCreditText(text) {
  const match = text.match(/\b\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*(?:ce\s*)?(?:credit|credits|hour|hours|ceu|ceus)\b/i);
  return match ? cleanText(match[0], 120) : '';
}

function inferFormat(...texts) {
  const haystack = texts.filter(Boolean).join(' ');
  for (const entry of FORMAT_PATTERNS) {
    if (entry.pattern.test(haystack)) return entry.value;
  }
  return '';
}

function inferCourseType(...texts) {
  const haystack = texts.filter(Boolean).join(' ');
  for (const entry of TYPE_PATTERNS) {
    if (entry.pattern.test(haystack)) return entry.value;
  }
  return '';
}

function buildTopic(title = '', tags = []) {
  if (tags.length > 0) return tags.slice(0, 6).join(' | ');
  return cleanText(title, 250);
}

function walkObjects(node, visitor) {
  if (!node) return;

  if (Array.isArray(node)) {
    for (const item of node) walkObjects(item, visitor);
    return;
  }

  if (typeof node === 'object') {
    visitor(node);
    for (const value of Object.values(node)) {
      if (typeof value === 'object') walkObjects(value, visitor);
    }
  }
}

function flattenCandidateValues(object) {
  return Object.entries(object)
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
    .map(([key, value]) => `${key}:${String(value)}`)
    .join(' ');
}

function pickUrlFromObject(object, baseUrl) {
  const urlKeys = ['url', 'href', 'path', 'slug', 'pageUrl', 'courseUrl', 'seoUrl', 'canonicalUrl', 'redirectText'];

  for (const key of urlKeys) {
    const value = object[key];
    if (typeof value !== 'string') continue;

    const full = safeUrl(value, baseUrl);
    if (full && !EXCLUDED_LINK_KEYWORDS.some((keyword) => full.toLowerCase().includes(keyword))) {
      return full;
    }
  }

  return '';
}

function toStringList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return unique(
      value
        .map((item) => {
          if (typeof item === 'string') return cleanText(item, 120);
          if (typeof item === 'object') return cleanText(item.name || item.title || item.label || '', 120);
          return '';
        })
        .filter(Boolean)
    );
  }

  return unique([cleanText(value, 120)].filter(Boolean));
}

function collectEmbeddedCourseObjects(nextData) {
  const courses = [];

  walkObjects(nextData, (object) => {
    const title = cleanText(object.title || object.name || object.headline, 250);
    const summary = cleanText(object.description || object.summary || object.excerpt, 600);
    const haystack = `${title} ${summary} ${flattenCandidateValues(object)}`.toLowerCase();
    const hasCourseSignals =
      'courseId' in object ||
      'courseNumber' in object ||
      'courseCategory' in object ||
      /\bce\b|\bcourse\b|\bcredit\b|\bwebinar\b|\bworkshop\b/.test(haystack);

    if (!title || !hasCourseSignals) return;
    if (/mission and goals|continuing education courses|view all courses/.test(title.toLowerCase())) return;

    courses.push(object);
  });

  return courses;
}

export function extractEmbeddedCourses($, { provider, providerUrl, pageUrl }) {
  const nextData = extractNextData($);
  if (!nextData) return [];

  const embeddedCourses = collectEmbeddedCourseObjects(nextData);
  const rows = [];
  const seen = new Set();

  for (const course of embeddedCourses) {
    const title = cleanText(course.title || course.name || course.headline, 250);
    const url = pickUrlFromObject(course, pageUrl) || pageUrl;
    const key = `${title}|${url}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const tags = unique([
      cleanText(course.courseCategory, 80),
      cleanText(course.category, 80),
      cleanText(course.specialty, 80),
      cleanText(course.topic, 80),
      ...toStringList(course.topics),
      ...toStringList(course.profession),
    ]);

    rows.push(normalizeCourse({
      provider,
      source_url: providerUrl,
      url,
      title,
      description: cleanMultiline(course.description || course.summary || course.excerpt || course.subTitle, 1600),
      course_type: cleanText(course.courseCategory || course.type, 120),
      format: inferFormat(
        course.deliveryMode,
        course.courseFormat,
        course.type,
        course.courseCategory,
        course.modality,
        course.webinarStartTime
      ),
      audience: cleanText(course.audience || course.intendedFor, 250),
      topic: buildTopic(title, tags),
      credits_text: cleanText(
        course.credits ||
        course.creditHours ||
        course.ceCredits ||
        course.credit ||
        course.contactHours ||
        course.hours,
        120
      ),
      price: cleanText(course.price || course.cost || course.memberPrice || course.nonMemberPrice || 'Free', 120),
      start_date: cleanText(course.startDate || course.webinarStartTime || course.onlineDate, 120),
      end_date: cleanText(course.endDate || course.webinarEndTime || course.expirationDate, 120),
      date_text: cleanText(course.webinarStartTime || course.onlineDate || '', 250),
      location: cleanText(course.location || course.venue || '', 250),
      instructors: unique([
        cleanText(course.author || course.instructor || course.presenter || course.faculty, 300),
        ...toStringList(course.authors),
      ]).join('\n'),
      tags,
      metadata: {
        extracted_from: 'next-data',
        embedded_keys: Object.keys(course).slice(0, 30),
        page_type: nextData?.props?.pageProps?.pageType || '',
      },
    }));
  }

  return rows.filter(isLikelyCoursePage);
}

function findDateValues(jsonLdNodes, bodyLines, labels) {
  const start = pickFirst(
    ...jsonLdNodes.map((node) => node.startDate),
    labels.start_date || ''
  );
  const end = pickFirst(
    ...jsonLdNodes.map((node) => node.endDate),
    labels.end_date || ''
  );
  const labelDate = pickLabeledValue(labels, LABEL_PATTERNS.date_text);
  const bodyDate = bodyLines.find((line) => LABEL_PATTERNS.date_text.test(line) || /\b20\d{2}\b/.test(line)) || '';

  return {
    start_date: start,
    end_date: end,
    date_text: pickFirst(labelDate, bodyDate),
  };
}

function findLocationValues(jsonLdNodes, labels, bodyLines) {
  const locationNode = jsonLdNodes.find((node) => node.location || node.eventAttendanceMode || node.address);
  const locationCandidate = locationNode?.location || locationNode?.address || null;

  const location = pickFirst(
    textFromJsonLdEntity(locationCandidate),
    locationCandidate?.addressLocality,
    pickLabeledValue(labels, LABEL_PATTERNS.location),
    bodyLines.find((line) => /\b(location|venue|address)\b/i.test(line)) || ''
  );

  return {
    location,
    city: cleanText(locationCandidate?.addressLocality, 120),
    state: cleanText(locationCandidate?.addressRegion, 120),
    country: cleanText(locationCandidate?.addressCountry, 120),
  };
}

function findTags($, title) {
  const candidates = unique([
    ...$('meta[property="article:tag"]').map((_, el) => cleanText($(el).attr('content'), 60)).get(),
    ...$('.tag, .tags a, .topic, .topics a, .breadcrumb a')
      .map((_, el) => cleanText($(el).text(), 60))
      .get(),
  ]);

  return candidates.filter((tag) => tag && tag.toLowerCase() !== title.toLowerCase()).slice(0, 12);
}

function normalizeFromJsonLd(jsonLdNodes) {
  const courseNode = jsonLdNodes.find((node) => {
    const type = String(node['@type'] || '').toLowerCase();
    return ['course', 'educationalevent', 'event', 'product'].includes(type);
  });

  if (!courseNode) return {};

  const offer = Array.isArray(courseNode.offers) ? courseNode.offers[0] : courseNode.offers;

  return {
    title: pickFirst(courseNode.name, courseNode.headline),
    description: cleanMultiline(courseNode.description, 2000),
    url: cleanText(courseNode.url, 500),
    instructors: unique([
      textFromJsonLdEntity(courseNode.instructor),
      textFromJsonLdEntity(courseNode.teacher),
      textFromJsonLdEntity(courseNode.performer),
      textFromJsonLdEntity(courseNode.organizer),
    ]).join('\n'),
    credits_text: pickFirst(
      courseNode.timeRequired,
      courseNode.numberOfCredits,
      courseNode.educationalCredentialAwarded
    ),
    price: pickFirst(offer?.price, offer?.name),
    price_amount: cleanText(offer?.price, 60),
    currency: cleanText(offer?.priceCurrency, 12),
    start_date: cleanText(courseNode.startDate, 120),
    end_date: cleanText(courseNode.endDate, 120),
    location: textFromJsonLdEntity(courseNode.location),
    format: cleanText(courseNode.courseMode, 120),
    audience: cleanText(courseNode.audience?.audienceType || courseNode.audience?.name, 250),
    accreditation: cleanText(courseNode.provider?.name || courseNode.educationalCredentialAwarded, 300),
  };
}

export function extractCourseDataFromPage($, { provider, providerUrl, pageUrl }) {
  const jsonLdNodes = extractJsonLd($);
  const nextData = extractNextData($);
  const labels = extractLabeledValues($);
  const bodyLines = getBodyLines($);
  const jsonLdData = normalizeFromJsonLd(jsonLdNodes);

  const title = pickFirst(
    jsonLdData.title,
    findFirstText($, ['h1', 'main h1', 'article h1', '.page-title', '.course-title'], 250),
    findMetaContent($, 'meta[property="og:title"]'),
    cleanText($('title').first().text(), 250)
  );

  const description = pickFirst(
    jsonLdData.description,
    findMetaContent($, 'meta[name="description"]'),
    findMetaContent($, 'meta[property="og:description"]'),
    findFirstText($, ['main p', 'article p', '.course-description', '.description', '.summary'], 2000)
  );

  const tags = findTags($, title);
  const dateValues = findDateValues(jsonLdNodes, bodyLines, labels);
  const locationValues = findLocationValues(jsonLdNodes, labels, bodyLines);

  const creditsText = pickFirst(
    jsonLdData.credits_text,
    pickLabeledValue(labels, LABEL_PATTERNS.credits_text),
    extractCreditText(bodyLines.join(' ')),
    bodyLines.find((line) => LABEL_PATTERNS.credits_text.test(line)) || ''
  );

  const price = pickFirst(
    jsonLdData.price,
    pickLabeledValue(labels, LABEL_PATTERNS.price),
    extractPriceFromText(bodyLines.join(' ')),
    bodyLines.find((line) => LABEL_PATTERNS.price.test(line)) || ''
  );

  const format = pickFirst(
    jsonLdData.format,
    pickLabeledValue(labels, /(format|delivery|modality)/i),
    inferFormat(title, description, price, dateValues.date_text, pageUrl)
  );

  const courseType = pickFirst(
    pickLabeledValue(labels, /(course type|type|format)/i),
    inferCourseType(title, description, format, pageUrl)
  );

  const instructors = pickFirst(
    jsonLdData.instructors,
    pickLabeledValue(labels, LABEL_PATTERNS.instructors),
    bodyLines.find((line) => LABEL_PATTERNS.instructors.test(line)) || ''
  );

  const accreditation = pickFirst(
    jsonLdData.accreditation,
    pickLabeledValue(labels, LABEL_PATTERNS.accreditation),
    bodyLines.find((line) => LABEL_PATTERNS.accreditation.test(line)) || ''
  );

  const audience = pickFirst(
    jsonLdData.audience,
    pickLabeledValue(labels, LABEL_PATTERNS.audience)
  );

  const requirements = pickFirst(
    pickLabeledValue(labels, LABEL_PATTERNS.requirements),
    bodyLines.find((line) => LABEL_PATTERNS.requirements.test(line)) || ''
  );

  const registrationDeadline = pickFirst(
    pickLabeledValue(labels, LABEL_PATTERNS.registration_deadline)
  );

  return normalizeCourse({
    provider,
    source_url: providerUrl,
    url: pickFirst(jsonLdData.url, pageUrl),
    title,
    description,
    course_type: courseType,
    format,
    audience,
    topic: buildTopic(title, tags),
    credits_text: creditsText,
    price,
    price_amount: jsonLdData.price_amount,
    currency: jsonLdData.currency,
    start_date: dateValues.start_date,
    end_date: dateValues.end_date,
    date_text: dateValues.date_text,
    location: pickFirst(jsonLdData.location, locationValues.location),
    city: locationValues.city,
    state: locationValues.state,
    country: locationValues.country,
    instructors,
    accreditation,
    registration_deadline: registrationDeadline,
    requirements,
    tags,
    metadata: {
      json_ld_types: unique(jsonLdNodes.map((node) => cleanText(node['@type'], 80)).filter(Boolean)),
      extracted_labels: Object.keys(labels).slice(0, 20),
      page_type: nextData?.props?.pageProps?.pageType || '',
      page_url: pageUrl,
    },
  });
}

function scoreCourseLink(url, text) {
  const haystack = `${url} ${text}`.toLowerCase();
  let score = 0;

  for (const keyword of COURSE_KEYWORDS) {
    if (haystack.includes(keyword)) score += 1;
  }

  if (/\/course\/|\/courses\/|\/webinar\/|\/workshop\/|\/training\/|\/ce\//.test(url.toLowerCase())) score += 2;
  if (/register|catalog|search|listing/.test(url.toLowerCase())) score -= 1;
  if (text && text.length > 10) score += 1;

  return score;
}

export function extractRelevantLinks($, baseUrl) {
  const baseHostname = new URL(baseUrl).hostname;
  const links = new Map();

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    const text = cleanText($(element).text(), 160);
    const full = safeUrl(href, baseUrl);
    if (!full) return;

    const parsed = new URL(full);
    if (parsed.hostname !== baseHostname) return;
    if (parsed.hash) parsed.hash = '';

    const lower = parsed.href.toLowerCase();
    if (EXCLUDED_LINK_KEYWORDS.some((keyword) => lower.includes(keyword))) return;

    const score = scoreCourseLink(parsed.href, text);
    if (score < 2) return;

    const existing = links.get(parsed.href);
    if (!existing || score > existing.score) {
      links.set(parsed.href, { score, text });
    }
  });

  return [...links.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .map(([url]) => url);
}

export function isLikelyCoursePage(row) {
  const scoreParts = [
    row.title,
    row.description,
    row.course_type,
    row.format,
    row.credits_text,
    row.price,
    row.date_text,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let score = 0;
  if (row.title) score += 1;
  if (row.description) score += 1;
  if (row.credits_text) score += 2;
  if (row.price) score += 1;
  if (row.date_text || row.start_date || row.end_date) score += 1;
  if (row.format) score += 1;
  if (row.course_type) score += 1;
  if (/course|webinar|workshop|seminar|training|event|on-demand|live/.test(scoreParts)) score += 2;
  if (row.metadata?.page_type === 'COURSE_LISTING_PAGE') score -= 3;

  const titleLower = (row.title || '').toLowerCase();
  const urlLower = (row.url || '').toLowerCase();
  if (EXCLUDED_LINK_KEYWORDS.some((keyword) => titleLower.includes(keyword))) score -= 3;
  if (/subscribe|catalog|mission and goals|overview|continuing education$/.test(titleLower)) score -= 2;
  if (row.url && row.source_url && row.url === row.source_url && !row.credits_text && !row.instructors && !row.start_date) score -= 2;
  if (/\/continuing-education\/?$|\/ce-courses\/?$|\/ada-ce-live-workshops\/?$|\/ada-ce-live-webinars\/?$|\/ada-ce-live-courses\/?$|\/ada-ce-on-demand\/?$|\/ce-online-courses\/?$/.test(urlLower)) score -= 4;
  if (/continuing education courses|live workshops and seminars|subscribe to ada ce/.test(titleLower)) score -= 4;

  return score >= 4;
}
