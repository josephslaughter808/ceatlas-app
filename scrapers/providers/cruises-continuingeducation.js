import { loadHTML } from '../../lib/fetch.js';

const SCHEDULE_URL = 'https://www.continuingeducation.net/schedule.php?profession=Dentists';

function cleanText(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanMultiline(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function firstJsonLdMatching($, predicate) {
  const nodes = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text().trim();
    if (!raw) return;

    try {
      nodes.push(JSON.parse(raw));
    } catch {
      return;
    }
  });

  return nodes.find(predicate) || null;
}

function money(amount) {
  if (amount === null || amount === undefined || amount === '') return '';
  const number = Number(amount);
  if (!Number.isFinite(number)) return '';
  return `$${number.toFixed(number % 1 === 0 ? 0 : 2)}`;
}

function summarizePrice(offers = []) {
  const normalized = offers
    .map((offer) => ({
      audience: cleanText(offer.name, 80),
      amount: Number(offer.price),
    }))
    .filter((offer) => offer.audience && Number.isFinite(offer.amount));

  if (normalized.length === 0) {
    return { cardPrice: null, detailPrice: null };
  }

  const sorted = [...normalized].sort((a, b) => a.amount - b.amount);
  const detailPrice = normalized
    .map((offer) => `${offer.audience}: ${money(offer.amount)}`)
    .join(' | ');

  return {
    cardPrice: normalized.length > 1 ? `From ${money(sorted[0].amount)}` : `${sorted[0].audience}: ${money(sorted[0].amount)}`,
    detailPrice,
  };
}

function summarizeItinerary(subEvent) {
  const ports = subEvent?.itinerary?.itemListElement || [];
  const portNames = ports
    .map((entry) => cleanText(entry?.item?.name, 120))
    .filter(Boolean);

  return {
    ship: cleanText(subEvent?.location?.name, 120) || cleanText(subEvent?.provider?.name, 120),
    itinerary: portNames.join(' | '),
  };
}

async function scrapeCruiseDetail(url) {
  const $ = await loadHTML(url);
  const eventNode = firstJsonLdMatching($, (node) => node?.['@type'] === 'Event');
  const courseNode = Array.isArray(eventNode?.subEvent)
    ? eventNode.subEvent.find((entry) => Array.isArray(entry?.['@type']) && entry['@type'].includes('Course'))
    : null;
  const cruiseNode = Array.isArray(eventNode?.subEvent)
    ? eventNode.subEvent.find((entry) => Array.isArray(entry?.['@type']) && entry['@type'].includes('BoatTrip'))
    : null;

  const performers = Array.isArray(eventNode?.performer) ? eventNode.performer : [];
  const instructor = cleanText(performers[0]?.name, 160);
  const price = summarizePrice(courseNode?.offers?.offers || []);
  const itinerary = summarizeItinerary(cruiseNode);

  return {
    title: cleanText(eventNode?.name || courseNode?.name, 250),
    description: cleanMultiline(eventNode?.description || courseNode?.description || $('meta[name="description"]').attr('content') || ''),
    startDate: cleanText(eventNode?.startDate, 60),
    endDate: cleanText(eventNode?.endDate, 60),
    ship: itinerary.ship,
    itinerary: itinerary.itinerary,
    creditsText: cleanText(courseNode?.educationalCredentialAwarded?.[0]?.name || '', 120),
    audience: cleanText(eventNode?.audience?.audienceType || '', 180),
    instructor,
    providerName: 'Continuing Education, Inc.',
    providerUrl: 'https://www.continuingeducation.net/',
    cardPrice: price.cardPrice,
    detailPrice: price.detailPrice,
    location: cleanText(cruiseNode?.location?.name || eventNode?.location?.containedInPlace?.name || '', 180),
  };
}

export async function scrapeContinuingEducationCruises() {
  const $ = await loadHTML(SCHEDULE_URL);
  const itemList = firstJsonLdMatching($, (node) => node?.['@type'] === 'ItemList');
  const items = itemList?.itemListElement || [];
  const rows = [];

  for (const entry of items) {
    const item = entry?.item;
    if (!item?.url) continue;
    try {
      const detail = await scrapeCruiseDetail(item.url);
      rows.push({
        id: `cei-${entry.position || rows.length + 1}`,
        provider_name: detail.providerName,
        provider_url: detail.providerUrl,
        title: detail.title,
        description: detail.description,
        topic: cleanText(item.name, 180),
        start_date: detail.startDate,
        end_date: detail.endDate,
        ship: detail.ship,
        itinerary: detail.itinerary,
        credits_text: detail.creditsText,
        audience: detail.audience,
        instructor_display: detail.instructor,
        card_price: detail.cardPrice,
        detail_price: detail.detailPrice,
        location: detail.location,
        url: item.url,
      });
    } catch (error) {
      console.log(`      ⚠️ Failed to load cruise detail ${item.url}: ${error.message}`);
    }
  }

  console.log(`   • Extracted ${rows.length} cruise programs from Continuing Education, Inc.`);
  return rows;
}
