const DEFAULT_TIME_ZONE = 'America/Chicago';

function dateOnly(value) {
  const match = String(value || '').match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return match?.[1] || '';
}

export function getTodayISO(date = new Date(), timeZone = process.env.CEATLAS_TIME_ZONE || DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isSelfPacedOrEvergreen(course = {}) {
  const value = [
    course.format,
    course.course_type,
    course.date_text,
    course.metadata?.availability,
  ].filter(Boolean).join(' ').toLowerCase();

  return /\b(evergreen|on[-\s]?demand|self[-\s]?paced|asynchronous|available until|expires?|expiration|published|release date|online ce|online course)\b/.test(value);
}

export function getCourseEligibility(course = {}, today = getTodayISO()) {
  const startDate = dateOnly(course.start_date);
  const endDate = dateOnly(course.end_date);

  if (endDate && endDate < today) {
    return {
      eligible: false,
      reason: `ended ${endDate}`,
    };
  }

  if (startDate) {
    if (startDate >= today) {
      return { eligible: true, reason: 'future start date' };
    }

    if (endDate && endDate >= today) {
      return { eligible: true, reason: 'active date range' };
    }

    if (isSelfPacedOrEvergreen(course)) {
      return { eligible: true, reason: 'self-paced or evergreen' };
    }

    return {
      eligible: false,
      reason: `started ${startDate}`,
    };
  }

  if (endDate) {
    return endDate >= today
      ? { eligible: true, reason: 'future end date' }
      : { eligible: false, reason: `ended ${endDate}` };
  }

  return { eligible: true, reason: 'no concrete session date' };
}

export function filterCurrentOrFutureCourses(courses = [], options = {}) {
  const today = options.today || getTodayISO();
  const skipped = [];
  const rows = [];

  for (const course of courses) {
    const eligibility = getCourseEligibility(course, today);
    if (eligibility.eligible) {
      rows.push(course);
    } else {
      skipped.push({
        provider: course.provider || '',
        title: course.title || '',
        start_date: course.start_date || '',
        end_date: course.end_date || '',
        reason: eligibility.reason,
      });
    }
  }

  return { rows, skipped, today };
}
