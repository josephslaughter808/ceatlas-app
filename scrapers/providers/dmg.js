import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const DMG_PROVIDER = 'DMG America CE';
const DMG_PROVIDER_SLUG = 'dmg-america-ce';
const DMG_NEWS_URL = 'https://www.dmg-america.com/news-press/';
const MAX_PAGES = 11;

function cleanText(value = '', max = 500) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanMultiline(value = '', max = 1800) {
  return String(value)
    .replace(/\r/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, max);
}

function absoluteUrl(value = '', baseUrl = DMG_NEWS_URL) {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function parseIsoDate(text = '') {
  const parsed = new Date(cleanText(text, 80));
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function inferTopic(text = '') {
  const value = cleanText(text, 300).toLowerCase();
  if (/3d printing|digital workflow|printed/.test(value)) return 'Digital Dentistry & Technology';
  if (/enamel|resin infiltration|carious|white spot/.test(value)) return 'Restorative Dentistry';
  if (/grinding|nighttime discomfort|splint/.test(value)) return 'Sleep & Airway';
  return 'General Dentistry';
}

function isCeLikeTitle(title = '') {
  return /\b(ce|webinar|course|courses|hands-on|earn credits|continuing education)\b/i.test(title);
}

async function collectArticleUrls() {
  const urls = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const pageUrl = page === 1 ? DMG_NEWS_URL : `${DMG_NEWS_URL}page-${page}`;
    const $ = await loadHTML(pageUrl);

    $('.news-cards-link').each((_, link) => {
      const anchor = $(link);
      const title = cleanText(anchor.attr('title') || anchor.text(), 250);
      const href = absoluteUrl(anchor.attr('href') || '', pageUrl);
      if (!title || !href || !isCeLikeTitle(title)) return;
      urls.push(href);
    });
  }

  return [...new Set(urls)];
}

async function scrapeArticle(url) {
  try {
    const $ = await loadHTML(url);
    const title = cleanText($('h1[itemprop="headline"]').first().text(), 250);
    if (!title || !isCeLikeTitle(title)) return null;

    const description = cleanMultiline($('.news-text-wrap[itemprop="articleBody"]').html() || '', 1800);
    const teaser = cleanText($('.teaser-text[itemprop="description"]').first().text(), 300);
    const date = parseIsoDate($('time[itemprop="datePublished"]').attr('datetime') || $('time[itemprop="datePublished"]').text());
    const externalLink = absoluteUrl($('.news-text-wrap a[href]').last().attr('href') || '', url);
    const creditsMatch = `${title}\n${description}\n${teaser}`.match(/(\d+(?:\.\d+)?)\s*CEU?\b|(\d+(?:\.\d+)?)\s*CE credit/i);
    const combinedText = `${title}\n${teaser}\n${description}`;

    return normalizeCourse({
      provider: DMG_PROVIDER,
      provider_slug: DMG_PROVIDER_SLUG,
      source_url: DMG_NEWS_URL,
      url,
      title,
      description: [teaser, description].filter(Boolean).join('\n\n'),
      course_type: /on-demand/i.test(title) || /on-demand/i.test(description) ? 'On-Demand Webinar' : /hands-on|courses/i.test(title) ? 'Hands-On Course' : 'Live Webinar',
      format: /on-demand/i.test(title) || /on-demand/i.test(description) ? 'Online' : /hands-on/i.test(title) ? 'In Person' : 'Live Streaming',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(combinedText),
      credits_text: creditsMatch ? `${creditsMatch[1] || creditsMatch[2]} CE credits` : '',
      start_date: date,
      date_text: date || '',
      location: /hands-on/i.test(title) ? 'DMG America headquarters' : 'Online',
      accreditation: 'DMG America',
      tags: ['DMG America', inferTopic(combinedText), /on-demand/i.test(title) ? 'On Demand' : /hands-on/i.test(title) ? 'In Person' : 'Online'].filter(Boolean),
      metadata: {
        extracted_from: 'dmg-news-press',
        external_course_url: externalLink && externalLink !== url ? externalLink : null,
      },
    });
  } catch (error) {
    console.log(`      ⚠️ Failed to load DMG article ${url}: ${error.message}`);
    return null;
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      const value = await mapper(items[currentIndex], currentIndex);
      if (value) results.push(value);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function scrapeDMG() {
  console.log('   • Scraping DMG America CE articles');
  const urls = await collectArticleUrls();
  const rows = await mapWithConcurrency(urls, 4, scrapeArticle);
  console.log(`   • Extracted ${rows.length} DMG America CE rows`);
  return rows.filter(Boolean);
}
