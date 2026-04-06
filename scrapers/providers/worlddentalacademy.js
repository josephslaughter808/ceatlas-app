import { normalizeCourse } from '../../lib/normalize.js';

const API_BASE = 'https://courses.worlddentalacademy.com/wp-json/tribe/events/v1/events';
const TODAY = new Date().toISOString().slice(0, 10);

function cleanText(value = '', max = 2000) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function inferTopic(text = '') {
  const value = cleanText(text, 800).toLowerCase();
  if (/implant|full-arch|sinus lift/.test(value)) return 'Implants';
  if (/aligner|orthodont/.test(value)) return 'Orthodontics';
  if (/sleep|airway/.test(value)) return 'Sleep & Airway';
  if (/restorative|veneer|ceramic/.test(value)) return 'Restorative Dentistry';
  if (/denture/.test(value)) return 'Prosthodontics';
  return 'General Dentistry';
}

async function loadPage(page = 1) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: '50',
    start_date: `${TODAY} 00:00:00`,
    end_date: '2028-12-31 23:59:59',
    status: 'publish',
  });
  const response = await fetch(`${API_BASE}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`World Dental Academy API failed with ${response.status}`);
  }
  return response.json();
}

export async function scrapeWorldDentalAcademy() {
  console.log('   • Scraping World Dental Academy API');

  const firstPage = await loadPage(1);
  const totalPages = Number(firstPage.total_pages || 1);
  const events = [...(firstPage.events || [])];

  for (let page = 2; page <= totalPages; page += 1) {
    const data = await loadPage(page);
    events.push(...(data.events || []));
  }

  const rows = events
    .filter((event) => event?.title && event?.url)
    .map((event) => {
      const venue = event.venue || {};
      const organizer = Array.isArray(event.organizer) ? event.organizer[0] : null;
      const description = cleanText(event.description || event.excerpt || '', 1800);
      const categoryNames = Array.isArray(event.categories)
        ? event.categories.map((category) => cleanText(category.name, 80)).filter(Boolean)
        : [];

      return normalizeCourse({
        provider: 'World Dental Academy',
        provider_slug: 'world-dental-academy',
        source_url: 'https://courses.worlddentalacademy.com/courses/',
        url: event.url,
        title: cleanText(event.title, 250),
        description: description || `World Dental Academy course: ${cleanText(event.title, 200)}.`,
        course_type: categoryNames[0] || 'Course',
        format: event.is_virtual ? 'Online' : 'In Person',
        audience: 'Dentists and Dental Team',
        topic: inferTopic(`${event.title} ${description}`),
        price: cleanText(event.cost || '', 80),
        start_date: cleanText(event.start_date || '', 20).slice(0, 10),
        end_date: cleanText(event.end_date || '', 20).slice(0, 10),
        date_text: [
          cleanText(event.start_date || '', 20).slice(0, 10),
          cleanText(event.end_date || '', 20).slice(0, 10),
        ].filter(Boolean).join(' - '),
        location: venue.venue
          ? [cleanText(venue.venue, 120), cleanText(venue.city, 120), cleanText(venue.country, 120)].filter(Boolean).join(', ')
          : cleanText(venue.country || (event.is_virtual ? 'Online' : ''), 120),
        city: cleanText(venue.city || '', 120),
        state: cleanText(venue.state || venue.stateprovince || '', 120),
        country: cleanText(venue.country || '', 120),
        instructors: cleanText(organizer?.organizer || '', 180),
        accreditation: 'World Dental Academy',
        tags: ['World Dental Academy', ...categoryNames, cleanText(venue.country || '', 80)].filter(Boolean),
        metadata: {
          extracted_from: 'world-dental-academy-api',
          venue,
          organizer,
          categories: categoryNames,
        },
      });
    });

  console.log(`   • Extracted ${rows.length} World Dental Academy rows`);
  return rows;
}
