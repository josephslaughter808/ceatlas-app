import { loadHTML } from '../../lib/fetch.js';
import {
  extractCourseDataFromPage,
  extractEmbeddedCourses,
  extractRelevantLinks,
  isLikelyCoursePage,
} from '../lib/course-helpers.js';
import { scrapeAdaOnlineCourses } from './ada-online.js';
import { scrapeAdaEngageCourses } from './ada-engage.js';

const ADA_INCLUDE_PATTERNS = [
  '/education/continuing-education',
  '/education/scientific-session',
];

const ADA_EXCLUDE_PATTERNS = [
  '/topic/',
  '.pdf',
  '/research/',
  '/press/',
  '/signin',
  '/login',
  '/careers',
  '/students',
  '/testing',
  '/publications',
  '/coda',
  '/dentpin',
];

const MAX_ADA_PAGES = 80;

function isAdaCeUrl(url) {
  const lower = url.toLowerCase();
  if (ADA_EXCLUDE_PATTERNS.some((pattern) => lower.includes(pattern))) return false;
  return ADA_INCLUDE_PATTERNS.some((pattern) => lower.includes(pattern));
}

function extractAdaLinks($, baseUrl) {
  return extractRelevantLinks($, baseUrl).filter(isAdaCeUrl);
}

export async function scrapeADA(startUrl) {
  console.log(`   • Starting ADA crawl from: ${startUrl}`);

  const engageRows = await scrapeAdaEngageCourses();
  const queue = [startUrl];
  const visited = new Set();
  const results = [...engageRows];
  const seenResultUrls = new Set(engageRows.map((row) => row.url).filter(Boolean));

  while (queue.length > 0 && visited.size < MAX_ADA_PAGES) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    console.log(`      → Visiting: ${url}`);

    if (url.includes('/ce-online-courses')) {
      const onlineCourses = await scrapeAdaOnlineCourses(url);
      for (const course of onlineCourses) {
        if (seenResultUrls.has(course.url)) continue;
        seenResultUrls.add(course.url);
        results.push(course);
      }
      continue;
    }

    let $;
    try {
      $ = await loadHTML(url);
    } catch (error) {
      console.log(`      ⚠️ Failed to load ${url}: ${error.message}`);
      continue;
    }

    const row = extractCourseDataFromPage($, {
      provider: 'ADA',
      providerUrl: startUrl,
      pageUrl: url,
    });

    const embeddedRows = extractEmbeddedCourses($, {
      provider: 'ADA',
      providerUrl: startUrl,
      pageUrl: url,
    });

    for (const embeddedRow of embeddedRows) {
      if (seenResultUrls.has(embeddedRow.url)) continue;
      seenResultUrls.add(embeddedRow.url);
      results.push(embeddedRow);
    }

    if (isLikelyCoursePage(row) && !seenResultUrls.has(row.url)) {
      seenResultUrls.add(row.url);
      results.push(row);
    }

    const links = extractAdaLinks($, url);
    for (const link of links) {
      if (!visited.has(link)) queue.push(link);
    }
  }

  console.log(`   • Extracted ${results.length} ADA CE courses`);
  return results;
}
