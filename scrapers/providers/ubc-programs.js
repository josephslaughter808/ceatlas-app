import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const UBC_ROOT_URL = 'https://www.dentistry.ubc.ca/cde/';
const UBC_ONLINE_URL = 'https://www.dentistry.ubc.ca/cde/online-learning/';
const UBC_TRAVEL_URL = 'https://www.dentistry.ubc.ca/cde/travel-and-learn/';

function cleanText(value = '', max = 700) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = UBC_ROOT_URL) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function providerName(title = '') {
  return title.startsWith('UBC ') ? title : `UBC ${title}`;
}

function inferTopic(text = '') {
  const value = cleanText(text, 400).toLowerCase();
  if (/orthodont/.test(value)) return 'Orthodontics';
  if (/sleep|apnea|airway/.test(value)) return 'Sleep & Airway';
  if (/implant/.test(value)) return 'Implants';
  if (/management|staff|systems/.test(value)) return 'Practice Management & Business';
  if (/anaesthesia|anesthesia|hygienist/.test(value)) return 'Dental Hygiene';
  if (/emergency|opioid|oral pathology|lump/.test(value)) return 'General Dentistry';
  if (/geriatric/.test(value)) return 'Geriatric Dentistry';
  return 'General Dentistry';
}

function inferFormat(text = '') {
  const value = cleanText(text, 400).toLowerCase();
  if (/online|webinar|self-paced|pre-recorded/.test(value)) return 'Online';
  if (/travel|ski|hawaii|maui|big island|whistler/.test(value)) return 'Travel';
  return 'In Person';
}

function inferCourseType(text = '') {
  const value = cleanText(text, 400).toLowerCase();
  if (/study club/.test(value)) return 'Study Club Program';
  if (/travel/.test(value)) return 'Travel Program';
  if (/course calendar|online learning/.test(value)) return 'Course Catalog';
  return 'CE Program';
}

export async function scrapeUBCPrograms() {
  console.log('   • Scraping UBC program-level providers');

  const rows = [];
  const seen = new Set();

  const [$root, $online, $travel] = await Promise.all([
    loadHTML(UBC_ROOT_URL),
    loadHTML(UBC_ONLINE_URL),
    loadHTML(UBC_TRAVEL_URL),
  ]);

  $root('.research-item').each((_, element) => {
    const item = $root(element);
    const title = cleanText(item.find('.research-title').first().text(), 240);
    const description = cleanText(item.find('.research-excerpt').first().text(), 900);
    const url = absoluteUrl(item.find('.research-title, .research-link').first().attr('href') || '', UBC_ROOT_URL);

    if (!title || !description || !url || /contact cde/i.test(title)) return;

    const provider = providerName(title);
    const key = `${provider}||${title}||${url}`;
    if (seen.has(key)) return;
    seen.add(key);

    rows.push(normalizeCourse({
      provider,
      provider_slug: provider.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      source_url: UBC_ROOT_URL,
      url,
      title,
      description,
      course_type: inferCourseType(`${title} ${description}`),
      format: inferFormat(`${title} ${description}`),
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${title} ${description}`),
      location: /travel/i.test(title) ? 'Travel destination' : 'UBC Faculty of Dentistry',
      accreditation: 'UBC Continuing Dental Education',
      tags: ['UBC', inferTopic(title), inferFormat(title)].filter(Boolean),
      metadata: {
        extracted_from: 'ubc-program-cards',
      },
    }));
  });

  $travel('a[href*="/cde/travel-and-learn/"]').each((_, element) => {
    const anchor = $travel(element);
    const href = absoluteUrl(anchor.attr('href') || '', UBC_TRAVEL_URL);
    const title = cleanText(anchor.text(), 240);

    if (!href || !title || /travel and learn$/i.test(title)) return;

    const provider = providerName(title);
    const key = `${provider}||${href}`;
    if (seen.has(key)) return;
    seen.add(key);

    rows.push(normalizeCourse({
      provider,
      provider_slug: provider.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      source_url: UBC_TRAVEL_URL,
      url: href,
      title,
      description: `${title} is part of the UBC Continuing Dental Education travel-and-learn lineup.`,
      course_type: 'Travel Program',
      format: 'Travel',
      audience: 'Dentists and Dental Team',
      topic: 'General Dentistry',
      location: 'Travel destination',
      accreditation: 'UBC Continuing Dental Education',
      tags: ['UBC', 'Travel'].filter(Boolean),
      metadata: {
        extracted_from: 'ubc-travel-links',
      },
    }));
  });

  $online('a[href*="courses.cpe.ubc.ca"]').each((_, element) => {
    const anchor = $online(element);
    const href = absoluteUrl(anchor.attr('href') || '', UBC_ONLINE_URL);
    const wrapper = anchor.closest('p');
    const description = cleanText(wrapper.prev('p').text(), 1200);
    const pricing = cleanText(wrapper.prevAll('p').eq(1).text(), 200);
    const heading = wrapper.prevAll('p').eq(2);
    const title = cleanText(heading.text(), 240)
      .replace(/\bwith Dr\..*$/i, '')
      .replace(/\bwith [A-Z].*$/i, '')
      .trim();

    if (!href || !title || !description) return;

    const provider = 'UBC Online Learning';
    const key = `${provider}||${title}||${href}`;
    if (seen.has(key)) return;
    seen.add(key);

    rows.push(normalizeCourse({
      provider,
      provider_slug: 'ubc-online-learning',
      source_url: UBC_ONLINE_URL,
      url: href,
      title,
      description,
      course_type: 'Online Course',
      format: 'Online',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${title} ${description}`),
      price: pricing,
      location: 'Online',
      accreditation: 'UBC Continuing Dental Education',
      tags: ['UBC', 'Online', inferTopic(title)].filter(Boolean),
      metadata: {
        extracted_from: 'ubc-online-learning',
        price_text: pricing,
      },
    }));
  });

  console.log(`   • Extracted ${rows.length} UBC program-level rows`);
  return rows;
}
