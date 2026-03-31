import fs from 'fs';
import path from 'path';

export type CruiseRecord = {
  id: string;
  provider_name: string;
  provider_url: string;
  title: string;
  description: string;
  topic: string;
  start_date: string;
  end_date: string;
  ship: string;
  itinerary: string;
  credits_text: string;
  audience: string;
  instructor_display: string;
  card_price: string;
  detail_price: string;
  location: string;
  url: string;
};

function readCruisesFile() {
  const filePath = path.join(process.cwd(), 'data', 'cruises.json');
  if (!fs.existsSync(filePath)) return [];

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

export async function getCruises() {
  const rows = readCruisesFile() as CruiseRecord[];
  return rows.sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
}
