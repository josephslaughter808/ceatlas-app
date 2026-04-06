import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as cheerio from 'cheerio';
import { normalizeCourse } from '../../lib/normalize.js';

const execFileAsync = promisify(execFile);
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';
const SOURCE_URL = 'https://www.dds.world/en/';
const TODAY = new Date().toISOString().slice(0, 10);

function cleanText(value = '', max = 2000) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function inferTopic(text = '') {
  const value = cleanText(text, 300).toLowerCase();
  if (/implant/.test(value)) return 'Implants';
  if (/aligner|ortho/.test(value)) return 'Orthodontics';
  if (/cad\/cam|3d printing|digital|ai/.test(value)) return 'Digital Dentistry & Technology';
  if (/root/.test(value)) return 'Endodontics';
  return 'General Dentistry';
}

async function loadDDSHTML(url) {
  const { stdout } = await execFileAsync('curl', [
    '-L',
    '--max-time',
    '40',
    '-A',
    BROWSER_USER_AGENT,
    '-H',
    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    url,
  ], {
    maxBuffer: 24 * 1024 * 1024,
  });

  return cheerio.load(stdout);
}

export async function scrapeDDSWorld() {
  console.log('   • Scraping DDS World symposium catalog');

  const $ = await loadDDSHTML(SOURCE_URL);
  const rows = [];

  $('ul.menu-symposia-listing li a').each((_, element) => {
    const $link = $(element);
    const title = cleanText($link.find('strong.name').text(), 220);
    const creditsText = cleanText($link.find('i').first().text(), 40);
    const startDateTime = cleanText($link.find('.momentjs-tl').first().text(), 30);
    const startDate = startDateTime.slice(0, 10);
    if (!title || !startDate || startDate < TODAY) return;

    rows.push(normalizeCourse({
      provider: 'DDS World',
      provider_slug: 'dds-world',
      source_url: SOURCE_URL,
      url: new URL($link.attr('href') || '', SOURCE_URL).toString(),
      title,
      description: `DDS World 2026 symposium: ${title}.`,
      course_type: 'Symposium',
      format: 'Online',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(title),
      credits_text: creditsText,
      start_date: startDate,
      end_date: startDate,
      date_text: cleanText(startDateTime.replace(' ', ' • '), 40),
      location: 'Online',
      country: 'International',
      accreditation: 'DDS World / DT Study Club',
      tags: ['DDS World', 'Symposium', inferTopic(title)].filter(Boolean),
      metadata: {
        extracted_from: 'dds-world-homepage-symposia',
      },
    }));
  });

  console.log(`   • Extracted ${rows.length} DDS World rows`);
  return rows;
}
