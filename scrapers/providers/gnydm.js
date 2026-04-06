import axios from 'axios';
import * as cheerio from 'cheerio';
import { normalizeCourse } from '../../lib/normalize.js';

const PROVIDER = 'Greater New York Dental Meeting';
const PROVIDER_SLUG = 'greater-new-york-dental-meeting';
const BASE_URL = 'https://www.gnydm.com';

function cleanText(value = '', max = 4000) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function normalizeDate(value = '') {
  const match = cleanText(value, 80).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return '';
  return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
}

function absoluteUrl(value = '', base = BASE_URL) {
  if (!value) return '';
  try {
    return new URL(value, base).href;
  } catch {
    return '';
  }
}

function parseFieldMap(detailHtml = '') {
  const $ = cheerio.load(detailHtml);
  const fields = {};

  $('strong').each((_, strong) => {
    const label = cleanText($(strong).text(), 80).replace(/:$/, '');
    if (!label) return;

    const parentHtml = $(strong).parent().html() || '';
    const pattern = new RegExp(`${label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}:?<\\/strong>([\\s\\S]*?)(?:<br>|$)`, 'i');
    const match = parentHtml.match(pattern);
    if (match?.[1]) fields[label] = cleanText(match[1], 500);
  });

  return {
    fields,
    description: cleanText($('.col-xs-12').text(), 3500).replace(/^Description:\s*/i, ''),
  };
}

function inferTopic(rowTopic = '', title = '', description = '') {
  const text = `${rowTopic} ${title} ${description}`.toLowerCase();
  if (/implant/.test(text)) return 'Implants';
  if (/ortho|aligner/.test(text)) return 'Orthodontics';
  if (/endo/.test(text)) return 'Endodontics';
  if (/pediatric/.test(text)) return 'Pediatric Dentistry';
  if (/perio/.test(text)) return 'Periodontics';
  if (/sleep|airway/.test(text)) return 'Sleep & Airway';
  if (/esthetic|cosmetic|facial/.test(text)) return 'Esthetics & Facial Esthetics';
  if (new RegExp('digital|3d|cad/cam|printing').test(text)) return 'Digital Dentistry & Technology';
  if (/management|leadership|practice/.test(text)) return 'Practice Management & Business';
  return cleanText(rowTopic, 120) || 'General Dentistry';
}

function extractCredits(value = '') {
  return cleanText(value, 80).match(/[\d.]+/)?.[0] || '';
}

function buildYearUrl(year) {
  return `https://www.gnydm.com/courses-and-events/?year=${year}`;
}

export async function scrapeGNYDM(sourceUrl = buildYearUrl(new Date().getFullYear())) {
  console.log('   • Scraping Greater New York Dental Meeting');

  const { data } = await axios.get(sourceUrl, {
    timeout: 45000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CEAtlasBot/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
    maxContentLength: 15 * 1024 * 1024,
    maxBodyLength: 15 * 1024 * 1024,
  });

  const $ = cheerio.load(data);
  const rows = [];

  $('td.details-control[data-id]').each((_, cell) => {
    const row = $(cell).closest('tr');
    const detailId = $(cell).attr('data-id') || '';
    const detailBlock = $(`#course_details_${detailId}`);

    const cells = row.find('td');
    const courseNumber = cleanText(cells.eq(1).text(), 80);
    const dateText = cleanText(cells.eq(2).text(), 80);
    const timeText = cleanText(cells.eq(3).text(), 120);
    const title = cleanText(cells.eq(4).text(), 300);
    const tuition = cleanText(cells.eq(5).text(), 80);
    const type = cleanText(cells.eq(6).text(), 120);
    const listedTopic = cleanText(cells.eq(7).text(), 180);
    const listedSpeakers = cleanText(cells.eq(8).text(), 500);

    if (!title || !detailId || !detailBlock.length) return;

    const { fields, description } = parseFieldMap(detailBlock.html() || '');
    const creditsText = cleanText(fields.Credits || '', 80);
    const room = cleanText(fields.Room || '', 80);
    const audience = cleanText(fields['Recommended For'] || '', 220);
    const agd = cleanText(fields['AGD Number'] || '', 120);
    const courseInfo = cleanText(fields['Course Info'] || '', 120);
    const speakers = cleanText(fields['Speaker(s)'] || listedSpeakers, 500);
    const topic = inferTopic(listedTopic, title, description);
    const dateLine = [dateText, timeText].filter(Boolean).join(' • ');
    const year = new URL(sourceUrl).searchParams.get('year') || String(new Date().getFullYear());

    rows.push(normalizeCourse({
      provider: PROVIDER,
      provider_slug: PROVIDER_SLUG,
      source_url: sourceUrl,
      url: `${absoluteUrl('/courses-and-events/', BASE_URL)}?course=${encodeURIComponent(courseNumber || detailId)}&year=${year}`,
      title,
      description,
      course_type: cleanText(type, 120) || 'Conference Session',
      format: 'In Person',
      audience,
      topic,
      credits: extractCredits(creditsText),
      credits_text: creditsText,
      price: tuition,
      start_date: normalizeDate(dateText),
      end_date: normalizeDate(dateText),
      date_text: dateLine,
      location: room ? `Jacob K. Javits Convention Center • Room ${room}` : 'Jacob K. Javits Convention Center',
      city: 'New York',
      state: 'NY',
      country: 'USA',
      instructors: speakers,
      accreditation: 'Greater New York Dental Meeting',
      tags: ['Conference', 'GNYDM', cleanText(type, 80), listedTopic].filter(Boolean),
      metadata: {
        course_number: courseNumber,
        detail_id: detailId,
        room,
        agd_number: agd,
        course_info: courseInfo,
        listed_topic: listedTopic,
        source_year: year,
        extracted_from: 'gnydm-course-table',
      },
    }));
  });

  console.log(`   • Extracted ${rows.length} GNYDM sessions from ${sourceUrl}`);
  return rows;
}
