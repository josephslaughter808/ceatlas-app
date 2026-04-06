import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const PENN_CATALOG_URL = 'https://cde.dental.upenn.edu/LectureHall/CourseCatalog';
const PENN_BASE_URL = 'https://cde.dental.upenn.edu';

function cleanText(value = '', max = 1500) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanHtmlBlock(value = '', max = 2000) {
  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = PENN_BASE_URL) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function providerName(category = '') {
  return `Penn ${cleanText(category, 120)}`;
}

function providerSlug(category = '') {
  return providerName(category).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function inferTopic(category = '', title = '', description = '') {
  const value = `${cleanText(category, 200)} ${cleanText(title, 200)} ${cleanText(description, 400)}`.toLowerCase();
  if (/endo/.test(value)) return 'Endodontics';
  if (/orthodont|aligner/.test(value)) return 'Orthodontics';
  if (/pediatric|children/.test(value)) return 'Pediatric Dentistry';
  if (/periodont|prosthodont|implant/.test(value)) return 'Periodontics';
  if (/public health|advocacy|inequities|workforce|opioid/.test(value)) return 'Practice Management & Business';
  if (/tmd|tmj|maxillofacial|surgery/.test(value)) return 'Oral Surgery';
  if (/restorative|esthetic|occlusal/.test(value)) return 'Restorative Dentistry';
  if (/wellness|wellbeing|perfectionism/.test(value)) return 'Wellness';
  return 'General Dentistry';
}

async function scrapeCourseDetail(url) {
  const $ = await loadHTML(url);

  return {
    format: cleanText($('.right-side-title').first().text(), 120),
    description: cleanText($('.course-description').first().next('p').text(), 1800),
    objectives: cleanHtmlBlock($('.educational-objectives').first().next().html() || '', 1400),
    instructorBio: cleanHtmlBlock($('.lecturer .lecturer-details').parent().html() || '', 1600),
    instructor: cleanText($('.lecturer-details').first().text(), 240),
    dateText: cleanText($('.box h4:contains("Date")').next('.value').text(), 200),
    timeText: cleanText($('.box h4:contains("Time")').next('.value').text(), 120),
    creditsText: cleanText($('.points-price-value.credits').first().text(), 120),
    priceText: cleanText($('.points-price-value').not('.credits').first().text(), 120),
  };
}

export async function scrapePennLectureHall() {
  console.log('   • Scraping Penn lecture hall catalog');

  const $ = await loadHTML(PENN_CATALOG_URL);
  const rows = [];
  const seen = new Set();

  $('.course-catalog-container .expendCategory').each((_, categoryElement) => {
    const categoryBlock = $(categoryElement);
    const category = cleanText(categoryBlock.find('h1.title').text(), 120);
    const categoryCourses = categoryBlock.nextAll('div.collapse').first();

    categoryCourses.find('.course-box').each((__, courseElement) => {
      const course = $(courseElement);
      const anchor = course.find('a[href]').first();
      const url = absoluteUrl(anchor.attr('href') || '', PENN_BASE_URL);
      const title = cleanText(course.find('.course-title').text(), 250);
      const instructor = cleanText(course.find('.course-professor').text(), 240);
      const key = `${category}||${title}||${url}`;

      if (!category || !title || !url || seen.has(key)) return;
      seen.add(key);

      rows.push({ category, title, instructor, url });
    });
  });

  const detailedRows = [];
  for (const row of rows) {
    let detail = {};
    try {
      detail = await scrapeCourseDetail(row.url);
    } catch (error) {
      console.error(`      ⚠️ Penn detail failed for ${row.url}: ${error.message}`);
    }

    const description = detail.description || `${row.title} offered through Penn Dental Medicine's continuing education portal.`;
    const dateText = [detail.dateText, detail.timeText].filter(Boolean).join(' • ');

    detailedRows.push(normalizeCourse({
      provider: providerName(row.category),
      provider_slug: providerSlug(row.category),
      source_url: PENN_CATALOG_URL,
      url: row.url,
      title: row.title,
      description,
      course_type: detail.format ? `${detail.format} Course` : 'CE Course',
      format: detail.format || 'Online',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(row.category, row.title, description),
      credits_text: detail.creditsText,
      price: detail.priceText,
      date_text: dateText,
      location: /online/i.test(detail.format || '') ? 'Online' : 'Penn Dental Medicine',
      instructors: detail.instructor || row.instructor,
      accreditation: 'Penn Dental Medicine',
      tags: ['Penn', row.category, inferTopic(row.category, row.title, description)].filter(Boolean),
      metadata: {
        extracted_from: 'penn-lecturehall-catalog',
        category: row.category,
        objectives: detail.objectives || '',
        instructor_bio: detail.instructorBio || '',
      },
    }));
  }

  console.log(`   • Extracted ${detailedRows.length} Penn lecture hall rows`);
  return detailedRows;
}
