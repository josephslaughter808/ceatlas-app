import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const PROVIDER = 'NetCE Dental';
const PROVIDER_SLUG = 'netce-dental';
const SOURCE_URL = 'https://www.netce.com/continuing-education/dentist/california/';
const BASE_URL = 'https://www.netce.com';

function cleanText(value = '', max = 1800) {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = BASE_URL) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function inferTopic(text = '') {
  const value = cleanText(text, 1000).toLowerCase();
  if (/implant/.test(value)) return 'Implants';
  if (/endodont/.test(value)) return 'Endodontics';
  if (/orthodont/.test(value)) return 'Orthodontics';
  if (/periodont/.test(value)) return 'Periodontics';
  if (/oral surgery|maxillofacial trauma/.test(value)) return 'Oral Surgery';
  if (/infection|hiv|aids|tuberculosis|microbial|hepatitis|influenza|coronavirus/.test(value)) return 'Infection Control';
  if (/ethics|law|jurisprudence|requirement|prescribing|opioid|controlled substance/.test(value)) return 'Ethics & Jurisprudence';
  if (/pharmac|medication|anticoagul|opioid|pain management|substance/.test(value)) return 'Pharmacology';
  if (/emergenc|airway|allergic/.test(value)) return 'Medical Emergencies';
  if (/radiograph|imaging|x-?ray/.test(value)) return 'Digital Dentistry & Technology';
  if (/caries|oral health|nutrition|tobacco|mucosal|pathology|histology/.test(value)) return 'Dental Hygiene';
  if (/older adult|geriatric/.test(value)) return 'Geriatric Dentistry';
  if (/botulinum|fillers|facial aging/.test(value)) return 'Esthetics & Facial Esthetics';
  return 'General Dentistry';
}

function categoryForRow($, row) {
  const categoryKey = $(row).attr('data-category') || '';
  if (!categoryKey) return '';
  const heading = $(`tr.course-heading-row[data-category="${categoryKey}"]`).first().text();
  return cleanText(heading, 200);
}

export async function scrapeNetCE() {
  console.log(`   • Scraping ${PROVIDER}`);
  const $ = await loadHTML(SOURCE_URL);
  const rows = [];

  $('tr.course-row').each((_, row) => {
    const node = $(row);
    const link = node.find('td.course-desc a[href*="/course/overview/"]').first();
    const title = cleanText(link.text(), 250);
    const url = absoluteUrl(link.attr('href') || '', SOURCE_URL);
    if (!title || !url) return;

    const cells = node.children('td');
    const courseCode = cleanText(cells.eq(0).text(), 80);
    const creditsText = cleanText(cells.eq(2).text(), 80).replace(/\s+/g, ' ');
    const accreditation = cleanText(cells.eq(3).text(), 120);
    const price = cleanText(cells.eq(4).text(), 80);
    const category = categoryForRow($, row);

    rows.push(normalizeCourse({
      provider: PROVIDER,
      provider_slug: PROVIDER_SLUG,
      source_url: SOURCE_URL,
      url,
      title,
      description: `${title} is listed in NetCE's public dentist continuing education course catalog.${category ? ` Category: ${category}.` : ''}`,
      course_type: 'Online Course',
      format: 'Online',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${category} ${title}`),
      credits_text: creditsText,
      price,
      location: 'Online',
      country: 'USA',
      accreditation: accreditation || 'NetCE',
      tags: ['NetCE', 'Online', category, accreditation].filter(Boolean),
      metadata: {
        extracted_from: 'netce-dentist-course-list',
        course_code: courseCode || null,
        category: category || null,
      },
    }));
  });

  const deduped = [];
  const seen = new Set();
  for (const row of rows) {
    const key = `${row.title}::${row.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  console.log(`   • Extracted ${deduped.length} ${PROVIDER} rows`);
  return deduped;
}
