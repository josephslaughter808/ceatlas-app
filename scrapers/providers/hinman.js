import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const HINMAN_PROVIDER = 'Hinman';
const HINMAN_PROVIDER_SLUG = 'hinman';
const HINMAN_BASE_URL = 'https://www.hinman.org';
const HINMAN_COURSES_URL = 'https://www.hinman.org/Education-Events/Courses';

function cleanText(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteUrl(value = '') {
  if (!value) return '';
  try {
    return new URL(value, HINMAN_BASE_URL).href;
  } catch {
    return '';
  }
}

function parseDate(value = '') {
  const match = cleanText(value).match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/);
  if (!match) return '';

  const [month, day, year] = match[0].split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseTitle(value = '') {
  return cleanText(value, 250).replace(/\s*-\s*Course\s*#.*$/i, '').trim();
}

export async function scrapeHinman(startUrl = HINMAN_COURSES_URL) {
  console.log('   • Scraping Hinman public course catalog');

  const $ = await loadHTML(startUrl);
  const results = [];
  const seenUrls = new Set();

  $('a.course').each((_, element) => {
    const anchor = $(element);
    const url = absoluteUrl(anchor.attr('href') || '');
    const title = parseTitle(anchor.text());
    if (!url || !title || seenUrls.has(url)) return;

    const container = anchor.parent();
    const blockText = cleanText(container.text(), 1600);
    const keywords = container.find('.keyword')
      .map((__, div) => cleanText($(div).text(), 80))
      .get()
      .filter(Boolean);
    const speakerNames = container.find('a.speaker')
      .map((__, speaker) => cleanText($(speaker).text(), 120))
      .get()
      .filter(Boolean)
      .join('\n');
    const dateLine = cleanText((blockText.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b.*?(?=Speaker\(s\):|Keyword\(s\):|(?:Dentist|In-Person) Fee:|Credits:|AGD Code:|$)/i) || [])[0], 180);
    const feeLine = cleanText((blockText.match(/(?:Dentist Fee|In-Person Attendee Fee):\s*\$[\d,.]+(?:\s*\/\s*(?:Other|Virtual) Attendee Fee:\s*\$[\d,.]+)?/i) || [])[0], 160);
    const creditsText = cleanText((blockText.match(/Credits:\s*[\d.]+/i) || [])[0], 80);
    const agdCode = cleanText((blockText.match(/AGD Code:\s*\d+/i) || [])[0], 40);

    if (!speakerNames && keywords.length === 0) return;

    results.push(normalizeCourse({
      provider: HINMAN_PROVIDER,
      provider_slug: HINMAN_PROVIDER_SLUG,
      source_url: startUrl,
      url,
      title,
      description: [feeLine, creditsText, agdCode].filter(Boolean).join(' • '),
      course_type: 'Conference Session',
      format: 'In Person',
      topic: keywords[0] || '',
      credits_text: creditsText,
      price: feeLine,
      start_date: parseDate(dateLine),
      end_date: parseDate(dateLine),
      date_text: dateLine,
      location: 'Atlanta, GA',
      city: 'Atlanta',
      state: 'GA',
      country: 'USA',
      instructors: speakerNames,
      accreditation: 'Thomas P. Hinman Dental Meeting',
      tags: ['Conference', 'In Person', 'Hinman', ...keywords].slice(0, 12),
      metadata: {
        extracted_from: 'hinman-course-list',
        fee_line: feeLine,
        agd_code: agdCode,
        keyword_count: keywords.length,
      },
    }));

    seenUrls.add(url);
  });

  console.log(`   • Extracted ${results.length} Hinman sessions`);
  return results;
}
