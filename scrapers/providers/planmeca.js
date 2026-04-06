import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const PLANMECA_PROVIDER = 'Planmeca Digital Academy';
const PLANMECA_PROVIDER_SLUG = 'planmeca-digital-academy';
const PLANMECA_COURSES_URL = 'https://www.planmeca.com/training/courses-for-dentists/';

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
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = PLANMECA_COURSES_URL) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function extractSection(html = '', heading = '') {
  const pattern = new RegExp(`<strong>${heading}<\\/strong>[\\s\\S]*?<\\/p>([\\s\\S]*?)(?=<p[^>]*class="intro"|<a id="training-home-button"|<h3>|$)`, 'i');
  const match = html.match(pattern);
  return match ? cleanMultiline(match[1], 1200) : '';
}

function extractFirstMatch(html = '', pattern) {
  const match = html.match(pattern);
  return match ? cleanText(match[1], 160) : '';
}

function extractPresenters(html = '') {
  const sectionMatch = html.match(/<strong>PRESENTERS[\s\S]*?<\/strong>([\s\S]*?)(?=<\/div>\s*<\/div>|<a id="training-home-button"|$)/i);
  if (!sectionMatch) return '';

  const strongNames = [...sectionMatch[1].matchAll(/<p[^>]*>\s*<strong>([^<]+)<\/strong>\s*<\/p>/gi)]
    .map((match) => cleanText(match[1], 120))
    .filter(Boolean);

  return [...new Set(strongNames)].join('\n');
}

function inferTopic(title = '', description = '') {
  const text = `${title} ${description}`.toLowerCase();
  if (/cbct|implant/.test(text)) return 'Implant Dentistry';
  if (/orthodont/.test(text)) return 'Orthodontics';
  if (/cad\/cam|digital|scan|printer|3d/.test(text)) return 'Digital Dentistry & Technology';
  if (/restorat|esthetic|anterior|posterior/.test(text)) return 'Restorative Dentistry';
  return 'General Dentistry';
}

export async function scrapePlanmeca() {
  console.log('   • Scraping Planmeca Digital Academy public catalog');

  const $ = await loadHTML(PLANMECA_COURSES_URL);
  const rows = [];

  $('.accordion-area').each((_, element) => {
    const item = $(element);
    const title = cleanText(item.find('h3').first().text(), 250);
    const content = item.find('.accordion-content').first();
    const html = content.html() || '';
    const registrationUrl = absoluteUrl(content.find('a#training-home-button[href*="cvent.me"]').first().attr('href') || '');

    if (!title || !registrationUrl) {
      return;
    }

    const description = extractSection(html, 'COURSE DESCRIPTION');
    const objectives = extractSection(html, 'OBJECTIVES');
    const prerequisites = extractSection(html, 'PREREQUISITES');
    const credits = extractFirstMatch(html, /<strong>CE Credits<\/strong>\s*:\s*([^<]+)/i);
    const price = extractFirstMatch(html, /<strong>COURSE TUITION<\/strong>[\s\S]*?<p[^>]*>\s*([^<]+)\s*<\/p>/i);
    const agdSubjectCode = extractFirstMatch(html, /<strong>AGD SUBJECT CODE<\/strong>\s*:\s*([^<]+)/i);
    const presenters = extractPresenters(html);
    const topic = inferTopic(title, description);

    rows.push(normalizeCourse({
      provider: PLANMECA_PROVIDER,
      provider_slug: PLANMECA_PROVIDER_SLUG,
      source_url: PLANMECA_COURSES_URL,
      url: registrationUrl,
      title,
      description: [description, objectives].filter(Boolean).join('\n\n'),
      course_type: 'Hands-On Course',
      format: 'In Person',
      audience: 'Dentists and Dental Team',
      topic,
      credits_text: credits ? `${credits} CE credits` : '',
      price,
      location: 'See registration page',
      instructors: presenters,
      accreditation: 'Planmeca Digital Academy',
      requirements: prerequisites,
      tags: ['Planmeca', 'In Person', topic, agdSubjectCode ? `AGD ${agdSubjectCode}` : ''].filter(Boolean),
      metadata: {
        extracted_from: 'planmeca-accordion-catalog',
        agd_subject_code: agdSubjectCode || null,
        registration_url: registrationUrl,
      },
    }));
  });

  console.log(`   • Extracted ${rows.length} Planmeca Digital Academy courses`);
  return rows;
}
