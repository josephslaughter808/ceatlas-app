import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as cheerio from 'cheerio';
import { normalizeCourse } from '../../lib/normalize.js';

const execFileAsync = promisify(execFile);
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

const COURSES = [
  {
    provider: 'StyleItaliano Direct Composite Bonding',
    provider_slug: 'styleitaliano-direct-composite-bonding',
    url: 'https://courses.styleitaliano.org/direct-composite-bonding-protocols-and-adhesive-technique-course/',
    topic: 'Restorative Dentistry',
  },
  {
    provider: 'StyleItaliano Direct and Indirect Veneers',
    provider_slug: 'styleitaliano-direct-and-indirect-veneers',
    url: 'https://courses.styleitaliano.org/direct-and-indirect-veneers-for-restorative-protocols-course/',
    topic: 'Esthetics & Facial Esthetics',
  },
  {
    provider: 'StyleItaliano Full Smile Veneers',
    provider_slug: 'styleitaliano-full-smile-veneers',
    url: 'https://courses.styleitaliano.org/full-smile-veneers-in-a-single-appointment-course/',
    topic: 'Esthetics & Facial Esthetics',
  },
  {
    provider: 'StyleItaliano Intensive Practical Hands-On Training',
    provider_slug: 'styleitaliano-intensive-practical-training',
    url: 'https://courses.styleitaliano.org/intensive-practical-hands-on-training-course/',
    topic: 'Restorative Dentistry',
  },
  {
    provider: 'StyleItaliano Post-Endodontic Restorations',
    provider_slug: 'styleitaliano-post-endodontic-restorations',
    url: 'https://courses.styleitaliano.org/post-endodontic-restorations-and-prosthetics-course/',
    topic: 'Endodontics',
  },
];

function cleanText(value = '', max = 2000) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function extractDescription($) {
  const paragraphs = $('p')
    .map((_, element) => cleanText($(element).text(), 320))
    .get()
    .filter((text) => text && !/download the course schedule|view calendar|terms and conditions|all right reserved/i.test(text));
  return paragraphs.slice(0, 3).join(' ');
}

function extractDateText(html = '') {
  const matches = [...html.matchAll(/<i class="item-icon fa fa-calendar"[^>]*><\/i><h4>([^<]+)<\/h4>/g)]
    .map((entry) => cleanText(entry[1], 80))
    .filter((entry) => /2026/.test(entry));
  return matches.join(' • ');
}

function extractPrice(html = '') {
  const matches = [...html.matchAll(/(\d[\d.,]*)&euro;/gi)].map((entry) => `${entry[1]}€`);
  return matches[0] || '';
}

function extractLocations(html = '') {
  const section = html.match(/Course Locations[\s\S]*?(?=<\/div>\s*<\/div>\s*<\/div>\s*<\/div>|$)/i)?.[0] || html;
  const matches = [...section.matchAll(/<h4>([A-Z][A-Z\s'-]+)<\/h4>/g)]
    .map((entry) => cleanText(entry[1], 80))
    .filter(Boolean);
  return [...new Set(matches)].join(' / ');
}

async function loadStyleItalianoHTML(url) {
  const { stdout } = await execFileAsync('curl', [
    '-L',
    '--max-time',
    '30',
    '-A',
    BROWSER_USER_AGENT,
    '-H',
    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    url,
  ], {
    maxBuffer: 12 * 1024 * 1024,
  });

  return cheerio.load(stdout);
}

export async function scrapeStyleItalianoBatch() {
  console.log('   • Scraping StyleItaliano course batch');

  const rows = [];

  for (const course of COURSES) {
    const $ = await loadStyleItalianoHTML(course.url);
    const html = $.html();
    const title = cleanText($('h1').first().text(), 250)
      || cleanText($('title').first().text(), 250);

    rows.push(normalizeCourse({
      provider: course.provider,
      provider_slug: course.provider_slug,
      source_url: course.url,
      url: course.url,
      title,
      description: extractDescription($),
      course_type: 'Hands-On Course',
      format: 'In Person',
      audience: 'Dentists',
      topic: course.topic,
      price: extractPrice(html),
      date_text: extractDateText(html),
      location: extractLocations(html) || 'Italy',
      country: 'Italy',
      accreditation: 'Style Italiano Courses',
      requirements: 'Hands-on program',
      tags: ['StyleItaliano', 'Italy', 'Hands-On', course.topic].filter(Boolean),
      metadata: {
        extracted_from: 'styleitaliano-course-page',
      },
    }));
  }

  console.log(`   • Extracted ${rows.length} StyleItaliano rows`);
  return rows;
}
