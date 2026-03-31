import { loadHTML } from '../../lib/fetch.js';
import { normalizeCourse } from '../../lib/normalize.js';

const AGD_PROVIDER = 'AGD';
const AGD_SCHEDULE_URL = 'https://agd2026.eventscribe.net/agenda.asp?pfp=FullSchedule';
const AGD_BASE_URL = 'https://agd2026.eventscribe.net';

function absoluteUrl(value = '') {
  if (!value) return '';
  try {
    return new URL(value, AGD_BASE_URL).href;
  } catch {
    return '';
  }
}

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

function parseSessionDate(value = '') {
  const match = cleanText(value).match(/([A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})/);
  if (!match) return '';

  const parsed = new Date(match[1]);
  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toISOString().slice(0, 10);
}

function extractTitle(value = '') {
  const text = cleanText(value);
  return text.replace(/^[A-Z0-9]{3,}\d+\s*-\s*/, '').trim();
}

function extractMetaValue(html = '', label = '') {
  const normalized = String(html).replace(/\n/g, ' ');
  const matcher = new RegExp(`<b>${label}:<\\/b>\\s*([^<]+)`, 'i');
  const match = normalized.match(matcher);
  return match ? cleanText(match[1]) : '';
}

async function scrapeSessionDetails(detailUrl) {
  const $ = await loadHTML(detailUrl);
  const title = extractTitle($('h1').first().text());
  const dateText = cleanText($('.pres-tidbit .fa-calendar').parent().text());
  const timeText = cleanText($('.pres-tidbit .fa-clock-o').parent().text());
  const creditsText = cleanText($('.pres-tidbit').filter((_, element) => $(element).text().includes('Credits')).first().text())
    .replace(/^.*Credits:\s*/i, '');
  const infoHtml = $('.popup_content .mar-top').first().html() || '';
  const subjectCode = extractMetaValue(infoHtml, 'AGD Subject Code');
  const courseType = extractMetaValue(infoHtml, 'Course Type');
  const bundleFee = extractMetaValue(infoHtml, 'Bundle Fee');
  const sessionNotes = extractMetaValue(infoHtml, 'Session Notes');
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
    subjectCode,
    courseType,
    bundleFee,
    sessionNotes,
    instructors,
    description,
  };
}

async function extractSchedulePageRows(scheduleUrl, seenUrls, results) {
  const $ = await loadHTML(scheduleUrl);
  const sessionItems = $('li.list-group-item.list-row.loadbyurl').toArray();

  for (const element of sessionItems) {
    const detailPath = $(element).attr('data-url') || '';
    const detailUrl = absoluteUrl(detailPath);
    if (!detailUrl || seenUrls.has(detailUrl)) continue;
    seenUrls.add(detailUrl);

    try {
      const details = await scrapeSessionDetails(detailUrl);
      results.push(normalizeCourse({
        provider: AGD_PROVIDER,
        provider_slug: 'agd',
        source_url: scheduleUrl,
        url: detailUrl,
        title: details.title,
        description: details.description,
        course_type: details.courseType || 'Conference Session',
        format: 'In Person',
        topic: details.subjectCode,
        credits_text: details.creditsText,
        price: details.bundleFee,
        start_date: details.startDate,
        end_date: details.startDate,
        date_text: details.dateText,
        location: 'Las Vegas, NV',
        city: 'Las Vegas',
        state: 'NV',
        country: 'USA',
        instructors: details.instructors,
        accreditation: 'Academy of General Dentistry',
        requirements: details.sessionNotes,
        tags: ['In Person', 'Conference', 'AGD2026'],
        metadata: {
          extracted_from: 'agd-eventscribe',
          detail_url: detailUrl,
          subject_code: details.subjectCode,
          session_notes: details.sessionNotes,
        },
      }));
    } catch (error) {
      console.log(`      ⚠️ Failed to load AGD session ${detailUrl}: ${error.message}`);
    }
  }

  const dayUrls = $('a[href*="agenda.asp?startdate="]')
    .map((_, element) => absoluteUrl($(element).attr('href') || ''))
    .get()
    .filter(Boolean);

  return [...new Set(dayUrls)];
}

export async function scrapeAGD(startUrl = AGD_SCHEDULE_URL) {
  console.log('   • Scraping AGD public conference catalog');

  const results = [];
  const seenUrls = new Set();
  const dayUrls = await extractSchedulePageRows(startUrl, seenUrls, results);

  for (const dayUrl of dayUrls) {
    await extractSchedulePageRows(dayUrl, seenUrls, results);
  }

  console.log(`   • Extracted ${results.length} AGD conference sessions`);
  return results;
}
