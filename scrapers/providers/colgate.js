import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const COLGATE_PROVIDER = 'Colgate Oral Health Network';
const COLGATE_PROVIDER_SLUG = 'colgate-oral-health-network';
const COLGATE_SOURCE_URL = 'https://www.colgateoralhealthnetwork.com/webinar/';

function cleanText(value = '', max = 500) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function textMatch(text, pattern) {
  const match = text.match(pattern);
  return cleanText(match?.[1] || '', 500);
}

function toDateString(value = '') {
  const text = cleanText(value, 80);
  if (!text) return '';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function inferFormat(text = '') {
  if (inferCourseType(text) === 'On-Demand Webinar') return 'Online';
  if (inferCourseType(text) === 'Live Webinar') return 'Online';
  return 'Online';
}

function inferCourseType(text = '') {
  const match = text.match(/(LIVE WEBINAR|ON-DEMAND WEBINAR)/i);
  const label = (match?.[1] || '').toUpperCase();
  if (label === 'LIVE WEBINAR') return 'Live Webinar';
  if (label === 'ON-DEMAND WEBINAR') return 'On-Demand Webinar';
  return 'Webinar';
}

export async function scrapeColgate(startUrl = COLGATE_SOURCE_URL) {
  console.log('   • Scraping Colgate Oral Health Network public catalog');

  const $listing = await loadHTML(startUrl);
  const detailLinks = Array.from(new Set(
    $listing('a[href]')
      .map((_, el) => $listing(el).attr('href'))
      .get()
      .filter((href) => /^\/webinar\/[a-z0-9-]+\/?$/i.test(href))
      .map((href) => new URL(href, startUrl).href),
  ));

  const results = [];

  for (const url of detailLinks) {
    try {
      const $ = await loadHTML(url);
      const body = $('body').text().replace(/\s+/g, ' ').trim();
      const title = cleanText(
        $('meta[property="og:title"]').attr('content')
        || textMatch(body, /(?:LIVE WEBINAR|ON-DEMAND WEBINAR)\s+[0-9:-\sA-Za-z,.()]+?\s+(.+?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+[A-Z]{1,}/)
        || new URL(url).pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' '),
        250,
      ).replace(/\b\w/g, (char) => char.toUpperCase());

      const description = cleanText(
        textMatch(body, /Webinar detailsAsk the expert(.*?)(?:Participants will learn:|Presenters:|Submit your questions in advance)/i),
        2500,
      );

      const instructors = cleanText(
        textMatch(body, /Presenters:\s*(.+?)More courses with/i),
        300,
      );

      const category = cleanText(
        textMatch(body, /Categories:\s*(.+?)(?:OTHER WEBINARS|\/\/ submit new questions|Home Dental CE Courses)/i),
        200,
      );

      const creditsText = cleanText(textMatch(body, /C\.E\. credits:\s*([0-9.]+)/i), 20);
      const startDateText = cleanText(textMatch(body, /Start date:\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i), 80);
      const expirationText = cleanText(textMatch(body, /Expiration date:\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i), 80);

      results.push(normalizeCourse({
        provider: COLGATE_PROVIDER,
        provider_slug: COLGATE_PROVIDER_SLUG,
        source_url: startUrl,
        url,
        title,
        description,
        course_type: inferCourseType(body),
        format: inferFormat(body),
        topic: category || title,
        credits_text: creditsText,
        price: 'Free',
        start_date: toDateString(startDateText),
        end_date: toDateString(expirationText) || toDateString(startDateText),
        date_text: startDateText || expirationText,
        instructors,
        accreditation: 'Tribune Group GmbH / AGD PACE',
        tags: [...new Set([
          'Colgate Oral Health Network',
          inferCourseType(body),
          category,
        ].filter(Boolean))],
        metadata: {
          extracted_from: 'colgate-webinar-pages',
          expiration_date: expirationText,
          agd_subject_code: cleanText(textMatch(body, /AGD PACE subject code\(s\):\s*([0-9, ]+)/i), 80),
          aadh_course_code: cleanText(textMatch(body, /AADH course code:\s*([A-Z0-9-]+)/i), 120),
        },
      }));
    } catch (error) {
      console.log(`      ⚠️ Failed to load Colgate webinar ${url}: ${error.message}`);
    }
  }

  console.log(`   • Extracted ${results.length} Colgate webinars`);
  return results;
}
