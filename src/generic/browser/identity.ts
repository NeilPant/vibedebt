import { createHash } from 'node:crypto';
import type { AnchorBundle, BrowserPlan } from './types.js';

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  const result = JSON.stringify(value);
  if (result === undefined) throw new Error('Browser configuration must contain only JSON data');
  return result;
}
export function digest(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
export function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
export function validatePlan(plan: BrowserPlan): void {
  canonical(plan);
  if (plan.version !== 1 || !plan.logicalId || !plan.revision || !plan.journeys.length ||
      !Number.isFinite(Date.parse(plan.clock))) throw new Error('Invalid browser configuration');
  const ids = plan.journeys.map(journey => journey.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate browser journey IDs');
  for (const journey of plan.journeys) {
    const fixtures = journey.fixtures.map(fixture => fixture.id);
    if (new Set(fixtures).size !== fixtures.length || !journey.steps.some(step => step.kind === 'checkpoint')) {
      throw new Error('Invalid browser journey configuration');
    }
  }
}
export function validateBundle(plan: BrowserPlan, bundle: AnchorBundle): void {
  const { hash, ...payload } = bundle;
  if (digest(payload) !== hash) throw new Error('Browser anchor integrity check failed');
  if (bundle.version !== 1 || bundle.logicalId !== plan.logicalId || bundle.revision !== plan.revision ||
      bundle.configHash !== digest(plan)) throw new Error('Browser anchor configuration mismatch');
  if (bundle.observations.length !== plan.journeys.length) throw new Error('Browser anchor observations missing');
}
export function normalizedURL(raw: string, baseURL: string): string {
  const url = new URL(raw);
  url.searchParams.sort();
  return url.origin === new URL(baseURL).origin ? `<app>${url.pathname}${url.search}${url.hash}` : url.href;
}
