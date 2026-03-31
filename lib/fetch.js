import axios from 'axios';
import * as cheerio from 'cheerio';

export async function loadHTML(url) {
  const { data } = await axios.get(url, {
    timeout: 20000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CEAtlasBot/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  return cheerio.load(data);
}
