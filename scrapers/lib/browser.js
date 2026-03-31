import { chromium } from 'playwright';

export async function loadPageRendered(url, waitFor = null) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle' });

  if (waitFor) {
    await page.waitForSelector(waitFor, { timeout: 10000 }).catch(() => {});
  }

  const content = await page.content();
  await browser.close();
  return content;
}
