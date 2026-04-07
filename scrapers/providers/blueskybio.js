import { normalizeCourse } from '../../lib/normalize.js';

const PROVIDER = 'BlueSkyBio University';
const PROVIDER_SLUG = 'blueskybio-university';
const RECORDED_URL = 'https://www.blueskybio.university/webinarsrecorded';
const COURSES_URL = 'https://www.blueskybio.university/courses';
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

function cleanText(value = '', max = 1800) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#8203;/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function pageText(html = '') {
  return cleanText(html, 1000000);
}

function creditsFrom(text = '') {
  const value = cleanText(text, 500);
  return value.match(/\bCE:\s*(\d+(?:\.\d+)?)/i)?.[1]
    || value.match(/\b(\d+(?:\.\d+)?)\s*(?:CE|credit|credits|hour|hours)\b/i)?.[1]
    || '';
}

function inferTopic(text = '') {
  const value = cleanText(text, 2000).toLowerCase();
  if (/implant|surgical guide|guided surgery|full arch|bone|sinus/.test(value)) return 'Implants';
  if (/endodont|root canal/.test(value)) return 'Endodontics';
  if (/orthodont|aligner|ipr/.test(value)) return 'Orthodontics';
  if (/digital|ct|segmented|scan|3d|software|blue sky plan|cad/.test(value)) return 'Digital Dentistry & Technology';
  if (/prosthetic|restor|denture|crown/.test(value)) return 'Restorative Dentistry';
  if (/periodont|soft tissue|graft/.test(value)) return 'Periodontics';
  return 'General Dentistry';
}

function dateTextFrom(header = '') {
  const match = cleanText(header, 500).match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+20\d{2}(?:,)?\s+\d{1,2}:\d{2}\s+[AP]M(?:\s+Eastern(?:\s+Time)?|\s+\w+)?/i);
  return cleanText(match?.[0] || '', 120);
}

function titleFromHeader(header = '') {
  const withoutDate = cleanText(header, 700).replace(dateTextFrom(header), '').trim();
  const compact = withoutDate
    .replace(/^.*?\b(?:Watch Now|PAST WEBINARS|On-Demand Courses)\b/i, '')
    .trim();
  return cleanText(compact || withoutDate, 250);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      'User-Agent': BROWSER_USER_AGENT,
    },
  });

  if (!response.ok) throw new Error(`BlueSkyBio returned ${response.status} for ${url}`);
  return response.text();
}

function extractRecordedWebinars(html = '') {
  const text = pageText(html);
  const parts = text.split('Course Duration:');
  const rows = [];

  for (let index = 1; index < parts.length; index += 1) {
    const before = parts[index - 1].slice(-700);
    const after = parts[index].slice(0, 3500);
    const title = titleFromHeader(before);
    if (!title || title.length < 8 || /scrollbar|top of page/i.test(title)) continue;

    const duration = cleanText(after.match(/^\s*([^A]+?)\s+AGD Subject Code:/i)?.[1] || '', 80);
    const agdCode = cleanText(after.match(/AGD Subject Code:\s*([0-9]+)/i)?.[1] || '', 40);
    const credits = creditsFrom(after) || (/\b1\s*hour\b/i.test(duration) ? '1' : '');
    const description = cleanText(after.match(/Course Description\s*(.*?)(?:About Presenter|Watch Now|Course Duration:|$)/i)?.[1] || title, 1800);
    const sourceUrl = `${RECORDED_URL}#recorded-${index}`;

    rows.push(normalizeCourse({
      provider: PROVIDER,
      provider_slug: PROVIDER_SLUG,
      source_url: RECORDED_URL,
      url: sourceUrl,
      title,
      description,
      course_type: 'On-Demand Webinar',
      format: 'Online',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(`${title} ${description}`),
      credits_text: credits ? `${credits} CE Credit${credits === '1' ? '' : 's'}` : '',
      price: 'Free',
      date_text: 'On-demand recorded webinar',
      location: 'Online',
      country: 'USA',
      accreditation: agdCode ? `AGD Subject Code: ${agdCode}` : 'BlueSkyBio University',
      tags: ['BlueSkyBio University', 'Online', 'Recorded Webinar'].filter(Boolean),
      metadata: {
        extracted_from: 'blueskybio-recorded-webinars-wix-page',
        original_date_text: dateTextFrom(before) || null,
        duration: duration || null,
        agd_subject_code: agdCode || null,
      },
    }));
  }

  return rows;
}

function extractUpcomingCourses(html = '') {
  const links = [...new Set(
    [...html.matchAll(/href="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((href) => /free-hands-on-surgery-course|coryglenn\.org\/product/i.test(href)),
  )];

  return links.map((url, index) => {
    let title = cleanText(url.split('/').filter(Boolean).pop()?.replace(/-/g, ' '), 250)
      .replace(/\b\w/g, (char) => char.toUpperCase());
    title = title.replace(/\b(?:Burbank California|Hartford Connecticut|Oklahoma City|Phoenix Arizona)\b/i, '').trim() || title;

    return normalizeCourse({
      provider: PROVIDER,
      provider_slug: PROVIDER_SLUG,
      source_url: COURSES_URL,
      url,
      title,
      description: `${title} is listed in BlueSkyBio University's public courses catalog.`,
      course_type: 'Hands-On Course',
      format: 'In Person',
      audience: 'Dentists and Dental Team',
      topic: inferTopic(title),
      price: /free-hands-on/i.test(url) ? 'Free' : 'Paid registration',
      date_text: 'See course page',
      location: 'See course page',
      country: 'USA',
      accreditation: 'BlueSkyBio University',
      tags: ['BlueSkyBio University', 'In Person'].filter(Boolean),
      metadata: {
        extracted_from: 'blueskybio-courses-links',
        listing_index: index + 1,
      },
    });
  });
}

export async function scrapeBlueSkyBio() {
  console.log(`   • Scraping ${PROVIDER}`);
  const [recordedHtml, coursesHtml] = await Promise.all([
    fetchText(RECORDED_URL),
    fetchText(COURSES_URL),
  ]);

  const rows = [...extractRecordedWebinars(recordedHtml), ...extractUpcomingCourses(coursesHtml)];
  const deduped = [];
  const seen = new Set();

  for (const row of rows) {
    const key = row.url || `${row.provider}::${row.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  console.log(`   • Extracted ${deduped.length} ${PROVIDER} rows`);
  return deduped;
}
