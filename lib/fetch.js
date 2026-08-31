import axios from 'axios';
import * as cheerio from 'cheerio';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';
const REQUEST_HEADERS = {
  'User-Agent': BROWSER_USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

async function loadHTMLWithCurl(url) {
  const { stdout } = await execFileAsync('curl', [
    '-L',
    '--max-time',
    '25',
    '-A',
    BROWSER_USER_AGENT,
    '-H',
    `Accept: ${REQUEST_HEADERS.Accept}`,
    '-H',
    `Accept-Language: ${REQUEST_HEADERS['Accept-Language']}`,
    url,
  ], {
    maxBuffer: 10 * 1024 * 1024,
  });

  return cheerio.load(stdout);
}

async function loadHTMLWithBrowser(url) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      userAgent: BROWSER_USER_AGENT,
      locale: 'en-US',
    });
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    const status = response?.status() || 0;
    if (status >= 400 && status !== 403 && status !== 429) {
      throw new Error(`Request failed with status code ${status}`);
    }
    return cheerio.load(await page.content());
  } finally {
    await browser.close();
  }
}

export async function loadHTML(url) {
  try {
    const { data } = await axios.get(url, {
      timeout: 20000,
      headers: REQUEST_HEADERS,
    });
    return cheerio.load(data);
  } catch (error) {
    if (['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT'].includes(error?.code)) {
      return loadHTMLWithCurl(url);
    }

    if ([403, 429].includes(error?.response?.status)) {
      return loadHTMLWithBrowser(url);
    }

    throw error;
  }
}
