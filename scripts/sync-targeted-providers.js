import { syncProviderCatalog, getCatalogStats } from '../lib/db.js';
import { writeCSV } from '../scrapers/write-csv.js';
import { scrapeAchieveCE } from '../scrapers/providers/achievece.js';
import { scrapeADHA } from '../scrapers/providers/adha.js';
import { scrapeAllConferenceAlertDentistry } from '../scrapers/providers/all-conference-alert-dentistry.js';
import { scrapeAAPAnnualMeeting2026 } from '../scrapers/providers/aap-annual-meeting.js';
import { scrapeBiolase } from '../scrapers/providers/biolase.js';
import { scrapeBlueSkyBio } from '../scrapers/providers/blueskybio.js';
import { scrapeBU } from '../scrapers/providers/bu.js';
import { scrapeBuffalo } from '../scrapers/providers/buffalo.js';
import { scrapeCarestream } from '../scrapers/providers/carestream.js';
import { scrapeCEZoom } from '../scrapers/providers/cezoom.js';
import { scrapeCDEWorld } from '../scrapers/providers/cdeworld.js';
import { scrapeColoradoCE } from '../scrapers/providers/colorado.js';
import { scrapeColumbia } from '../scrapers/providers/columbia.js';
import { scrapeConcordSeminars } from '../scrapers/providers/concordseminars.js';
import { scrapeConferenceIndexDentistry } from '../scrapers/providers/conference-index-dentistry.js';
import { scrapeDMG } from '../scrapers/providers/dmg.js';
import { scrapeDACE } from '../scrapers/providers/dace.js';
import { scrapeDentalCEAcademy } from '../scrapers/providers/dentalceacademy.js';
import { scrapeDentalDidactics } from '../scrapers/providers/dentaldidactics.js';
import { scrapeDentalLearning } from '../scrapers/providers/dentallearning.js';
import { scrapeDentalXP } from '../scrapers/providers/dentalxp.js';
import { scrapeDentalTribuneGlobalEvents } from '../scrapers/providers/dental-tribune-global.js';
import { scrapeDentalTribuneEvents } from '../scrapers/providers/dental-tribune-events.js';
import { scrapeDentEventsFutureInPerson } from '../scrapers/providers/dentevents.js';
import { scrapeDDSCommunities } from '../scrapers/providers/dds-communities.js';
import { scrapeDDSWorld } from '../scrapers/providers/ddsworld.js';
import { scrapeDentaltown } from '../scrapers/providers/dentaltown.js';
import { scrapeDimensions } from '../scrapers/providers/dimensions.js';
import { scrapeDigitellConference } from '../scrapers/providers/digitell.js';
import { scrapeEAOBatch } from '../scrapers/providers/eao-batch.js';
import { scrapeFutureInPersonEventscribeListings } from '../scrapers/providers/eventscribe-listing.js';
import { scrapeFDC2026 } from '../scrapers/providers/fdc.js';
import { scrapeGIDE } from '../scrapers/providers/gide.js';
import { scrapeGIIA } from '../scrapers/providers/giia.js';
import { scrapeGNYDM } from '../scrapers/providers/gnydm.js';
import { scrapeGlidewell } from '../scrapers/providers/glidewell.js';
import { scrapeHenryScheinOrtho } from '../scrapers/providers/henryscheinortho.js';
import { scrapeHygienetown } from '../scrapers/providers/hygienetown.js';
import { scrapeIHS } from '../scrapers/providers/ihs.js';
import { scrapeIowa } from '../scrapers/providers/iowa.js';
import { scrapeIvoclar } from '../scrapers/providers/ivoclar.js';
import { scrapeLLU } from '../scrapers/providers/llu.js';
import { scrapeLLUPrograms } from '../scrapers/providers/llu-programs.js';
import { scrapeMarylandMSDA } from '../scrapers/providers/maryland.js';
import { scrapeMyDentalCE } from '../scrapers/providers/mydentalce.js';
import { scrapeNetCE } from '../scrapers/providers/netce.js';
import { scrapeNova } from '../scrapers/providers/nova.js';
import { scrapeOHIS } from '../scrapers/providers/ohis.js';
import { scrapePenn } from '../scrapers/providers/penn.js';
import { scrapePennLectureHall } from '../scrapers/providers/penn-lecturehall.js';
import { scrapePennPrograms } from '../scrapers/providers/penn-programs.js';
import { scrapePlanmeca } from '../scrapers/providers/planmeca.js';
import { scrapeStraumannSeeded } from '../scrapers/providers/straumann-seeded.js';
import { scrapeAnthogyrSeeded } from '../scrapers/providers/anthogyr-seeded.js';
import {
  scrapeStateAssociationsWave1,
  scrapeStateAssociationsWave2,
  scrapeStateAssociationsWave2A,
  scrapeStateAssociationsWave2B,
  scrapeStateAssociationsWave3,
  scrapeStateAssociationsWave3A,
  scrapeStateAssociationsWave3B,
  scrapeStateAssociationsWave4,
  scrapeStateAssociationsWave4A,
  scrapeStateAssociationsWave4B,
} from '../scrapers/providers/state-associations.js';
import { scrapeStyleItalianoBatch } from '../scrapers/providers/styleitaliano-batch.js';
import { scrapeTemple } from '../scrapers/providers/temple.js';
import { scrapeTDAMeeting2026 } from '../scrapers/providers/tda-meeting.js';
import { scrapeITIWorldSymposium } from '../scrapers/providers/iti-world-symposium.js';
import { scrapeTufts } from '../scrapers/providers/tufts.js';
import { scrapeTuftsGlobalEurope } from '../scrapers/providers/tufts-global-europe.js';
import { scrapeUBCCPE } from '../scrapers/providers/ubc-cpe.js';
import { scrapeUBC } from '../scrapers/providers/ubc.js';
import { scrapeUBCPrograms } from '../scrapers/providers/ubc-programs.js';
import { scrapeUFBatch } from '../scrapers/providers/uf-batch.js';
import { scrapeUIC } from '../scrapers/providers/uic.js';
import { scrapeUCLA } from '../scrapers/providers/ucla.js';
import { scrapeUMN } from '../scrapers/providers/umn.js';
import { scrapeUKYBatch } from '../scrapers/providers/uky-batch.js';
import { scrapeUW } from '../scrapers/providers/uw.js';
import { scrapeVivaDirectOnDemand } from '../scrapers/providers/viva.js';
import { scrapeVivaPartnerLearning } from '../scrapers/providers/viva-partners.js';
import { scrapeWorldDentalAcademy } from '../scrapers/providers/worlddentalacademy.js';
import { scrapeWorldDentalEventsInPerson } from '../scrapers/providers/world-dental-events.js';
import { scrapeZahn } from '../scrapers/providers/zahn.js';
import { scrapeOsteologyBatch } from '../scrapers/providers/osteology-batch.js';
import { scrapeOrthotown } from '../scrapers/providers/orthotown.js';

const PROVIDERS = {
  'all-conference-alert-dentistry': {
    label: 'All Conference Alert dentistry events',
    scrape: () => scrapeAllConferenceAlertDentistry(),
  },
  'aap-annual-meeting-2026': {
    label: 'AAP Annual Meeting 2026',
    scrape: () => scrapeAAPAnnualMeeting2026(),
  },
  aao2026: {
    label: 'AAO Annual Session 2026',
    scrape: () => scrapeDigitellConference({
      provider: 'AAO',
      providerSlug: 'aao',
      scheduleUrl: 'https://education.aaoinfo.org/live/1013/page/5556',
      accreditation: 'American Association of Orthodontists Annual Session 2026',
      city: 'Orlando',
      state: 'FL',
      country: 'USA',
      format: 'In Person',
    }),
  },
  achievece: {
    label: 'AchieveCE Dental',
    scrape: () => scrapeAchieveCE(),
  },
  biolase: {
    label: 'BIOLASE Education',
    scrape: () => scrapeBiolase(),
  },
  blueskybio: {
    label: 'BlueSkyBio University',
    scrape: () => scrapeBlueSkyBio(),
  },
  adha: {
    label: 'ADHA CE Smart',
    scrape: () => scrapeADHA(),
  },
  bu: {
    label: 'Boston University Dental CE',
    scrape: () => scrapeBU(),
  },
  buffalo: {
    label: 'University at Buffalo Dental CE',
    scrape: () => scrapeBuffalo(),
  },
  carestream: {
    label: 'Carestream Dental Education',
    scrape: () => scrapeCarestream(),
  },
  cezoom: {
    label: 'CE Zoom Dental CE',
    scrape: () => scrapeCEZoom(),
  },
  cdeworld: {
    label: 'CDEWorld',
    scrape: () => scrapeCDEWorld(),
  },
  colorado: {
    label: 'CU Anschutz Dental CE',
    scrape: () => scrapeColoradoCE(),
  },
  columbia: {
    label: 'Columbia Dental CE',
    scrape: () => scrapeColumbia(),
  },
  concordseminars: {
    label: 'Concord Seminars',
    scrape: () => scrapeConcordSeminars(),
  },
  'conference-index-dentistry': {
    label: 'Conference Index dentistry events',
    scrape: () => scrapeConferenceIndexDentistry(),
  },
  dmg: {
    label: 'DMG America CE',
    scrape: () => scrapeDMG(),
  },
  'dds-communities': {
    label: 'DDS-linked international academies',
    scrape: () => scrapeDDSCommunities(),
  },
  ddsworld: {
    label: 'DDS World',
    scrape: () => scrapeDDSWorld(),
  },
  eao: {
    label: 'EAO Europe batch',
    scrape: () => scrapeEAOBatch(),
  },
  'eventscribe-inperson': {
    label: 'Future in-person Eventscribe conference listings',
    scrape: () => scrapeFutureInPersonEventscribeListings(),
  },
  fdc2026: {
    label: 'Florida Dental Convention 2026',
    scrape: () => scrapeFDC2026(),
  },
  tda2026: {
    label: 'Texas Dental Association Meeting 2026',
    scrape: () => scrapeTDAMeeting2026(),
  },
  gide: {
    label: 'gIDE Europe',
    scrape: () => scrapeGIDE(),
  },
  giia: {
    label: 'GIIA USA',
    scrape: () => scrapeGIIA(),
  },
  dentaltown: {
    label: 'Dentaltown CE',
    scrape: () => scrapeDentaltown(),
  },
  dentevents: {
    label: 'DentEvents future in-person dental events',
    scrape: () => scrapeDentEventsFutureInPerson(),
  },
  dentallearning: {
    label: 'Dental Learning',
    scrape: () => scrapeDentalLearning(),
  },
  dentalxp: {
    label: 'DentalXP',
    scrape: () => scrapeDentalXP(),
  },
  'dental-tribune-global': {
    label: 'Dental Tribune International events',
    scrape: () => scrapeDentalTribuneGlobalEvents(),
  },
  'dental-tribune-events': {
    label: 'Dental Tribune current in-person events',
    scrape: () => scrapeDentalTribuneEvents(),
  },
  dace: {
    label: 'Dental Academy of Continuing Education',
    scrape: () => scrapeDACE(),
  },
  dentalceacademy: {
    label: 'Dental CE Academy',
    scrape: () => scrapeDentalCEAcademy(),
  },
  dentaldidactics: {
    label: 'Dental Didactics CE',
    scrape: () => scrapeDentalDidactics(),
  },
  dimensions: {
    label: 'Dimensions of Dental Hygiene CE',
    scrape: () => scrapeDimensions(),
  },
  gnydm: {
    label: 'Greater New York Dental Meeting',
    scrape: () => scrapeGNYDM('https://www.gnydm.com/courses-and-events/?year=2026'),
  },
  henryscheinortho: {
    label: 'Henry Schein Orthodontics CE',
    scrape: () => scrapeHenryScheinOrtho(),
  },
  hygienetown: {
    label: 'Hygienetown CE',
    scrape: () => scrapeHygienetown(),
  },
  ihs: {
    label: 'Indian Health Service Dental CDE',
    scrape: () => scrapeIHS(),
  },
  iowa: {
    label: 'University of Iowa Dental CE',
    scrape: () => scrapeIowa(),
  },
  glidewell: {
    label: 'Glidewell Clinical Education',
    scrape: () => scrapeGlidewell('https://glidewelldirect.com/collections/education'),
  },
  ivoclar: {
    label: 'Ivoclar Academy',
    scrape: () => scrapeIvoclar(),
  },
  llu: {
    label: 'Loma Linda University Dental CE',
    scrape: () => scrapeLLU(),
  },
  maryland: {
    label: 'Maryland State Dental Association CE',
    scrape: () => scrapeMarylandMSDA(),
  },
  mydentalce: {
    label: 'MyDentalCE',
    scrape: () => scrapeMyDentalCE(),
  },
  netce: {
    label: 'NetCE Dental',
    scrape: () => scrapeNetCE(),
  },
  nova: {
    label: 'Nova Southeastern University Dental CE',
    scrape: () => scrapeNova(),
  },
  ohis: {
    label: 'OHI-S Dental CE',
    scrape: () => scrapeOHIS(),
  },
  'llu-programs': {
    label: 'LLU program-level providers',
    scrape: () => scrapeLLUPrograms(),
  },
  penn: {
    label: 'Penn Dental Medicine CE',
    scrape: () => scrapePenn(),
  },
  'penn-lecturehall': {
    label: 'Penn lecture hall category providers',
    scrape: () => scrapePennLectureHall(),
  },
  'penn-programs': {
    label: 'Penn program-level providers',
    scrape: () => scrapePennPrograms(),
  },
  planmeca: {
    label: 'Planmeca Digital Academy',
    scrape: () => scrapePlanmeca(),
  },
  straumann: {
    label: 'Straumann Education seeded batch',
    scrape: () => scrapeStraumannSeeded(),
  },
  anthogyr: {
    label: 'Anthogyr Education seeded batch',
    scrape: () => scrapeAnthogyrSeeded(),
  },
  'state-wave-1': {
    label: 'State association wave 1',
    scrape: () => scrapeStateAssociationsWave1(),
  },
  'state-wave-2': {
    label: 'State association wave 2',
    scrape: () => scrapeStateAssociationsWave2(),
  },
  'state-wave-2a': {
    label: 'State association wave 2A',
    scrape: () => scrapeStateAssociationsWave2A(),
  },
  'state-wave-2b': {
    label: 'State association wave 2B',
    scrape: () => scrapeStateAssociationsWave2B(),
  },
  'state-wave-3': {
    label: 'State association wave 3',
    scrape: () => scrapeStateAssociationsWave3(),
  },
  'state-wave-3a': {
    label: 'State association wave 3A',
    scrape: () => scrapeStateAssociationsWave3A(),
  },
  'state-wave-3b': {
    label: 'State association wave 3B',
    scrape: () => scrapeStateAssociationsWave3B(),
  },
  'state-wave-4': {
    label: 'State association wave 4',
    scrape: () => scrapeStateAssociationsWave4(),
  },
  'state-wave-4a': {
    label: 'State association wave 4A',
    scrape: () => scrapeStateAssociationsWave4A(),
  },
  'state-wave-4b': {
    label: 'State association wave 4B',
    scrape: () => scrapeStateAssociationsWave4B(),
  },
  temple: {
    label: 'Temple Dental CE',
    scrape: () => scrapeTemple(),
  },
  iti: {
    label: 'ITI World Symposium 2027',
    scrape: () => scrapeITIWorldSymposium(),
  },
  styleitaliano: {
    label: 'StyleItaliano batch',
    scrape: () => scrapeStyleItalianoBatch(),
  },
  tufts: {
    label: 'Tufts Dental CE',
    scrape: () => scrapeTufts(),
  },
  'tufts-global-europe': {
    label: 'Tufts Global Academy Europe',
    scrape: () => scrapeTuftsGlobalEurope(),
  },
  'uf-batch': {
    label: 'University of Florida CE batch',
    scrape: () => scrapeUFBatch(),
  },
  ubc: {
    label: 'UBC Continuing Dental Education',
    scrape: () => scrapeUBC(),
  },
  'ubc-cpe': {
    label: 'UBC CPE Catalog',
    scrape: () => scrapeUBCCPE(),
  },
  'ubc-programs': {
    label: 'UBC program-level providers',
    scrape: () => scrapeUBCPrograms(),
  },
  uic: {
    label: 'UIC College of Dentistry CE',
    scrape: () => scrapeUIC(),
  },
  ucla: {
    label: 'UCLA Dental CE',
    scrape: () => scrapeUCLA(),
  },
  umn: {
    label: 'University of Minnesota Continuing Dental Education',
    scrape: () => scrapeUMN(),
  },
  'uky-batch': {
    label: 'University of Kentucky CE batch',
    scrape: () => scrapeUKYBatch(),
  },
  uw: {
    label: 'University of Washington Dental CE',
    scrape: () => scrapeUW(),
  },
  'viva-direct': {
    label: 'Viva Learning direct on-demand catalog',
    scrape: () => scrapeVivaDirectOnDemand(),
  },
  'viva-partners': {
    label: 'Viva-powered partner learning sites',
    scrape: () => scrapeVivaPartnerLearning(),
  },
  worlddentalacademy: {
    label: 'World Dental Academy',
    scrape: () => scrapeWorldDentalAcademy(),
  },
  'world-dental-events': {
    label: 'World Dental Events in-person listings',
    scrape: () => scrapeWorldDentalEventsInPerson(),
  },
  zahn: {
    label: 'Zahn Continuing Education',
    scrape: () => scrapeZahn(),
  },
  osteology: {
    label: 'Osteology Foundation batch',
    scrape: () => scrapeOsteologyBatch(),
  },
  orthotown: {
    label: 'Orthotown CE',
    scrape: () => scrapeOrthotown(),
  },
};

async function main() {
  const targets = process.argv.slice(2);
  if (!targets.length) {
    throw new Error(`Usage: node scripts/sync-targeted-providers.js ${Object.keys(PROVIDERS).join(' ')}`);
  }

  const summary = [];

  for (const key of targets) {
    const config = PROVIDERS[key];
    if (!config) {
      throw new Error(`Unknown provider key: ${key}`);
    }

    console.log(`▶️ Targeted sync: ${config.label}`);
    const rows = await config.scrape();
    const review = writeCSV(rows, {
      baseName: `pending_${key}_courses`,
      skippedName: `skipped_${key}_past_courses`,
    });
    const result = await syncProviderCatalog(review.rows);
    if (review.skipped.length || result.skippedPastCourses) {
      console.log(`   • skipped ${review.skipped.length + result.skippedPastCourses} past dated rows before upload`);
    }
    const stats = await getCatalogStats();

    summary.push({
      key,
      provider: config.label,
      scraped: rows.length,
      result,
      stats,
    });
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
