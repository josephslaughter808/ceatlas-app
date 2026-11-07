import axios from 'axios';
import { normalizeCourse } from '../../lib/normalize.js';

const SOURCE_URL = 'https://www.koiscenter.com/courses/';
const AJAX_URL = 'https://www.koiscenter.com/wp-admin/admin-ajax.php';
const BROWSER_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
};

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

function extractCourseDetails(html) {
  const start = html.indexOf('courseDetails=');
  const end = html.indexOf(' ;', start);
  if (start < 0 || end < 0) throw new Error('Kois catalogue did not expose course details');
  return JSON.parse(html.slice(start + 'courseDetails='.length, end).trim());
}

function isoDate(timestamp) {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function inferTopic(course) {
  const distinction = cleanText(course.courseDistinctionName, 100);
  if (distinction) return distinction;
  const title = cleanText(course.title, 250).toLowerCase();
  if (/periodont|gum/.test(title)) return 'Periodontics';
  if (/implant|surg/.test(title)) return 'Implant Dentistry';
  if (/occlusion|functional|tmd/.test(title)) return 'Occlusion & TMD';
  if (/esthetic|aesthetic|smile/.test(title)) return 'Esthetic Dentistry';
  if (/digital|treatment planning/.test(title)) return 'Digital Dentistry & Technology';
  return 'General Dentistry';
}

function extractPrerequisites(course) {
  const text = cleanText(course.courseDetails, 3000);
  const match = text.match(/Prerequisites?\s*:?[\s-]*(.+?)(?=Course (?:Dates|Schedule|Details)|Tuition|CE Credits|$)/i);
  return cleanText(match?.[1] || '', 500);
}

function buildCourse(course, instance) {
  const row = instance?.Timber_Post || {};
  const startDate = isoDate(row.course_start_timestamp);
  const endDate = isoDate(row.course_end_timestamp) || startDate;
  const credits = Number(course.ceCredits);
  const price = Number(course.coursePrice);
  const title = cleanText(course.title, 250);
  const topic = inferTopic(course);
  const instructors = Array.isArray(course.instructors)
    ? course.instructors.map((instructor) => cleanText(instructor.Name, 100)).filter(Boolean)
    : [];
  const prerequisites = extractPrerequisites(course);
  const openSeats = Number(row.participant_open_seats);

  return normalizeCourse({
    provider: 'Kois Center',
    provider_slug: 'kois-center',
    source_url: SOURCE_URL,
    url: cleanText(row.link, 500) || `${SOURCE_URL}${course.postName}/`,
    title,
    description: cleanText(course.postContent || course.courseDetails),
    course_type: 'Advanced Clinical Education',
    format: 'In Person',
    audience: 'Dentists',
    topic,
    credits,
    credits_text: `${credits} CE Credits`,
    price: Number.isFinite(price) ? `$${price.toLocaleString('en-US')}` : '',
    price_amount: Number.isFinite(price) ? price : null,
    currency: 'USD',
    start_date: startDate,
    end_date: endDate,
    date_text: startDate === endDate ? startDate : `${startDate} – ${endDate}`,
    location: 'Seattle, WA',
    city: 'Seattle',
    state: 'WA',
    country: 'USA',
    accreditation: 'Kois Center Continuing Dental Education',
    prerequisites,
    tags: ['Kois Center', 'In Person', topic, ...instructors].filter(Boolean),
    metadata: {
      extracted_from: 'kois-public-course-api',
      course_number: cleanText(course.courseNumber, 30),
      course_record_id: cleanText(course.methodRecordId, 40),
      instance_record_id: cleanText(row.method_record_id, 40),
      agd_credit_allocation: cleanText(course.agdCreditAllocation, 200),
      instructors,
      prerequisites,
      participant_open_seats: Number.isFinite(openSeats) ? openSeats : null,
      availability_status: Number.isFinite(openSeats) && openSeats > 0 ? 'available' : 'waitlist_or_restricted',
      image_url: cleanText(course.heroImage?.sizes?.['course-feature'] || course.heroImage?.url, 500),
    },
  });
}

export async function scrapeKois() {
  console.log('   • Scraping Kois Center catalogue and public session API');
  const { data: html } = await axios.get(SOURCE_URL, {
    timeout: 60000,
    headers: BROWSER_HEADERS,
  });
  const details = Object.values(extractCourseDetails(String(html)));
  const eligible = details.filter((course) => Number(course.ceCredits) > 0 && course.methodRecordId);

  const responses = await Promise.all(eligible.map(async (course) => {
    try {
      const body = new URLSearchParams({
        action: 'fetch_course_details_sections_data',
        templateId: String(course.methodRecordId),
        sections: 'future',
      });
      const { data } = await axios.post(AJAX_URL, body.toString(), {
        timeout: 60000,
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          ...BROWSER_HEADERS,
          origin: 'https://www.koiscenter.com',
          referer: SOURCE_URL,
        },
      });
      return { course, instances: Array.isArray(data?.futureCourses) ? data.futureCourses : [] };
    } catch (error) {
      console.warn(`   • Kois course ${course.courseNumber || course.title} failed: ${error.message}`);
      return { course, instances: [] };
    }
  }));

  const now = Date.now();
  const results = responses.flatMap(({ course, instances }) => instances
    .filter((instance) => Number(instance?.Timber_Post?.course_end_timestamp) * 1000 >= now)
    .map((instance) => buildCourse(course, instance)));
  console.log(`   • Extracted ${results.length} future Kois sessions from ${eligible.length} credited courses`);
  return results;
}
