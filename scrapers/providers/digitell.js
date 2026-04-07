import axios from 'axios';
import { normalizeCourse } from '../../lib/normalize.js';

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

function toDateString(unixSeconds) {
  if (!unixSeconds) return '';
  const parsed = new Date(Number(unixSeconds) * 1000);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function speakerName(speaker = {}) {
  const fullName = [
    cleanText(speaker.first_name, 80),
    cleanText(speaker.middle_name, 80),
    cleanText(speaker.last_name, 80),
  ].filter(Boolean).join(' ');

  const credentials = cleanText(speaker.credentials, 80);
  return [fullName, credentials].filter(Boolean).join(', ');
}

function flattenItems(items = []) {
  const results = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    results.push(item);
    if (Array.isArray(item.children) && item.children.length > 0) {
      results.push(...flattenItems(item.children));
    }
  }

  return results;
}

function buildTopic(item = {}) {
  const pathTags = (item.ctsTags || [])
    .filter((tag) => ['Path', 'Topic', 'Track', 'Target Audience'].includes(cleanText(tag.label, 80)))
    .flatMap((tag) => Array.isArray(tag.tags) ? tag.tags : [])
    .map((tag) => cleanText(tag.label, 120))
    .filter(Boolean);

  return pathTags[0] || '';
}

function isEducationalSession(item = {}) {
  const title = cleanText(item.title, 250).toLowerCase();
  if (!title) return false;
  if (/registration hours|family room|luggage storage|reflection room|camp aao|e-posters/i.test(title)) return false;

  const hasEducationSignals = Boolean(item.credits?.credit_names || item.speakers?.length || item.objectives?.length);
  return hasEducationSignals;
}

export async function scrapeDigitellConference(config) {
  console.log(`   • Scraping ${config.provider} Digitell conference catalog`);

  const apiUrl = config.apiUrl || `${config.scheduleUrl.replace(/\/$/, '')}/api/sessions`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; CEAtlasBot/1.0)',
    Accept: 'application/json, text/plain, */*',
  };

  const topLevelItems = [];
  const pageLimit = 50;

  for (let offset = 0; offset < 1000; offset += pageLimit) {
    const { data: payload } = await axios.get(apiUrl, {
      headers,
      params: {
        limit: pageLimit,
        offset,
      },
    });

    const pageItems = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

    topLevelItems.push(...pageItems);

    const totalCount = Number.parseInt(payload?.count, 10);
    if (pageItems.length < pageLimit || (Number.isFinite(totalCount) && offset + pageItems.length >= totalCount)) {
      break;
    }
  }

  if (topLevelItems.length === 0) {
    console.log(`   • No session payload found for ${config.provider}`);
    return [];
  }

  const flatItems = flattenItems(topLevelItems);
  const seenIds = new Set();
  const results = [];

  for (const item of flatItems) {
    const itemId = item.id || item.uuid || item.identification;
    const title = cleanText(item.title, 250);
    if (!itemId || !title || seenIds.has(itemId)) continue;
    if (!isEducationalSession(item)) continue;
    seenIds.add(itemId);

    const speakerLines = (item.speakers || [])
      .map((speaker) => speakerName(speaker))
      .filter(Boolean)
      .join('\n');

    const creditsText = cleanText(item.credits?.credit_names, 120)
      || (item.ctsTags || [])
        .find((tag) => cleanText(tag.label, 80) === 'CE Hours')
        ?.tags?.map((tag) => cleanText(tag.label, 40))
        .filter(Boolean)
        .join(', ');

    const objectives = Array.isArray(item.objectives)
      ? item.objectives.map((objective) => cleanText(objective, 300)).filter(Boolean).join('\n')
      : '';

    const topic = buildTopic(item);
    const room = cleanText(item.room, 160);
    const facility = cleanText(item.facility, 160);
    const location = [facility, room].filter(Boolean).join(' • ');

    results.push(normalizeCourse({
      provider: config.provider,
      provider_slug: config.providerSlug,
      source_url: config.scheduleUrl,
      url: `${config.scheduleUrl}#session-${itemId}`,
      title,
      description: cleanMultiline(item.teaser || item.description || ''),
      course_type: 'Conference Session',
      format: config.format || 'In Person',
      topic,
      credits_text: creditsText,
      start_date: toDateString(item.start_time_utc),
      end_date: toDateString(item.end_time_utc),
      date_text: cleanText(item.identification, 80),
      location,
      city: cleanText(config.city, 80),
      state: cleanText(config.state, 80),
      country: cleanText(config.country, 80) || 'USA',
      instructors: speakerLines,
      accreditation: config.accreditation || config.provider,
      requirements: objectives,
      tags: ['Conference', config.provider, config.format || 'In Person'].filter(Boolean),
      metadata: {
        extracted_from: 'digitell-conference',
        item_id: itemId,
        identification: cleanText(item.identification, 80),
        archive_url: cleanText(item.archive_url, 200),
        facility,
        room,
        data_url: cleanText(apiUrl, 200),
      },
    }));
  }

  console.log(`   • Extracted ${results.length} ${config.provider} sessions`);
  return results;
}
