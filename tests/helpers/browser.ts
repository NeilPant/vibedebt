import { chromium } from '@playwright/test';

let cachedAvailable: boolean | undefined;

export async function isChromiumAvailable(): Promise<boolean> {
  if (cachedAvailable !== undefined) return cachedAvailable;
  try {
    const browser = await chromium.launch({ channel: 'chromium', headless: true, timeout: 5000 });
    await browser.close();
    cachedAvailable = true;
  } catch {
    cachedAvailable = false;
  }
  return cachedAvailable;
}

export const hasChromium = await isChromiumAvailable();
