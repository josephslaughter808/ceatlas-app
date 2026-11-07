import { chromium } from 'playwright';
import fs from 'node:fs';

export async function loadPageRendered(url, waitFor = null) {
  const systemBrowsers = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean);
  const executablePath = systemBrowsers.find((candidate) => fs.existsSync(candidate));
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle' });

  if (waitFor) {
    await page.waitForSelector(waitFor, { timeout: 10000 }).catch(() => {});
  }

  const content = await page.content();
  await browser.close();
  return content;
}
