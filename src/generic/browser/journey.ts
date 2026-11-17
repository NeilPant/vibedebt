import type { Browser, Page } from '@playwright/test';
import { canonical, normalizedURL } from './identity.js';
import { installNetwork } from './network.js';
import type { BrowserJourney, BrowserPlan, JourneyObservation, JsonValue, ObservationField } from './types.js';

async function observe(page: Page, field: ObservationField, baseURL: string): Promise<JsonValue> {
  switch (field.kind) {
    case 'url': return normalizedURL(page.url(), baseURL);
    case 'storage': return page.evaluate(key => localStorage.getItem(key), field.key);
    case 'text': return page.locator(field.selector).innerText();
    case 'value': return page.locator(field.selector).inputValue();
    case 'visible': return page.locator(field.selector).isVisible();
    default: throw new Error('Unsupported browser observation');
  }
}
export async function runJourney(browser: Browser, baseURL: string, plan: BrowserPlan,
  journey: BrowserJourney, timeoutMs: number): Promise<{ observation: JourneyObservation; failures: string[] }> {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const observation: JourneyObservation = { id: journey.id, checkpoints: [], requests: [] };
  const failures: string[] = [];
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    context.setDefaultTimeout(Math.min(timeoutMs, 10000));
    context.setDefaultNavigationTimeout(Math.min(timeoutMs, 10000));
    const network = await installNetwork(context, baseURL, plan, journey);
    // Seed browser storage once per fresh context; navigation/reload must preserve changes.
    if (journey.storage) {
      const seedPage = await context.newPage();
      await seedPage.route(new URL('/__browser_seed__', baseURL).href,
        route => route.fulfill({ status: 200, contentType: 'text/html', body: '<html></html>' }));
      await seedPage.goto(new URL('/__browser_seed__', baseURL).href);
      await seedPage.evaluate(storage => {
        for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value);
      }, journey.storage);
      await seedPage.close();
    }
    const page = await context.newPage();
    await page.clock.setFixedTime(plan.clock);
    const execute = async () => {
      for (const step of journey.steps) {
        switch (step.kind) {
          case 'navigate': {
            const url = new URL(step.path, baseURL);
            if (url.origin !== new URL(baseURL).origin) throw new Error('Navigation must stay on target origin');
            await page.goto(url.href); break;
          }
          case 'reload': await page.reload(); break;
          case 'fill': await page.locator(step.selector).fill(step.value); break;
          case 'click': await page.locator(step.selector).click(); break;
          case 'waitFor': await page.locator(step.selector).waitFor({ state: step.state ?? 'visible' }); break;
          case 'waitForRequest': {
            if (!journey.fixtures.some(fixture => fixture.id === step.fixture)) throw new Error('Unknown request fixture');
            const until = Date.now() + Math.min(timeoutMs, 10000);
            while ((network.counts.get(step.fixture) ?? 0) < (step.count ?? 1)) {
              if (Date.now() > until) throw new Error(`Missing required request ${step.fixture}`);
              await new Promise(resolve => setTimeout(resolve, 10));
            }
            break;
          }
          case 'checkpoint': {
            const values: JsonValue[] = [];
            for (const field of step.fields) values.push(await observe(page, field, baseURL));
            observation.checkpoints.push({ id: step.id, values }); break;
          }
          default: throw new Error('Unsupported browser action');
        }
      }
      await page.waitForLoadState('networkidle');
    };
    const timeout = new Promise<never>((_resolve, reject) => {
      deadline = setTimeout(() => reject(new Error(`Journey deadline exceeded (${timeoutMs}ms)`)), timeoutMs);
    });
    try { await Promise.race([execute(), timeout]); }
    catch (error) { failures.push(error instanceof Error ? error.message : String(error)); }
    failures.push(...network.failures);
    for (const fixture of journey.fixtures) {
      if ((network.counts.get(fixture.id) ?? 0) < (fixture.min ?? 1)) failures.push(`Missing required request ${fixture.id}`);
    }
    observation.requests = network.requests.sort((a, b) => canonical(a).localeCompare(canonical(b)));
  } finally {
    if (deadline) clearTimeout(deadline);
    await context.close();
  }
  return { observation, failures };
}
