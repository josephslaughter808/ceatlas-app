import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const DEFAULT_SESSION_CONCURRENCY = 1;
const DEFAULT_REQUEST_DELAY_MS = 600;
const DEFAULT_RETRY_COUNT = 2;

function cleanText(value = '') {
  return String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanMultiline(value = '') {
  return String(value)
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function absoluteUrl(value = '', baseUrl = '') {
  if (!value) return '';
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return '';
  }
}

function parseSessionDate(value = '') {
  const match = cleanText(value).match(/([A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})/);
  if (!match) return '';

  const parsed = new Date(match[1]);
  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toISOString().slice(0, 10);
}

function extractTitle(value = '') {
  const text = cleanText(value);
  return text.replace(/^[A-Z0-9]{2,}\d*\s*-\s*/, '').trim();
}

function extractMetaValue(html = '', label = '') {
  const normalized = String(html).replace(/\n/g, ' ');
  const matcher = new RegExp(`<b>${label}:<\\/b>\\s*([^<]+)`, 'i');
  const match = normalized.match(matcher);
  return match ? cleanText(match[1]) : '';
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldRetryEventscribeError(error) {
  const status = error?.response?.status;
  const message = String(error?.message || '').toLowerCase();
  return status === 403
    || status === 408
    || status === 429
    || status === 500
    || status === 502
    || status === 503
    || status === 504
    || message.includes('timeout');
}

async function loadEventscribeHTML(url, config) {
  const retryCount = config.retryCount ?? DEFAULT_RETRY_COUNT;
  const requestDelayMs = config.requestDelayMs ?? DEFAULT_REQUEST_DELAY_MS;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    if (requestDelayMs > 0) {
      await wait(requestDelayMs);
    }

    try {
      return await loadHTML(url);
    } catch (error) {
      if (attempt >= retryCount || !shouldRetryEventscribeError(error)) {
        throw error;
      }

      const backoffMs = requestDelayMs * (attempt + 2);
      console.log(`      ⚠️ Retrying ${config.provider} request ${url} after ${backoffMs}ms (${error.message})`);
      await wait(backoffMs);
    }
  }

  throw new Error(`Failed to load ${url}`);
}

async function scrapeSessionDetails(detailUrl, config) {
  const $ = await loadEventscribeHTML(detailUrl, config);
  const title = extractTitle($('h1').first().text());
  const dateText = cleanText($('.pres-tidbit .fa-calendar').parent().text());
  const timeText = cleanText($('.pres-tidbit .fa-clock-o').parent().text());
  const creditsText = cleanText($('.pres-tidbit').filter((_, element) => $(element).text().includes('Credit')).first().text())
    .replace(/^.*Credits?:\s*/i, '')
    .replace(/^.*Earn\s+/i, '');
  const infoHtml = $('.popup_content .mar-top').first().html() || '';
  const topic = extractMetaValue(infoHtml, 'AGD Subject Code')
    || extractMetaValue(infoHtml, 'Track')
    || extractMetaValue(infoHtml, 'Category')
    || extractMetaValue(infoHtml, 'Subject');
  const courseType = extractMetaValue(infoHtml, 'Course Type') || 'Conference Session';
  const fee = extractMetaValue(infoHtml, 'Bundle Fee')
    || extractMetaValue(infoHtml, 'Fee')
    || extractMetaValue(infoHtml, 'Registration Fee');
  const sessionNotes = extractMetaValue(infoHtml, 'Session Notes');
  const locationText = extractMetaValue(infoHtml, 'Location')
    || cleanText($('.pres-tidbit').filter((_, element) => $(element).text().includes('Location')).first().text().replace(/^.*Location:\s*/i, ''));
  const instructors = $('.speakers-wrap .speaker-name')
    .map((_, element) => cleanText($(element).text()))
    .get()
    .filter(Boolean)
    .join('\n');
  const description = cleanMultiline($('.PresentationAbstractText').first().text());

  return {
    title,
    dateText: [dateText, timeText].filter(Boolean).join('\n'),
    startDate: parseSessionDate(dateText),
    creditsText,
    topic,
    courseType,
    fee,
    sessionNotes,
    instructors,
    description,
    locationText: locationText || config.defaultLocation || '',
  };
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

async function extractSchedulePageRows(scheduleUrl, config, seenUrls, results) {
  const $ = await loadEventscribeHTML(scheduleUrl, config);
  const sessionItems = $('li.list-group-item.list-row.loadbyurl').toArray();
  const sessionConcurrency = config.sessionConcurrency || DEFAULT_SESSION_CONCURRENCY;
  const detailUrls = [];

  for (const element of sessionItems) {
    const detailPath = $(element).attr('data-url') || '';
    const detailUrl = absoluteUrl(detailPath, scheduleUrl);
    if (!detailUrl || seenUrls.has(detailUrl)) continue;
    seenUrls.add(detailUrl);
    detailUrls.push(detailUrl);
  }

  const pageRows = await mapWithConcurrency(detailUrls, sessionConcurrency, async (detailUrl) => {
    try {
      const details = await scrapeSessionDetails(detailUrl, config);
      return normalizeCourse({
        provider: config.provider,
        provider_slug: config.providerSlug,
        source_url: scheduleUrl,
        url: detailUrl,
        title: details.title,
        description: details.description,
        course_type: details.courseType,
        format: 'In Person',
        topic: details.topic,
        credits_text: details.creditsText,
        price: details.fee,
        start_date: details.startDate,
        end_date: details.startDate,
        date_text: details.dateText,
        location: details.locationText,
        city: config.city || '',
        state: config.state || '',
        country: config.country || 'USA',
        instructors: details.instructors,
        accreditation: config.accreditation || config.provider,
        requirements: details.sessionNotes,
        tags: ['In Person', 'Conference', config.provider],
        metadata: {
          extracted_from: 'eventscribe-conference',
          detail_url: detailUrl,
          session_notes: details.sessionNotes,
          conference_slug: config.providerSlug,
        },
      });
    } catch (error) {
      console.log(`      ⚠️ Failed to load ${config.provider} session ${detailUrl}: ${error.message}`);
      return null;
    }
  });

  results.push(...pageRows);

  const dayUrls = $('a[href*="agenda.asp?startdate="]')
    .map((_, element) => absoluteUrl($(element).attr('href') || '', scheduleUrl))
    .get()
    .filter(Boolean);

  return [...new Set(dayUrls)];
}

export async function scrapeEventscribeConference(config) {
  console.log(`   • Scraping ${config.provider} public conference catalog`);

  const results = [];
  const seenUrls = new Set();
  const dayUrls = await extractSchedulePageRows(config.startUrl, config, seenUrls, results);

  for (const dayUrl of dayUrls) {
    await extractSchedulePageRows(dayUrl, config, seenUrls, results);
  }

  console.log(`   • Extracted ${results.length} ${config.provider} conference sessions`);
  return results;
}
