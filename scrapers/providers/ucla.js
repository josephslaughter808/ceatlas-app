import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const UCLA_PROVIDER = 'UCLA Dental CE';
const UCLA_PROVIDER_SLUG = 'ucla-dental-ce';
const UCLA_COURSES_URL = 'https://dentistry.ucla.edu/academics-admissions/continuing-dental-education/courses';
const UCLA_ON_DEMAND_URL = 'https://dentistry.ucla.edu/academics-admissions/continuing-dental-education/on-demand-self-study-recorded-videos';

function cleanText(value = '', max = 1800) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanMultiline(value = '', max = 2200) {
  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = UCLA_COURSES_URL) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function inferTopic(text = '') {
  const value = cleanText(text, 500).toLowerCase();
  if (/sleep|orofacial pain/.test(value)) return 'Sleep & Airway';
  if (/california practice act|prescribing|opioid|mate act/.test(value)) return 'Regulatory / Risk Management';
  if (/infection control/.test(value)) return 'Infection Control';
  if (/photography/.test(value)) return 'Digital Dentistry & Technology';
  if (/restorative|bonding|composite/.test(value)) return 'Restorative Dentistry';
  if (/oral medicine|cardiovascular|endocrine|pulmonary/.test(value)) return 'Oral Medicine';
  if (/resilience|wellness/.test(value)) return 'Practice Management & Business';
  return 'General Dentistry';
}

function inferFormat(text = '') {
  const value = cleanText(text, 400).toLowerCase();
  if (/on-demand|self-study|recorded|online/.test(value)) return 'Online';
  if (/hawaii|symposium/.test(value)) return 'Conference / Symposium';
  return /in person/i.test(value) ? 'In Person' : 'In Person';
}

function inferCourseType(text = '') {
  const value = cleanText(text, 400).toLowerCase();
  if (/on-demand|self-study|recorded|online/.test(value)) return 'Online Course';
  if (/symposium/.test(value)) return 'Conference / Symposium';
  if (/hands-on/.test(value)) return 'Hands-On Course';
  return 'Live Course';
}

function extractCredits(text = '') {
  const match = text.match(/CDE Credits:\s*([\d.]+)/i);
  return match ? match[1] : '';
}

function extractPrice(text = '') {
  const match = text.match(/Course Fee:\s*([^\n]+)/i);
  return match ? cleanText(match[1], 140) : '';
}

function extractDateText(text = '') {
  const match = text.match(/[A-Z][a-z]{2},\s+\d{2}\/\d{2}\/\d{4}\s+-\s+\d{2}:\d{2}[\s\S]{0,60}?\d{2}\/\d{2}\/\d{4}\s+-\s+\d{2}:\d{2}/);
  return match ? cleanText(match[0], 180) : '';
}

function extractDescription($) {
  const parts = [];
  $('.field--name-body p').each((_, p) => {
    const text = cleanText($(p).text(), 400);
    if (!text) return;
    if (/course fee|cde credits|policies|ada cerp/i.test(text)) return;
    parts.push(text);
  });
  return parts.slice(0, 4).join(' ').slice(0, 1800);
}

function extractInstructors($) {
  const heading = $('h4').filter((_, el) => /instructors?/i.test($(el).text())).first();
  if (!heading.length) return '';

  const parts = [];
  let node = heading.next();
  while (node.length && !/^h[34]$/i.test(node[0].tagName || '')) {
    const text = cleanText(node.text(), 240);
    if (text && !/subject to change|policies|ada cerp/i.test(text)) {
      parts.push(text);
    }
    node = node.next();
  }

  return parts.join('\n');
}

function extractEventUrls(html = '') {
  const matches = html.match(/"url":"\\\/events\\\/[^"]+"/g) || [];
  const urls = matches
    .map((match) => match.replace(/^"url":"\\\//, '').replace(/"$/, '').replace(/\\\//g, '/'))
    .map((path) => absoluteUrl(`/${path}`))
    .filter(Boolean);

  return [...new Set(urls)];
}

function collectOnDemandRows($) {
  const rows = [];
  $('a[href]').each((_, link) => {
    const node = $(link);
    const href = node.attr('href') || '';
    if (!/learningstream\.com\/reg\/event_page|\/events\//i.test(href)) return;

    const title = cleanText(node.text(), 250);
    const url = absoluteUrl(href, UCLA_ON_DEMAND_URL);
    if (!title || !url) return;
    if (/login|policies|registration and directions/i.test(title)) return;

    rows.push(normalizeCourse({
      provider: UCLA_PROVIDER,
      provider_slug: UCLA_PROVIDER_SLUG,
      source_url: UCLA_ON_DEMAND_URL,
      url,
      title,
      description: `${title} is listed in UCLA Continuing Dental Education's on-demand self-study catalog.`,
      course_type: 'Online Course',
      format: 'Online',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(title),
      location: 'Online',
      city: 'Los Angeles',
      state: 'CA',
      country: 'USA',
      accreditation: 'UCLA Continuing Dental Education',
      tags: ['UCLA', 'Online', inferTopic(title)].filter(Boolean),
      metadata: {
        extracted_from: 'ucla-on-demand-page',
      },
    }));
  });

  return rows;
}

export async function scrapeUCLA() {
  console.log('   • Scraping UCLA Dental CE');

  const [coursesPage, onDemandPage] = await Promise.all([
    loadHTML(UCLA_COURSES_URL),
    loadHTML(UCLA_ON_DEMAND_URL),
  ]);

  const rows = collectOnDemandRows(onDemandPage);
  const seenUrls = new Set(rows.map((row) => row.url));

  coursesPage('a.title__link[href^="/events/"]').each((_, link) => {
    const url = absoluteUrl(coursesPage(link).attr('href') || '', UCLA_COURSES_URL);
    if (url) seenUrls.add(url);
  });

  for (const url of extractEventUrls(coursesPage.html())) {
    seenUrls.add(url);
  }

  const detailUrls = [...seenUrls]
    .filter((url) => url.includes('/events/'))
    .filter((url) => !url.endsWith('/events/ce-on-demand-and-self-study-courses'));

  for (const url of detailUrls) {
    const $ = await loadHTML(url);
    const title = cleanText($('.event__title').first().text(), 250);
    if (!title) continue;

    const bodyHtml = $('.field--name-body').html() || '';
    const bodyText = cleanMultiline(bodyHtml, 4500);
    const description = extractDescription($) || cleanText(bodyText, 1800);
    const price = extractPrice(bodyText);
    const credits = extractCredits(bodyText);
    const instructors = extractInstructors($);
    const dateText = extractDateText(bodyText);
    const location = cleanText($('.event__organization-name').first().text(), 200)
      || cleanText($('.event__address').first().text(), 200)
      || 'UCLA School of Dentistry';

    rows.push(normalizeCourse({
      provider: UCLA_PROVIDER,
      provider_slug: UCLA_PROVIDER_SLUG,
      source_url: UCLA_COURSES_URL,
      url,
      title,
      description,
      course_type: inferCourseType(`${title} ${description}`),
      format: inferFormat(`${title} ${description}`),
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${title} ${description}`),
      credits,
      credits_text: credits ? `${credits} credits` : '',
      price,
      date_text: dateText,
      location,
      city: 'Los Angeles',
      state: 'CA',
      country: 'USA',
      instructors,
      accreditation: 'UCLA Continuing Dental Education',
      tags: ['UCLA', inferTopic(title), inferFormat(title)].filter(Boolean),
      metadata: {
        extracted_from: 'ucla-event-page',
      },
    }));
  }

  const deduped = [];
  const finalSeen = new Set();
  for (const row of rows) {
    const key = `${row.title}::${row.url}`;
    if (!row.title || !row.url || finalSeen.has(key)) continue;
    finalSeen.add(key);
    deduped.push(row);
  }

  console.log(`   • Extracted ${deduped.length} UCLA Dental CE rows`);
  return deduped;
}
