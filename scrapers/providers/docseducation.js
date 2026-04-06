import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const DOCS_PROVIDER = 'DOCS Education';
const DOCS_PROVIDER_SLUG = 'docs-education';
const DOCS_SOURCE_URL = 'https://www.docseducation.com/search-course';
const DOCS_BASE_URL = 'https://www.docseducation.com';
const DEFAULT_MAX_PAGE_INDEX = 32;

function cleanText(value = '', max = 500) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanMultiline(value = '', max = 2000) {
  return String(value)
    .replace(/\r/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = DOCS_BASE_URL) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function parseIsoDate(text = '') {
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function parseDateRange(dateText = '') {
  const text = cleanText(dateText, 120);
  if (!text) {
    return { start_date: '', end_date: '', date_text: '' };
  }

  const monthRangeMatch = text.match(/^([A-Za-z]{3,9})\s+(\d{1,2})-(\d{1,2}),\s*(\d{4})$/);
  if (monthRangeMatch) {
    const [, month, startDay, endDay, year] = monthRangeMatch;
    return {
      start_date: parseIsoDate(`${month} ${startDay}, ${year}`),
      end_date: parseIsoDate(`${month} ${endDay}, ${year}`),
      date_text: text,
    };
  }

  const singleMatch = text.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})$/);
  if (singleMatch) {
    const [, month, day, year] = singleMatch;
    const iso = parseIsoDate(`${month} ${day}, ${year}`);
    return {
      start_date: iso,
      end_date: iso,
      date_text: text,
    };
  }

  return { start_date: '', end_date: '', date_text: text };
}

function parseLocationLine(line = '') {
  const text = cleanText(line, 160);
  if (!text) {
    return {
      location: '',
      city: '',
      state: '',
      country: '',
      format: '',
      start_date: '',
      end_date: '',
      date_text: '',
    };
  }

  const stateOnlyMatch = text.match(/^([A-Z]{2})\s+([A-Za-z]{3,9}\s+\d{1,2}(?:-\d{1,2})?,\s*\d{4})$/);
  if (stateOnlyMatch) {
    const [, state, dateText] = stateOnlyMatch;
    return {
      location: state,
      city: '',
      state,
      country: 'USA',
      format: 'Live',
      ...parseDateRange(dateText),
    };
  }

  const [rawLocation = '', rawDate = ''] = text.split(/\s+-\s+/, 2);
  const locationLabel = cleanText(rawLocation, 120);
  const dateBits = parseDateRange(rawDate);

  if (/stream/i.test(locationLabel)) {
    return {
      location: locationLabel,
      city: '',
      state: '',
      country: '',
      format: 'Live Streaming',
      ...dateBits,
    };
  }

  const geoMatch = locationLabel.match(/^(.+?),\s*([A-Z]{2})$/);
  return {
    location: locationLabel,
    city: geoMatch ? cleanText(geoMatch[1], 80) : '',
    state: geoMatch ? cleanText(geoMatch[2], 10) : '',
    country: geoMatch ? 'USA' : '',
    format: 'Live',
    ...dateBits,
  };
}

function parseDetailLocationBox(item = {}) {
  const title = cleanText(item.title, 120).replace(/\s+/g, ' ').trim();
  const state = cleanText(item.state, 80);
  const dateBits = parseDateRange(item.dateText);
  const location = [title, state].filter(Boolean).join(', ');
  const geoMatch = location.match(/^(.+?),\s*([A-Z]{2})$/);

  if (/stream/i.test(title) || /stream/i.test(state)) {
    return {
      location: cleanText([title, state].filter(Boolean).join(' '), 120) || 'Live Streaming',
      city: '',
      state: '',
      country: '',
      format: 'Live Streaming',
      ...dateBits,
    };
  }

  return {
    location: location || state || title || 'See course page',
    city: geoMatch ? cleanText(geoMatch[1], 80) : '',
    state: geoMatch ? cleanText(geoMatch[2], 10) : (state.length === 2 ? state : ''),
    country: geoMatch || state.length === 2 ? 'USA' : '',
    format: 'Live',
    ...dateBits,
  };
}

function parseLocationHint(item = {}) {
  const title = cleanText(item.title, 120);
  const state = cleanText(item.state, 80);
  const cityMatch = title.match(/\bin\s+(.+)$/i);
  const city = cityMatch ? cleanText(cityMatch[1], 80) : '';
  return [city || title, state].filter(Boolean).join(', ');
}

function inferTopic(title = '', description = '') {
  const text = `${cleanText(title, 250)} ${cleanText(description, 500)}`.toLowerCase();
  if (/iv sedation|intravenous/.test(text)) return 'IV Sedation';
  if (/oral sedation/.test(text)) return 'Oral Sedation';
  if (/nitrous/.test(text)) return 'Nitrous Oxide';
  if (/emergency|acls|pals|bcls/.test(text)) return 'Emergency Training';
  if (/pediatric/.test(text)) return 'Pediatrics';
  if (/patient management/.test(text)) return 'Patient Management';
  if (/team/.test(text)) return 'Team Training';
  if (/regulation|permit|compliance|recertification/.test(text)) return 'Regulatory';
  return 'Clinical Dentistry';
}

function inferAudience(title = '', description = '') {
  const text = `${cleanText(title, 250)} ${cleanText(description, 500)}`.toLowerCase();
  if (/hygienist|assistant|team member/.test(text)) return 'Dentists and Dental Team';
  return 'Dentists';
}

function unique(list = []) {
  return [...new Set(list.filter(Boolean))];
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      const value = await mapper(items[currentIndex], currentIndex);
      if (value) results.push(value);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function parseLastPageIndex($) {
  const href = $('.pager__item--last a[href*="page="]').attr('href') || '';
  const match = href.match(/page=(\d+)/);
  return match ? Number(match[1]) : DEFAULT_MAX_PAGE_INDEX;
}

function parseListingRows($, pageUrl) {
  return $('.view-content .views-row .course-listing-content-row')
    .map((_, element) => {
      const card = $(element);
      const title = cleanText(card.find('.course-list-title a').first().text(), 250);
      const href = card.find('.course-list-title a').first().attr('href') || '';
      const description = cleanMultiline(card.find('.col-md-6').last().text(), 2000)
        .replace(/\bMore info\b/gi, '')
        .replace(/\bLess\b/gi, '')
        .replace(/\bView Course\b/gi, '')
        .trim();
      const eventLines = card.find('.event-des p').map((__, p) => cleanText($(p).text(), 120)).get();
      const delivery = card.find('.field--name-field-delivery .field--item').map((__, item) => cleanText($(item).text(), 120)).get();
      const creditsMatch = description.match(/(\d+(?:\.\d+)?)\s*CE hours?/i);
      const creditsText = creditsMatch ? `${creditsMatch[1]} CE hours` : '';

      if (!title || !href) return null;

      return {
        pageUrl,
        title,
        detailUrl: absoluteUrl(href),
        description,
        creditsText,
        delivery: unique(delivery),
        eventLines: unique(eventLines),
      };
    })
    .get()
    .filter(Boolean);
}

async function fetchCourseDetails(detailUrl) {
  try {
    const $ = await loadHTML(detailUrl);
    const faculty = unique(
      $('#fc-mod .views-field-title')
        .map((_, el) => cleanText($(el).text(), 160).replace(/^[^A-Za-z]+/, '').trim())
        .get(),
    ).filter((name) => /[A-Za-z]/.test(name) && !/^[A-Z]{2,5}$/.test(name));

    const locationBoxes = $('.locations-wrapper .location-box')
      .map((_, box) => {
        const node = $(box);
        const title = cleanText(node.find('.views-field-title').first().text(), 120);
        const state = cleanText(node.find('.views-field-field-state').first().text(), 80);
        const dateText = cleanText(node.find('.views-field-nothing').first().text(), 120);

        return { title, state, dateText };
      })
      .get()
      .filter((item) => item.title || item.state || item.dateText);

    return {
      faculty,
      locationBoxes,
      locationHints: unique(locationBoxes.map((item) => parseLocationHint(item))),
    };
  } catch (error) {
    console.log(`      ⚠️ Failed to load DOCS detail ${detailUrl}: ${error.message}`);
    return {
      faculty: [],
      locationBoxes: [],
      locationHints: [],
    };
  }
}

function buildCourseRows(course, details) {
  const faculty = unique(details.faculty).join('\n');
  const detailSessions = details.locationBoxes
    .map((item) => {
      if (!item.title && !item.state && !item.dateText) return null;
      const parsed = parseDetailLocationBox(item);
      const year = parsed.start_date ? Number(parsed.start_date.slice(0, 4)) : 0;
      if (year && year < new Date().getFullYear()) return null;
      return {
        ...parsed,
        source: 'detail',
      };
    })
    .filter(Boolean);

  const listingSessions = course.eventLines.map((line) => ({
    ...parseLocationLine(line),
    source: 'listing',
  }));

  const sessions = listingSessions.length ? listingSessions : detailSessions;
  const topic = inferTopic(course.title, course.description);
  const audience = inferAudience(course.title, course.description);

  if (!sessions.length) {
    const isHomeStudy = course.delivery.some((item) => /home study/i.test(item));
    const isStreaming = course.delivery.some((item) => /stream/i.test(item));

    return [
      normalizeCourse({
        provider: DOCS_PROVIDER,
        provider_slug: DOCS_PROVIDER_SLUG,
        source_url: course.pageUrl,
        url: course.detailUrl,
        title: course.title,
        description: course.description,
        course_type: isHomeStudy ? 'Home Study Course' : 'Continuing Education Course',
        format: isHomeStudy ? 'Online' : (isStreaming ? 'Live Streaming' : 'Live'),
        audience,
        topic,
        credits_text: course.creditsText,
        location: isHomeStudy ? 'Online' : cleanMultiline(details.locationHints.join(' | '), 200),
        instructors: faculty,
        accreditation: 'DOCS Education',
        tags: unique(['DOCS Education', topic, ...course.delivery]),
        metadata: {
          extracted_from: 'docseducation-listing',
          detail_url: course.detailUrl,
          delivery: course.delivery,
        },
      }),
    ];
  }

  return sessions.map((session, index) => normalizeCourse({
    provider: DOCS_PROVIDER,
    provider_slug: DOCS_PROVIDER_SLUG,
    source_url: course.pageUrl,
    url: `${course.detailUrl}#session-${index + 1}`,
    title: course.title,
    description: course.description,
    course_type: /recertification|compliance|permit/i.test(course.title) ? 'Certification Course' : 'Continuing Education Course',
    format: session.format || (course.delivery.some((item) => /stream/i.test(item)) ? 'Live Streaming' : 'Live'),
    audience,
    topic,
    credits_text: course.creditsText,
    start_date: session.start_date,
    end_date: session.end_date,
    date_text: session.date_text || course.eventLines.join('\n'),
    location: session.location,
    city: session.city,
    state: session.state,
    country: session.country,
    instructors: faculty,
    accreditation: 'DOCS Education',
    tags: unique(['DOCS Education', topic, ...course.delivery]),
    metadata: {
      extracted_from: 'docseducation-listing',
      detail_url: course.detailUrl,
      delivery: course.delivery,
      session_source: session.source,
    },
  }));
}

export async function scrapeDOCSEducation(startUrl = DOCS_SOURCE_URL) {
  console.log('   • Scraping DOCS Education public catalog');

  const $firstPage = await loadHTML(startUrl);
  const maxPageIndex = parseLastPageIndex($firstPage);
  const listingTargets = parseListingRows($firstPage, startUrl);

  for (let pageIndex = 1; pageIndex <= maxPageIndex; pageIndex += 1) {
    const pageUrl = `${startUrl}?page=${pageIndex}`;

    try {
      const $page = await loadHTML(pageUrl);
      const rows = parseListingRows($page, pageUrl);
      if (!rows.length) break;
      listingTargets.push(...rows);
    } catch (error) {
      console.log(`      ⚠️ Failed to load DOCS listing ${pageUrl}: ${error.message}`);
      break;
    }
  }

  const seen = new Set();
  const dedupedTargets = listingTargets.filter((item) => {
    const key = `${item.detailUrl}||${item.eventLines.join('|')}||${item.delivery.join('|')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const rows = await mapWithConcurrency(dedupedTargets, 4, async (course) => {
    const details = await fetchCourseDetails(course.detailUrl);
    return buildCourseRows(course, details);
  });

  const flattened = rows.flat().filter(Boolean);
  console.log(`   • Extracted ${flattened.length} DOCS Education rows`);
  return flattened;
}
