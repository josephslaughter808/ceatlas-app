import axios from 'axios';
import * as cheerio from 'cheerio';
import { normalizeCourse } from '../../lib/normalize.js';

const SOURCE_URL = 'https://thedawsonacademy.com/calendar/';

function cleanText(value = '', max = 2000) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseDateRange(value) {
  const text = cleanText(value, 100).replace(/\./g, '');
  const match = text.match(/^([A-Za-z]+)\s+(\d{1,2})(?:\s*-\s*(?:(?:([A-Za-z]+)\s+)?(\d{1,2})))?,\s*(\d{4})$/);
  if (!match) return { startDate: '', endDate: '' };
  const startMonth = MONTHS[match[1].slice(0, 3).toLowerCase()];
  const endMonth = match[3] ? MONTHS[match[3].slice(0, 3).toLowerCase()] : startMonth;
  const year = Number(match[5]);
  if (startMonth === undefined || endMonth === undefined) return { startDate: '', endDate: '' };
  const format = (date) => date.toISOString().slice(0, 10);
  const start = new Date(Date.UTC(year, startMonth, Number(match[2])));
  const endYear = endMonth < startMonth ? year + 1 : year;
  const end = new Date(Date.UTC(endYear, endMonth, Number(match[4] || match[2])));
  return { startDate: format(start), endDate: format(end) };
}

function inferTopic(title = '') {
  const value = title.toLowerCase();
  if (/tmd|airway|occlusion/.test(value)) return 'Occlusion, TMD & Airway';
  if (/esthetic|smile|restor/.test(value)) return 'Restorative & Esthetic Dentistry';
  if (/treatment plan|examination|records/.test(value)) return 'Diagnosis & Treatment Planning';
  if (/implant|surg/.test(value)) return 'Implant Dentistry';
  return 'General Dentistry';
}

function detailFacts(html) {
  const $ = cheerio.load(html);
  const text = String($.root().text()).replace(/\s+/g, ' ').trim();
  const credits = Number(text.match(/CE Credits\s*:\s*(\d+(?:\.\d+)?)/i)?.[1]
    || text.match(/designates this activity for\s*(\d+(?:\.\d+)?)\s*credit hours/i)?.[1]);
  const description = cleanText($('meta[name="description"]').attr('content') || $('main p').first().text(), 2000);
  const instructor = cleanText($('img[alt*="DDS"], img[alt*="DMD"]').first().attr('alt'), 150);
  return { credits, description, instructor };
}

function geoFor(location) {
  if (/online|virtual/i.test(location)) return { city: '', state: '', country: '', format: 'Live Online' };
  const match = location.match(/^(.+?),\s*([A-Z]{2})$/);
  if (match) return { city: cleanText(match[1], 100), state: match[2], country: 'USA', format: 'In Person' };
  return { city: location, state: '', country: '', format: 'In Person' };
}

export async function scrapeDawson() {
  console.log('   • Scraping The Dawson Academy calendar and course details');
  const request = (url) => axios.get(url, {
    timeout: 60000,
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; CEAtlasBot/1.0)' },
  });
  const { data: calendarHtml } = await request(SOURCE_URL);
  const $ = cheerio.load(calendarHtml);
  const events = [];
  const seenEvents = new Set();

  $('.jet-listing-grid__item').each((_, element) => {
    const card = $(element);
    const courseLink = card.find('a.jet-listing-dynamic-link__link').first();
    const title = cleanText(courseLink.text(), 250);
    const url = courseLink.attr('href');
    const fields = card.find('.jet-listing-dynamic-field__content').map((__, field) => cleanText($(field).text(), 300)).get();
    const dateText = fields.find((field) => /\b\d{4}\b/.test(field) && /[A-Za-z]{3}/.test(field)) || '';
    const location = fields.find((field) => /online|virtual|,\s*[A-Z]{2}$/i.test(field)) || '';
    const priceText = fields.find((field) => /^\$[\d,]+(?:\.\d{2})?$/.test(field)) || '';
    const key = `${url}|${dateText}|${location}`;
    if (title && url && dateText && !seenEvents.has(key)) {
      seenEvents.add(key);
      events.push({ title, url, dateText, location, priceText });
    }
  });

  const uniqueUrls = [...new Set(events.map((event) => event.url))];
  const facts = new Map(await Promise.all(uniqueUrls.map(async (url) => {
    try {
      const { data } = await request(url);
      return [url, detailFacts(String(data))];
    } catch (error) {
      console.warn(`   • Dawson detail page failed (${url}): ${error.message}`);
      return [url, { credits: NaN, description: '', instructor: '' }];
    }
  })));

  const seenRows = new Set();
  const results = events.flatMap((event) => {
    const detail = facts.get(event.url) || {};
    if (!Number.isFinite(detail.credits) || detail.credits <= 0) return [];
    const { startDate, endDate } = parseDateRange(event.dateText);
    if (!startDate) return [];
    const rowKey = `${event.url}|${startDate}|${event.location}`;
    if (seenRows.has(rowKey)) return [];
    seenRows.add(rowKey);
    const geo = geoFor(event.location);
    const price = Number(event.priceText.replace(/[$,]/g, ''));
    const topic = inferTopic(event.title);
    return [normalizeCourse({
      provider: 'The Dawson Academy',
      provider_slug: 'dawson-academy',
      source_url: SOURCE_URL,
      url: event.url,
      title: event.title,
      description: detail.description,
      course_type: 'Advanced Clinical Education',
      format: geo.format,
      audience: 'Dentists',
      topic,
      credits: detail.credits,
      credits_text: `${detail.credits} CE Credits`,
      price: event.priceText,
      price_amount: Number.isFinite(price) ? price : null,
      currency: 'USD',
      start_date: startDate,
      end_date: endDate,
      date_text: `${event.dateText} • ${event.location}`,
      location: event.location,
      city: geo.city,
      state: geo.state,
      country: geo.country,
      accreditation: 'ADA CERP Recognized Provider',
      tags: ['The Dawson Academy', geo.format, topic, detail.instructor].filter(Boolean),
      metadata: {
        extracted_from: 'dawson-public-calendar',
        instructor: detail.instructor,
      },
    })];
  });
  console.log(`   • Extracted ${results.length} verified Dawson sessions from ${events.length} calendar events`);
  return results;
}
