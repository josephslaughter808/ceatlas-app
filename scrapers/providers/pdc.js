import axios from 'axios';
import { normalizeCourse } from '../../lib/normalize.js';

const PDC_PROVIDER = 'Pacific Dental Conference';
const PDC_PROVIDER_SLUG = 'pacific-dental-conference';
const PDC_SCHEDULE_URL = 'https://pacificdentalconference.com/schedule/';
const PDC_EVENTS_URL = 'https://pacificdentalconference.com/wp-json/sessionboard/v1/events';

function cleanText(value = '', max = 500) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanMultiline(value = '', max = 2000) {
  return String(value)
    .replace(/\r/g, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, max);
}

function toDateString(value = '') {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function speakerName(speaker = {}) {
  return [
    cleanText(speaker.first_name, 80),
    cleanText(speaker.last_name, 80),
    cleanText(speaker.credentials, 80),
  ].filter(Boolean).join(' ').replace(/\s+,/g, ',');
}

function buildTopic(session = {}) {
  if (session.track?.name) return cleanText(session.track.name, 160);
  if (Array.isArray(session.tags) && session.tags.length > 0) {
    return cleanText(session.tags[0]?.name || '', 160);
  }
  return '';
}

function buildLocation(session = {}) {
  return [
    cleanText(session.location?.name, 120),
    cleanText(session.room?.name, 120),
  ].filter(Boolean).join(' • ');
}

function buildRequirements(session = {}) {
  const customFields = Array.isArray(session.custom_fields)
    ? session.custom_fields
        .map((field) => `${cleanText(field.name, 80)}: ${cleanText(field.value, 240)}`)
        .filter((line) => !/: $/.test(line))
    : [];

  return customFields.join('\n');
}

export async function scrapePDC(startUrl = PDC_SCHEDULE_URL) {
  console.log('   • Scraping Pacific Dental Conference public catalog');

  const { data: events } = await axios.get(PDC_EVENTS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CEAtlasBot/1.0)',
      Accept: 'application/json, text/plain, */*',
    },
  });

  const event = Array.isArray(events) ? events[0] : null;
  if (!event?.id) {
    console.log('   • No Pacific Dental Conference event found');
    return [];
  }

  const sessionsUrl = `https://pacificdentalconference.com/wp-json/sessionboard/v1/event/${event.id}/sessions`;
  const speakersUrl = `https://pacificdentalconference.com/wp-json/sessionboard/v1/event/${event.id}/speakers`;

  const [{ data: sessions }, speakersResponse] = await Promise.all([
    axios.post(
      sessionsUrl,
      { filters: { status: 'accepted' } },
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CEAtlasBot/1.0)',
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
        },
      },
    ),
    axios.get(speakersUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CEAtlasBot/1.0)',
        Accept: 'application/json, text/plain, */*',
      },
      validateStatus: (status) => status < 500,
    }),
  ]);

  const speakers = speakersResponse?.status === 200 ? speakersResponse.data : [];
  if (speakersResponse?.status && speakersResponse.status !== 200) {
    console.log(`   • Speaker directory unavailable for Pacific Dental Conference (status ${speakersResponse.status})`);
  }

  const speakerMap = new Map((Array.isArray(speakers) ? speakers : []).map((speaker) => [String(speaker.id), speaker]));
  const results = [];

  for (const session of Array.isArray(sessions) ? sessions : []) {
    if (!session?.starts_at || !session?.title) continue;
    if (session?.custom_status?.id && session.custom_status.id !== 'c885e2cb-0b31-46d9-84d4-49ea9962fb72') continue;

    const speakerLines = Array.isArray(session.speakers)
      ? session.speakers
          .map((speaker) => speakerMap.get(String(speaker.id)) || speaker)
          .map((speaker) => speakerName(speaker))
          .filter(Boolean)
          .join('\n')
      : '';

    const dateText = [
      cleanText(new Date(session.starts_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'America/Los_Angeles',
      })),
      cleanText(new Date(session.starts_at).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Los_Angeles',
      })),
    ].filter(Boolean).join(' ');

    results.push(normalizeCourse({
      provider: PDC_PROVIDER,
      provider_slug: PDC_PROVIDER_SLUG,
      source_url: startUrl,
      url: `${startUrl}#session-${session.id}`,
      title: cleanText(session.title, 250),
      description: cleanMultiline(session.description || '', 2500),
      course_type: 'Conference Session',
      format: cleanText(session.format?.name, 80) || 'In Person',
      topic: buildTopic(session),
      credits_text: cleanText(session.ceu || session.credits || '', 80),
      start_date: toDateString(session.starts_at),
      end_date: toDateString(session.ends_at || session.starts_at),
      date_text: dateText,
      location: buildLocation(session),
      city: 'Vancouver',
      state: 'BC',
      country: 'Canada',
      instructors: speakerLines,
      accreditation: 'Pacific Dental Conference',
      requirements: buildRequirements(session),
      tags: ['Conference', 'Pacific Dental Conference', cleanText(session.format?.name, 80), buildTopic(session)].filter(Boolean),
      metadata: {
        extracted_from: 'sessionboard',
        event_id: event.id,
        session_id: session.id,
        track: cleanText(session.track?.name, 160),
        tag_names: Array.isArray(session.tags) ? session.tags.map((tag) => cleanText(tag.name, 120)).filter(Boolean) : [],
      },
    }));
  }

  console.log(`   • Extracted ${results.length} Pacific Dental Conference sessions`);
  return results;
}
