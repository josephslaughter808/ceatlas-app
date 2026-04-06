import { execFileSync } from 'child_process';
import * as cheerio from 'cheerio';

const MSDA_EVENTS_URL = 'https://msda.com/wp-json/tribe/events/v1/events';

function cleanText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function htmlToText(value) {
  const $ = cheerio.load(value || '');
  return cleanText($.text());
}

function extractInstructor(text) {
  const match = text.match(/Instructor:\s*([^|]+?)(?:Fees:|Objectives:|Venue:|Date:|$)/i);
  return cleanText(match?.[1] || '');
}

function extractPriceText(text) {
  const match = text.match(/Fees?:\s*([^|]+?)(?:Conflict of Interest|Venue:|Date:|Time:|$)/i);
  return cleanText(match?.[1] || '');
}

function extractCredits(title, text) {
  const titleMatch = title.match(/\((\d+(?:\.\d+)?)\s*CE/i);
  if (titleMatch) return Number(titleMatch[1]);

  const textMatch = text.match(/(\d+(?:\.\d+)?)\s*CE(?:U|s)?/i);
  if (textMatch) return Number(textMatch[1]);

  return null;
}

function extractFormat(event, text) {
  const lower = `${event.venue?.venue || ''} ${text}`.toLowerCase();
  if (lower.includes('virtual')) return 'Live Online';
  if (lower.includes('in person')) return 'In Person';
  return event.venue?.venue ? 'In Person' : 'Live';
}

function buildRow(event) {
  const description = htmlToText(event.description || '');
  const title = cleanText(event.title || '');
  const venueName = cleanText(event.venue?.venue || '');
  const location = venueName
    ? [
      venueName,
      cleanText(event.venue?.city || ''),
      cleanText(event.venue?.state || ''),
    ].filter(Boolean).join(', ')
    : 'Maryland / virtual';

  return {
    provider: 'Maryland State Dental Association CE',
    provider_slug: 'maryland-state-dental-association-ce',
    source_url: 'https://msda.com/continuing-education/',
    url: event.url,
    title,
    description,
    course_type: 'Continuing Education',
    topic: title,
    format: extractFormat(event, description),
    location,
    city: cleanText(event.venue?.city || ''),
    state: cleanText(event.venue?.state || 'MD'),
    country: cleanText(event.venue?.country || 'USA'),
    start_date: event.start_date ? event.start_date.slice(0, 10) : '',
    end_date: event.end_date ? event.end_date.slice(0, 10) : '',
    date_text: cleanText(
      [
        event.start_date ? event.start_date.slice(0, 10) : '',
        event.end_date && event.end_date.slice(0, 10) !== event.start_date?.slice(0, 10)
          ? event.end_date.slice(0, 10)
          : '',
      ].filter(Boolean).join(' to '),
    ),
    credits: extractCredits(title, description),
    credits_text: cleanText(description.match(/\d+(?:\.\d+)?\s*CE(?:U|s)?/i)?.[0] || ''),
    price: extractPriceText(description),
    instructor: extractInstructor(description),
    accreditation: 'Maryland State Dental Association',
    tags: [
      ...(event.categories || []).map((category) => cleanText(category.name)),
      ...(event.tags || []).map((tag) => cleanText(tag.name)),
    ].filter(Boolean),
    metadata: {
      scraped_from_msda_api: true,
      venue: event.venue || null,
      organizer: event.organizer || null,
    },
  };
}

export async function scrapeMarylandMSDA() {
  const raw = execFileSync('curl', ['-L', `${MSDA_EVENTS_URL}?per_page=100`], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8,
  });
  const data = JSON.parse(raw);

  return (data.events || [])
    .filter((event) => Array.isArray(event.categories) && event.categories.some((category) => cleanText(category.slug) === 'continuing-education-courses'))
    .map(buildRow)
    .filter((row) => row.title && row.url);
}
