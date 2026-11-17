import type { BrowserPlan } from '../generic/browser/types.js';
import { api, externalAssets } from './realworld-browser-data.js';
import { invalidSessions, loggedOut, loginFailure, loginSuccess, logout } from './realworld-browser-journeys.js';

/** Protocol and UI data for the original pinned frontend; the generic runner has no target imports. */
export const realworldBrowserPlan: BrowserPlan = {
  version: 1,
  logicalId: 'realworld@28e1e43fdfcaa8d10baad6212d34f815dcbb1bba',
  revision: '28e1e43fdfcaa8d10baad6212d34f815dcbb1bba',
  clock: '2026-01-01T00:00:00.000Z',
  apiOrigins: [api],
  externalAssets,
  journeyTimeoutMs: 30000,
  suiteTimeoutMs: 180000,
  journeys: [loginSuccess, loginFailure, logout, loggedOut, ...invalidSessions],
};
