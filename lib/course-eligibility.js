const DEFAULT_TIME_ZONE = 'America/Chicago';
const BLOCKED_SOURCE_PATTERNS = [
  /worlddentalevents\.com/i,
  /allconferencealert/i,
  /conferenceindex\.org/i,
  /dentevents\.com/i,
  /dental-tribune\.com/i,
  /cebroker\.com/i,
];

function cleanText(value) {
  return String(value || '').trim();
}

function parseHost(value) {
  try {
    return new URL(String(value || '')).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function hasCreditSignal(course = {}) {
  const credits = typeof course.credits === 'number' && Number.isFinite(course.credits) ? course.credits : null;
  if (credits !== null && credits > 0) return true;

  const creditsText = cleanText(course.credits_text);
  if (!creditsText) return false;

  return /\b(ce|ceu|cde|credit|credits|hour|hours)\b/i.test(creditsText)
    && !/\b(not specified|n\/a|none|tbd|unknown)\b/i.test(creditsText)
    && !/^\s*0+(?:\.0+)?\s*(ce|ceu|cde|credit|credits|hour|hours)?\s*$/i.test(creditsText);
}

function getTrustSignals(course = {}) {
  const provider = cleanText(course.provider);
  const title = cleanText(course.title);
  const description = cleanText(course.description);
  const instructors = cleanText(course.instructors);
  const accreditation = cleanText(course.accreditation);
  const sourceHost = parseHost(course.source_url);
  const detailHost = parseHost(course.url);
  const metadataText = JSON.stringify(course.metadata || {});
  const combinedSourceText = [sourceHost, detailHost, course.source_url, course.url, metadataText].filter(Boolean).join(' ');

  let score = 0;
  const reasons = [];

  if (!provider || !title) {
    reasons.push('missing_provider_or_title');
  } else {
    score += 1;
  }

  if (!detailHost) {
    reasons.push('missing_detail_url');
  } else {
    score += 1;
  }

  if (BLOCKED_SOURCE_PATTERNS.some((pattern) => pattern.test(combinedSourceText))) {
    reasons.push('blocked_source_pattern');
  }

  if (accreditation && /\b(agd|pace|ada|cerp|continuing education|continuing dental education|school of dentistry|university|academy|association|society|college)\b/i.test(accreditation)) {
    score += 2;
  } else if (accreditation) {
    score += 1;
  }

  if (instructors) {
    score += 1;
  }

  if (description.length >= 80) {
    score += 1;
  }

  if (course.start_date || course.end_date || cleanText(course.date_text)) {
    score += 1;
  }

  return {
    trusted: reasons.length === 0 && score >= 4,
    reasons,
    score,
    sourceHost,
    detailHost,
  };
}

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

export function getCoursePublicationDecision(course = {}, today = getTodayISO()) {
  const timing = getCourseEligibility(course, today);
  if (!timing.eligible) {
    return {
      eligible: false,
      reason: timing.reason,
      reason_code: 'date_ineligible',
    };
  }

  if (!hasCreditSignal(course)) {
    return {
      eligible: false,
      reason: 'missing explicit CE credit',
      reason_code: 'missing_ce_credit',
    };
  }

  const trust = getTrustSignals(course);
  if (!trust.trusted) {
    return {
      eligible: false,
      reason: `failed trust checks (${[...trust.reasons, `score:${trust.score}`].join(', ')})`,
      reason_code: 'untrusted_source',
    };
  }

  return {
    eligible: true,
    reason: timing.reason,
    reason_code: 'eligible',
  };
}

export function filterCurrentOrFutureCourses(courses = [], options = {}) {
  const today = options.today || getTodayISO();
  const skipped = [];
  const rows = [];

  for (const course of courses) {
    const decision = getCoursePublicationDecision(course, today);
    if (decision.eligible) {
      rows.push(course);
    } else {
      skipped.push({
        provider: course.provider || '',
        title: course.title || '',
        start_date: course.start_date || '',
        end_date: course.end_date || '',
        source_url: course.source_url || '',
        url: course.url || '',
        reason: decision.reason,
        reason_code: decision.reason_code,
      });
    }
  }

  return { rows, skipped, today };
}
