import axios from 'axios';
import * as cheerio from 'cheerio';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function loadHTMLWithCurl(url) {
  const { stdout } = await execFileAsync('curl', [
    '-L',
    '--max-time',
    '25',
    '-A',
    'Mozilla/5.0 (compatible; CEAtlasBot/1.0)',
    '-H',
    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    url,
  ], {
    maxBuffer: 10 * 1024 * 1024,
  });

  return cheerio.load(stdout);
}

export async function loadHTML(url) {
  try {
    const { data } = await axios.get(url, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CEAtlasBot/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    return cheerio.load(data);
  } catch (error) {
    if (['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT'].includes(error?.code)) {
      return loadHTMLWithCurl(url);
    }

    throw error;
  }
}
