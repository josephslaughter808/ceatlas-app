import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const LLU_PROVIDER = 'Loma Linda University Dental CE';
const LLU_PROVIDER_SLUG = 'loma-linda-university-dental-ce';
const LLU_URL = 'https://dentistry.llu.edu/continuing-education';

function cleanText(value = '', max = 500) {
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

function inferTopic(text = '') {
  const value = cleanText(text, 400).toLowerCase();
  if (/implant/.test(value)) return 'Implants';
  if (/orthodont/.test(value)) return 'Orthodontics';
  if (/auxiliary|rdaef/.test(value)) return 'Dental Assisting';
  return 'General Dentistry';
}

function inferFormat(text = '') {
  const value = cleanText(text, 400).toLowerCase();
  if (/online|hybrid/.test(value)) return 'Hybrid';
  return 'In Person';
}

export async function scrapeLLU() {
  console.log('   • Scraping Loma Linda University Dental CE');

  const $ = await loadHTML(LLU_URL);
  const rows = [];

  $('.topic_row article.topic').each((_, element) => {
    const item = $(element);
    const title = cleanText(item.find('.topic_title a').first().text(), 250);
    const description = cleanText(item.find('.topic_description').text(), 900);
    const url = absoluteUrl(item.find('.topic_title a, .topic_link[href]').first().attr('href') || '', LLU_URL);

    if (!title || !description || !url) return;

    rows.push(normalizeCourse({
      provider: LLU_PROVIDER,
      provider_slug: LLU_PROVIDER_SLUG,
      source_url: LLU_URL,
      url,
      title,
      description,
      course_type: /program|continuum/i.test(title) ? 'CE Program' : 'Live Course',
      format: inferFormat(`${title} ${description}`),
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${title} ${description}`),
      location: 'Loma Linda University School of Dentistry',
      accreditation: 'Loma Linda University School of Dentistry',
      tags: ['Loma Linda', inferTopic(title), inferFormat(title)].filter(Boolean),
      metadata: {
        extracted_from: 'llu-topic-cards',
      },
    }));
  });

  console.log(`   • Extracted ${rows.length} Loma Linda University Dental CE rows`);
  return rows;
}
