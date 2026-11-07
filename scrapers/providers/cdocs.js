import axios from 'axios';
import { normalizeCourse } from '../../lib/normalize.js';

const CDOCS_PROVIDER = 'CDOCS';
const CDOCS_APP_URL = 'https://app.cdocs.com';
const CDOCS_SOURCE_URL = `${CDOCS_APP_URL}/events/workshops`;
const CDOCS_GRAPHQL_URL = process.env.CDOCS_GRAPHQL_URL
  || 'https://ruqhbjtvtzdg7nafr7b7h3mqzu.appsync-api.us-east-1.amazonaws.com/graphql';
// This is the public AppSync key shipped to browsers by the CDOCS web app.
const CDOCS_GRAPHQL_KEY = process.env.CDOCS_GRAPHQL_KEY
  || 'da2-jh55apuiuze7xhiw6mxyfbngui';

const CAMPUS_EVENTS_QUERY = `
  query GetCampusEvents($future: Boolean, $allEvents: Boolean, $scope: String) {
    getAllEvents(future: $future, allEvents: $allEvents, scope: $scope) {
      id title description teaser presenterIds scope brand type slug timezone
      details {
        price thumbnailPath thumbnailUrl heroUrl credits
        eventDates {
          id startDate endDate allocated available length location timezone
          venue { name address websiteUrl }
        }
      }
    }
  }
`;

function cleanText(value = '', max = 500) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function dateOnly(value = '') {
  return String(value).match(/\d{4}-\d{2}-\d{2}/)?.[0] || '';
}

function parseLocation(value = '', venueAddress = '') {
  const location = cleanText(value, 160);
  const combined = `${location} ${cleanText(venueAddress, 300)}`;

  if (/\bToronto\b|\bOntario\b|\bON\b.*\bCanada\b/i.test(combined)) {
    return { city: 'Toronto', state: 'ON', country: 'Canada' };
  }

  const cityState = location.match(/^(.+?),\s*([A-Z]{2})$/);
  if (cityState) {
    return { city: cleanText(cityState[1], 100), state: cityState[2], country: 'USA' };
  }

  return { city: location, state: '', country: '' };
}

function inferTopic(title = '') {
  const value = cleanText(title, 300).toLowerCase();
  if (/aligner|orthodont/.test(value)) return 'Orthodontics';
  if (/implant|graft|surg/.test(value)) return 'Implant Dentistry';
  if (/cone beam|cbct|diagnostic|imaging/.test(value)) return 'Cone Beam & Imaging';
  if (/sleep|airway|apnea/.test(value)) return 'Sleep & Airway';
  if (/esthetic|aesthetic|smile|restor|cad\/?cam|cerec|digital|denture/.test(value)) {
    return 'Digital Dentistry & Technology';
  }
  if (/practice|business|team|leadership/.test(value)) return 'Practice Management';
  return 'General Dentistry';
}

function buildCourse(event, session) {
  const details = event.details || {};
  const venue = session.venue || {};
  const title = cleanText(event.title, 250);
  const topic = inferTopic(title);
  const location = cleanText(session.location || venue.name, 160);
  const geo = parseLocation(location, venue.address);
  const startDate = dateOnly(session.startDate);
  const endDate = dateOnly(session.endDate) || startDate;
  const credits = Number(details.credits);
  const price = Number(details.price);
  const available = Number(session.available);
  const allocated = Number(session.allocated);
  const soldOut = Number.isFinite(available) && available <= 0;

  return normalizeCourse({
    provider: CDOCS_PROVIDER,
    provider_slug: 'cdocs',
    source_url: CDOCS_SOURCE_URL,
    url: `${CDOCS_APP_URL}/events/workshops/${event.slug}`,
    title,
    description: cleanText(event.description || event.teaser, 2000),
    course_type: 'Hands-On Workshop',
    format: 'In Person',
    audience: /assistant/i.test(title) ? 'Dental Assistants' : 'Dentists',
    topic,
    credits: Number.isFinite(credits) ? credits : null,
    credits_text: Number.isFinite(credits) ? `${credits} CE Credits` : '',
    price: Number.isFinite(price) ? `$${price.toLocaleString('en-US')}` : '',
    price_amount: Number.isFinite(price) ? price : null,
    currency: geo.country === 'Canada' ? 'CAD' : 'USD',
    start_date: startDate,
    end_date: endDate,
    date_text: [startDate === endDate ? startDate : `${startDate} – ${endDate}`, location].filter(Boolean).join(' • '),
    location,
    city: geo.city,
    state: geo.state,
    country: geo.country,
    accreditation: 'CDOCS Continuing Dental Education',
    venue_address: venue.address,
    tags: ['CDOCS', 'Hands-On Workshop', 'In Person', topic, location].filter(Boolean),
    metadata: {
      extracted_from: 'cdocs-public-app-api',
      event_id: event.id,
      event_date_id: session.id,
      slug: event.slug,
      brand: event.brand,
      event_type: event.type,
      timezone: session.timezone || event.timezone,
      available_seats: Number.isFinite(available) ? available : null,
      allocated_seats: Number.isFinite(allocated) ? allocated : null,
      availability_status: soldOut ? 'sold_out' : 'available',
      image_url: cleanText(details.heroUrl || details.thumbnailUrl, 500),
      presenter_ids: Array.isArray(event.presenterIds) ? event.presenterIds : [],
    },
  });
}

export async function scrapeCDOCS() {
  console.log('   • Scraping CDOCS public workshop API');
  const { data } = await axios.post(
    CDOCS_GRAPHQL_URL,
    {
      query: CAMPUS_EVENTS_QUERY,
      variables: { future: true, allEvents: true, scope: 'campus' },
    },
    {
      timeout: 60000,
      headers: {
        'content-type': 'application/json',
        'x-api-key': CDOCS_GRAPHQL_KEY,
        'user-agent': 'Mozilla/5.0 (compatible; CEAtlasBot/1.0)',
      },
    },
  );

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    throw new Error(data.errors.map((error) => error.message).filter(Boolean).join('; ') || 'CDOCS API returned an error');
  }

  const events = Array.isArray(data?.data?.getAllEvents) ? data.data.getAllEvents : [];
  const cdocsEvents = events.filter((event) => (
    cleanText(event.brand).toLowerCase() === 'cdocs'
    && cleanText(event.type).toLowerCase() === 'workshop'
  ));
  const results = [];
  const seen = new Set();

  for (const event of cdocsEvents) {
    const sessions = Array.isArray(event.details?.eventDates) ? event.details.eventDates : [];
    for (const session of sessions) {
      const key = `${event.id}|${session.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(buildCourse(event, session));
    }
  }

  console.log(`   • Extracted ${results.length} sessions from ${cdocsEvents.length} CDOCS workshops`);
  return results;
}
