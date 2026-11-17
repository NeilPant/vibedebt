import { chromium } from '@playwright/test';
import { canonical, digest, freeze, validateBundle, validatePlan } from './identity.js';
import { runJourney } from './journey.js';
import { cancellationScope, throwIfCanceled } from './cancellation.js';
import type { AnchorBundle, BrowserPlan, BrowserRunOptions, BrowserVerification, JourneyObservation } from './types.js';
export type { AnchorBundle, BrowserPlan, BrowserRunOptions, BrowserVerification } from './types.js';

async function execute(baseURL: string, plan: BrowserPlan, options: BrowserRunOptions) {
  throwIfCanceled(options.signal);
  validatePlan(plan);
  const target = new URL(baseURL);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)) throw new Error('Browser target must be loopback');
  const browser = await chromium.launch({ channel: 'chromium', headless: true, timeout: 15000 });
  const cancellation = cancellationScope(browser, options.signal);
  const observations: JourneyObservation[] = [];
  const failures: string[] = [];
  const failedJourneys = new Set<string>();
  let passed = 0;
  const deadline = Date.now() + Math.min(plan.suiteTimeoutMs ?? 180000, 180000);
  try {
    for (const journey of plan.journeys) {
      cancellation.check();
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        failures.push(`${journey.id}: browser suite deadline exceeded`);
        failedJourneys.add(journey.id); continue;
      }
      try {
        const result = await runJourney(browser, baseURL, plan, journey,
          Math.min(remaining, plan.journeyTimeoutMs ?? 30000, 30000));
        observations.push(result.observation);
        failures.push(...result.failures.map(failure => `${journey.id}: ${failure}`));
        if (result.failures.length) failedJourneys.add(journey.id);
        if (!result.failures.length) passed++;
      } catch (error) {
        failures.push(`${journey.id}: ${error instanceof Error ? error.message : String(error)}`);
        failedJourneys.add(journey.id);
      }
    }
  } finally { await cancellation.close(); }
  cancellation.check();
  return { observations, failures, passed, failedJourneys };
}
export async function captureBrowser(baseURL: string, plan: BrowserPlan, options: BrowserRunOptions = {}): Promise<AnchorBundle> {
  const result = await execute(baseURL, plan, options);
  if (result.failures.length) throw new Error(`Browser baseline failed:\n${result.failures.join('\n')}`);
  const payload = { version: 1 as const, logicalId: plan.logicalId, revision: plan.revision,
    configHash: digest(plan), observations: result.observations };
  return freeze({ ...payload, hash: digest(payload) });
}
export async function replayBrowser(baseURL: string, plan: BrowserPlan, bundle: AnchorBundle,
  options: BrowserRunOptions = {}): Promise<BrowserVerification> {
  throwIfCanceled(options.signal);
  validatePlan(plan);
  validateBundle(plan, bundle);
  const result = await execute(baseURL, plan, options);
  const failedJourneys = result.failedJourneys;
  for (const expected of bundle.observations) {
    const actual = result.observations.find(item => item.id === expected.id);
    if (canonical(actual ?? null) !== canonical(expected)) {
      result.failures.push(`${expected.id}: frozen browser observations differ; expected ${canonical(expected)}, actual ${canonical(actual ?? null)}`);
      failedJourneys.add(expected.id);
    }
  }
  return { success: !result.failures.length, passed: plan.journeys.length - failedJourneys.size,
    failed: failedJourneys.size, failures: result.failures };
}
