import type { BrowserContext, Request } from '@playwright/test';
import { canonical, normalizedURL } from './identity.js';
import type { BrowserJourney, BrowserPlan, JourneyObservation, JsonValue } from './types.js';

export interface NetworkState {
  requests: JourneyObservation['requests'];
  counts: Map<string, number>;
  failures: string[];
}
function requestBody(request: Request): JsonValue {
  const body = request.postData();
  if (body === null) return null;
  try { return JSON.parse(body) as JsonValue; } catch { return body; }
}
export async function installNetwork(context: BrowserContext, baseURL: string,
  plan: BrowserPlan, journey: BrowserJourney): Promise<NetworkState> {
  const state: NetworkState = { requests: [], counts: new Map(), failures: [] };
  const fixtureURL = (url: string) => normalizedURL(new URL(url, baseURL).href, baseURL);
  await context.route('**/*', async route => {
    const request = route.request();
    const raw = request.url();
    const url = normalizedURL(raw, baseURL);
    const fixture = journey.fixtures.find(candidate => candidate.method.toUpperCase() === request.method() &&
      fixtureURL(candidate.url) === url);
    const api = plan.apiOrigins.some(prefix => {
      const target = new URL(prefix, baseURL);
      const actual = new URL(raw);
      return actual.origin === target.origin && actual.pathname.startsWith(target.pathname);
    });
    if (fixture) {
      const count = (state.counts.get(fixture.id) ?? 0) + 1;
      state.counts.set(fixture.id, count);
      if (count > (fixture.max ?? 1)) state.failures.push(`Unexpected extra request ${fixture.id}: ${count}`);
      const actualHeaders = await request.allHeaders();
      const headers: Record<string, string | null> = {};
      for (const [key, expected] of Object.entries(fixture.headers)) {
        const name = key.toLowerCase();
        const actual = actualHeaders[name] ?? null;
        headers[name] = actual;
        if (actual !== expected) state.failures.push(`${fixture.id} ${name}: expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}`);
      }
      const body = requestBody(request);
      if (fixture.body !== undefined && canonical(body) !== canonical(fixture.body)) {
        state.failures.push(`${fixture.id} request body: expected ${canonical(fixture.body)}, actual ${canonical(body)}`);
      }
      state.requests.push({ fixture: fixture.id, method: request.method(), url, headers, body });
      // Continue the UI deterministically even after a request assertion fails.
      await route.fulfill({ status: fixture.response.status, json: fixture.response.json });
      return;
    }
    if (!api && new URL(raw).origin === new URL(baseURL).origin &&
        ['GET', 'HEAD'].includes(request.method()) &&
        ['document', 'stylesheet', 'image', 'font', 'script', 'manifest', 'other'].includes(request.resourceType())) {
      await route.continue();
      return;
    }
    const asset = plan.externalAssets?.find(candidate => candidate.url === raw);
    if (asset) {
      await route.fulfill({ status: 200, contentType: asset.contentType, body: asset.body });
      return;
    }
    state.failures.push(`Unexpected request ${request.method()} ${url}`);
    await route.fulfill({ status: 401, json: { errors: { request: ['Unexpected harness traffic'] } } });
  });
  return state;
}
