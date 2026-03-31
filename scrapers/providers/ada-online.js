import { loadPageRendered } from '../lib/browser.js';
import * as cheerio from 'cheerio';
import { normalizeCourse } from '../../lib/normalize.js';

function cleanText(value, max = 300) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeText($el, max = 300) {
  return cleanText($el.text(), max);
}

export async function scrapeAdaOnlineCourses(startUrl) {
  console.log('      → Loading ADA CE Online catalog (Playwright)…');

  const visitedPages = new Set();
  const results = [];
  let nextPageUrl = startUrl;

  while (nextPageUrl && !visitedPages.has(nextPageUrl)) {
    visitedPages.add(nextPageUrl);

    const html = await loadPageRendered(nextPageUrl, '.course-card');
    const $ = cheerio.load(html);

    $('.course-card').each((_, el) => {
      const card = $(el);

      const title = safeText(card.find('.course-title, h2, h3'), 220);
      const description = safeText(card.find('.course-description, .description, p'), 700);
      const creditsText = safeText(card.find('.course-credits, .credits, [class*="credit"]'), 120);
      const priceText = safeText(card.find('.course-price, .price, .fee'), 120);
      const audience = safeText(card.find('.course-audience, .audience'), 250);
      const instructors = safeText(card.find('.course-instructor, .instructor, .faculty'), 250);
      const tags = card.find('.tag, .tags a, .topic')
        .map((__, tag) => safeText($(tag), 60))
        .get()
        .filter(Boolean);

      let link = card.find('a').attr('href');
      if (!title || !link) return;

      try {
        link = new URL(link, nextPageUrl).href;
      } catch {
        return;
      }

      results.push(normalizeCourse({
        provider: 'ADA',
        source_url: startUrl,
        url: link,
        title,
        description,
        course_type: 'On-Demand Course',
        format: 'On-Demand',
        audience,
        topic: tags.join(' | '),
        credits_text: creditsText,
        price: priceText,
        location: 'Online',
        instructors,
        tags,
        metadata: {
          catalog_page: nextPageUrl,
          extracted_from: 'ada-online-card',
        },
      }));
    });

    const next = $('a.next, button.next, a[rel="next"]').attr('href');

    if (!next) {
      nextPageUrl = null;
      continue;
    }

    try {
      nextPageUrl = new URL(next, nextPageUrl).href;
    } catch {
      nextPageUrl = null;
    }
  }

  const unique = [];
  const seen = new Set();

  for (const row of results) {
    if (seen.has(row.url)) continue;
    seen.add(row.url);
    unique.push(row);
  }

  console.log(`      → Extracted ${unique.length} ADA CE Online courses`);
  return unique;
}
