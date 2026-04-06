import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const LLU_URL = 'https://dentistry.llu.edu/continuing-education';

function cleanText(value = '', max = 700) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = LLU_URL) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function providerName(title = '') {
  return title.startsWith('LLU ') ? title : `LLU ${title}`;
}

function inferTopic(text = '') {
  const value = cleanText(text, 400).toLowerCase();
  if (/implant/.test(value)) return 'Implants';
  if (/orthodont/.test(value)) return 'Orthodontics';
  if (/rdaef|auxiliary|assist/.test(value)) return 'Dental Assisting';
  return 'General Dentistry';
}

function inferFormat(text = '') {
  const value = cleanText(text, 400).toLowerCase();
  if (/hybrid/.test(value)) return 'Hybrid';
  if (/online/.test(value)) return 'Online';
  return 'In Person';
}

export async function scrapeLLUPrograms() {
  console.log('   • Scraping LLU program-level providers');

  const $ = await loadHTML(LLU_URL);
  const rows = [];

  $('.topic_row article.topic').each((_, element) => {
    const item = $(element);
    const title = cleanText(item.find('.topic_title a').first().text(), 240);
    const description = cleanText(item.find('.topic_description').text(), 1200);
    const url = absoluteUrl(item.find('.topic_title a, .topic_link[href]').first().attr('href') || '', LLU_URL);

    if (!title || !description || !url) return;

    const provider = providerName(title);
    rows.push(normalizeCourse({
      provider,
      provider_slug: provider.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      source_url: LLU_URL,
      url,
      title,
      description,
      course_type: /continuum|program/i.test(title) ? 'CE Program' : 'Live Course',
      format: inferFormat(`${title} ${description}`),
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${title} ${description}`),
      location: 'Loma Linda University School of Dentistry',
      accreditation: 'Loma Linda University School of Dentistry',
      tags: ['LLU', inferTopic(title), inferFormat(title)].filter(Boolean),
      metadata: {
        extracted_from: 'llu-program-cards',
      },
    }));
  });

  console.log(`   • Extracted ${rows.length} LLU program-level rows`);
  return rows;
}
