import axios from 'axios';
import { normalizeCourse } from '../../lib/normalize.js';

const TEMPLE_PROVIDER = 'Temple Dental CE';
const TEMPLE_PROVIDER_SLUG = 'temple-dental-ce';
const TEMPLE_SOURCE_URL = 'https://noncredit.temple.edu/cde';
const TEMPLE_SEARCH_URL = 'https://templews.destinysolutions.com/webservice/PublicViewREST/searchCourseSection?informationLevel=Full';

function cleanText(value = '', max = 1200) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function normalizeDate(value = '') {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function inferTopic(text = '') {
  const value = cleanText(text, 500).toLowerCase();
  if (/implant/.test(value)) return 'Implants';
  if (/endodont/.test(value)) return 'Endodontics';
  if (/orthodont/.test(value)) return 'Orthodontics';
  if (/periodont/.test(value)) return 'Periodontics';
  if (/maintenance/.test(value)) return 'Preventive Dentistry';
  if (/opioid|pain|pharmac/.test(value)) return 'Pharmacology';
  if (/sleep|airway/.test(value)) return 'Sleep & Airway';
  return 'General Dentistry';
}

function inferFormat(section = {}) {
  if (section.distanceLearning) return 'Online';

  const scheduleType = cleanText(section?.sectionScheduleDetails?.sectionScheduleDetail?.scheduleType || '', 160).toLowerCase();
  const instructionMethod = cleanText(section?.instructionMethods?.instructionMethod?.description || '', 160).toLowerCase();

  if (/online|zoom|distance/.test(scheduleType) || /online|zoom|distance/.test(instructionMethod)) return 'Online';
  if (/hybrid/.test(scheduleType) || /hybrid/.test(instructionMethod)) return 'Hybrid';
  return 'In Person';
}

function extractPrice(sectionFee = {}) {
  const options = sectionFee?.sectionFeeTuitionProfiles?.sectionFeeTuitionProfile || sectionFee?.flatFeeTuitionProfile || [];
  const feeList = Array.isArray(options) ? options : [options];
  const parts = [];

  for (const option of feeList) {
    const profile = option?.associatedTuitionProfile || option;
    const label = cleanText(profile?.publishedCode || profile?.publishCode || profile?.description || '', 120);
    const amount = profile?.tuitionFees?.tuitionFee?.tuitionFeeItems?.tuitionFeeItem?.amount;
    if (label && amount) {
      parts.push(`${label}: $${amount}`);
    } else if (amount) {
      parts.push(`$${amount}`);
    }
  }

  return parts.join(' • ');
}

function requestPayload() {
  return {
    searchCourseSectionProfileRequestDetail: {
      paginationConstruct: {
        pageNumber: '1',
        pageSize: '250',
      },
      courseSectionSearchCriteria: {
        searchOnlyScheduledCoursesFlag: 'true',
        returnOnlyAvailableSectionsFlag: 'true',
        programOffices: {
          programOfficeCode: 'PO0011',
        },
        advancedCriteria: {
          courseCategories: {
            courseCategoryCode: 'CC0005',
          },
        },
      },
    },
  };
}

export async function scrapeTemple() {
  console.log('   • Scraping Temple Dental CE');

  const { data } = await axios.post(TEMPLE_SEARCH_URL, requestPayload(), {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    timeout: 30000,
  });

  const sections = data?.SearchCourseSectionProfileResult?.courseSectionProfiles?.courseSectionProfile || [];
  const rows = (Array.isArray(sections) ? sections : [sections])
    .filter(Boolean)
    .map((section) => {
      const associatedCourse = section.associatedCourse || {};
      const detailUrl = `https://noncredit.temple.edu/search/publicCourseSearchDetails.do?method=load&courseId=${associatedCourse.objectId}`;
      const schedule = section.sectionScheduleDetails?.sectionScheduleDetail || {};
      const format = inferFormat(section);
      const title = cleanText(section.sectionTitle || associatedCourse.name, 250);
      const startDate = normalizeDate(section.sectionStartDate || '');
      const endDate = normalizeDate(section.sectionEndDate || '');
      const dateText = [schedule.date, schedule.time].filter(Boolean).join(' • ');
      const location = cleanText(schedule.location || section.associatedCampuses?.name || '', 220)
        || (format === 'Online' ? 'Online' : 'Temple University Kornberg School of Dentistry');
      const credits = section.overrideMaximumCEUnit || section.maxCEUnit || section.minCEUnit || '';

      return normalizeCourse({
        provider: TEMPLE_PROVIDER,
        provider_slug: TEMPLE_PROVIDER_SLUG,
        source_url: TEMPLE_SOURCE_URL,
        url: detailUrl,
        title,
        description: cleanText(`${associatedCourse.name || title} offered through Temple University Kornberg School of Dentistry Continuing Education.`, 1800),
        course_type: format === 'Online' ? 'Online Course' : format === 'Hybrid' ? 'Hybrid Course' : 'Live Course',
        format,
        audience: 'Dentists and Dental Team',
        topic: inferTopic(`${title} ${associatedCourse.name || ''}`),
        credits,
        credits_text: credits ? `${credits} credits` : '',
        price: extractPrice(section.courseSectionFees?.courseSectionFee),
        start_date: startDate,
        end_date: endDate,
        date_text: cleanText(dateText || [section.sectionStartDate, section.sectionEndDate].filter(Boolean).join(' - '), 200),
        location,
        city: cleanText(section.associatedBuildings?.city || '', 120) || 'Philadelphia',
        state: cleanText(section.associatedBuildings?.provinceCode || '', 80) || 'PA',
        country: 'USA',
        instructors: cleanText(schedule.instructors || '', 240),
        accreditation: 'Temple University Kornberg School of Dentistry',
        tags: ['Temple', inferTopic(title), format].filter(Boolean),
        metadata: {
          extracted_from: 'temple-onece-public-api',
          course_number: associatedCourse.courseNumber || '',
          campus: section.associatedCampuses?.name || '',
          availability: section.sectionAvailabilityStatus?.message || '',
          instruction_method: section.instructionMethods?.instructionMethod?.description || '',
        },
      });
    })
    .filter((row) => row.title && row.url);

  console.log(`   • Extracted ${rows.length} Temple Dental CE rows`);
  return rows;
}
