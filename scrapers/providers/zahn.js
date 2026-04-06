import axios from 'axios';
import * as cheerio from 'cheerio';
import { normalizeCourse } from '../../lib/normalize.js';

const PROVIDER = 'Zahn Continuing Education';
const PROVIDER_SLUG = 'zahn-continuing-education';
const SOURCE_URL = 'https://www.henryschein.com/us-en/Zahn/Events/ContinuingEducation.aspx';

function cleanText(value = '', max = 3000) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function normalizeDate(value = '') {
  const parsed = new Date(cleanText(value, 80));
  if (Number.isNaN(parsed.getTime())) return '';
  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0'),
  ].join('-');
}

function absoluteUrl(value = '') {
  if (!value) return '';
  try {
    return new URL(value, SOURCE_URL).href;
  } catch {
    return '';
  }
}

export async function scrapeZahn() {
  console.log('   • Scraping Zahn Continuing Education');

  const { data } = await axios.get(SOURCE_URL, {
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CEAtlasBot/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  const $ = cheerio.load(data);
  const rows = [];

  $('.ce-title').each((_, titleNode) => {
    const title = cleanText($(titleNode).text(), 240);
    const content = $(titleNode).closest('.col-three-quarter');
    const buttonLink = content.parent().find('.col-one-quarter a[href]').first();
    const metaText = cleanText(content.find('p').first().text(), 500);
    const description = cleanText(content.find('.pad-bottom.pad-top').first().text(), 2000);
    const url = absoluteUrl(buttonLink.attr('href') || '');
    const dateLabel = metaText.match(/DATE:\s*([^]+?)TIME:/i)?.[1]?.trim() || '';

    if (!title || !url) return;

    rows.push(normalizeCourse({
      provider: PROVIDER,
      provider_slug: PROVIDER_SLUG,
      source_url: SOURCE_URL,
      url,
      title,
      description,
      course_type: 'Webinar',
      format: /virtual/i.test(metaText) ? 'Online' : 'In Person',
      audience: 'Dental Laboratory Technicians and Owners',
      topic: 'Dental Laboratory',
      credits: '',
      credits_text: '',
      price: '',
      start_date: normalizeDate(dateLabel),
      end_date: '',
      date_text: metaText,
      location: cleanText(metaText.match(/LOCATION:\s*([^]+?)SPEAKER:/i)?.[1] || '', 120),
      city: '',
      state: '',
      country: 'USA',
      instructors: cleanText(metaText.match(/SPEAKER:\s*(.+)$/i)?.[1] || '', 180),
      accreditation: 'National Board for Certification in Dental Laboratory Technology',
      tags: ['Zahn Academy', 'Dental Laboratory'],
      metadata: {
        extracted_from: 'zahn-continuing-education-page',
      },
    }));
  });

  console.log(`   • Extracted ${rows.length} Zahn Continuing Education rows`);
  return rows;
}
