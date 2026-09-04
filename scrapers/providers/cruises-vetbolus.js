import { loadHTML } from '../../lib/fetch.js';

const PAGES = ['https://vetbolus.com/alaska-2027/'];

export async function scrapeVetBolusCruises() {
  const rows = [];
  const today = new Date().toISOString().slice(0, 10);
  for (const url of PAGES) {
    const $ = await loadHTML(url);
    let event;
    $('script[type="application/ld+json"]').each((_, node) => {
      try { const parsed = JSON.parse($(node).text()); if (parsed?.['@type'] === 'Event') event = parsed; } catch { /* ignore invalid publisher JSON */ }
    });
    if (!event || event.endDate < today || !/RACE-approved/i.test(event.description || '')) continue;
    const offer = Array.isArray(event.offers) ? event.offers[0] : event.offers;
    rows.push({
      id: `vetbolus-${event.startDate}`,
      provider_name: event.organizer?.name || 'VetBolus',
      provider_url: event.organizer?.url || 'https://vetbolus.com/',
      title: event.name,
      description: event.description,
      topic: 'Veterinary Dermatology; Emergency & Critical Care',
      start_date: event.startDate,
      end_date: event.endDate,
      ship: 'Royal Princess',
      itinerary: 'Seattle | Juneau | Skagway | Glacier Bay | Ketchikan | Victoria | Seattle',
      credits_text: '15 RACE-approved CE hours',
      audience: 'Veterinarians and Veterinary Technicians',
      instructor_display: '',
      card_price: offer?.price ? `From $${offer.price}` : '',
      detail_price: offer?.price ? `Conference registration: $${offer.price}` : '',
      location: 'Alaska — round-trip Seattle, Washington',
      url,
      disciplines: ['Veterinary Medicine'],
      accreditation: 'AAVSB RACE approved',
    });
  }
  console.log(`   • Extracted ${rows.length} current accredited veterinary cruise program from VetBolus.`);
  return rows;
}
