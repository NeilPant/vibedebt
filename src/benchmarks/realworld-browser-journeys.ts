import type { BrowserJourney, BrowserStep } from '../generic/browser/types.js';
import { article, expiredToken, fixture, homeFixtures, tokenKey, user, validToken } from './realworld-browser-data.js';

const homeReady: BrowserStep = { kind: 'waitFor', selector: '.article-preview h1:text-is("Boundary article")' };
const navCheckpoint = (id: string): BrowserStep => ({ kind: 'checkpoint', id, fields: [
  { kind: 'url' }, { kind: 'text', selector: 'nav' }, { kind: 'storage', key: tokenKey },
] });
const settingsReady: BrowserStep = { kind: 'waitFor', selector: 'input[placeholder="Your Name"]:enabled' };
const settingsCheckpoint: BrowserStep = { kind: 'checkpoint', id: 'settings', fields: [
  { kind: 'url' }, { kind: 'value', selector: 'input[placeholder="Your Name"]' },
  { kind: 'value', selector: 'input[placeholder="Email"]' }, { kind: 'storage', key: tokenKey },
] };
export const loginSuccess: BrowserJourney = {
  id: 'login-reload-settings-favorite', fixtures: [
    { ...fixture('login', 'POST', '/users/login', { user }), max: 1,
      body: { user: { email: 'boundary@example.invalid', password: 'synthetic-password' } } },
    ...homeFixtures(validToken), fixture('current-user', 'GET', '/user', { user }, validToken),
    { ...fixture('favorite', 'POST', '/articles/boundary-article/favorite',
      { article: { ...article, favorited: true, favoritesCount: 1 } }, validToken), max: 1 },
  ], steps: [
    { kind: 'navigate', path: '/#/login' },
    { kind: 'fill', selector: 'input[placeholder="Email"]', value: 'boundary@example.invalid' },
    { kind: 'fill', selector: 'input[placeholder="Password"]', value: 'synthetic-password' },
    { kind: 'click', selector: 'form button' }, homeReady, navCheckpoint('logged-in'),
    { kind: 'reload' }, homeReady, navCheckpoint('reloaded'),
    { kind: 'click', selector: '.article-preview button' },
    { kind: 'waitFor', selector: '.article-preview button:text-is("1")' },
    { kind: 'checkpoint', id: 'favorited', fields: [{ kind: 'text', selector: '.article-preview button' }] },
    { kind: 'click', selector: 'nav a[href="#/settings"]' }, settingsReady, settingsCheckpoint,
  ],
};
export const loginFailure: BrowserJourney = {
  id: 'rejected-login', fixtures: [
    { ...fixture('rejected-login', 'POST', '/users/login', { errors: { 'email or password': ['is invalid'] } }),
      max: 1, body: { user: { email: 'wrong@example.invalid', password: 'wrong-password' } },
      response: { status: 422, json: { errors: { 'email or password': ['is invalid'] } } } },
  ], steps: [
    { kind: 'navigate', path: '/#/login' },
    { kind: 'fill', selector: 'input[placeholder="Email"]', value: 'wrong@example.invalid' },
    { kind: 'fill', selector: 'input[placeholder="Password"]', value: 'wrong-password' },
    { kind: 'click', selector: 'form button' }, { kind: 'waitFor', selector: '.error-messages' },
    { kind: 'checkpoint', id: 'login-error', fields: [{ kind: 'text', selector: '.error-messages' },
      { kind: 'url' }, { kind: 'storage', key: tokenKey }] },
  ],
};
export const logout: BrowserJourney = {
  id: 'logout', storage: { [tokenKey]: validToken },
  fixtures: [fixture('current-user', 'GET', '/user', { user }, validToken), ...homeFixtures(null)],
  steps: [{ kind: 'navigate', path: '/#/settings' }, settingsReady, settingsCheckpoint,
    { kind: 'click', selector: 'button:text-is("Or click here to logout.")' }, homeReady, navCheckpoint('logged-out')],
};
export const loggedOut: BrowserJourney = {
  id: 'logged-out-requests', fixtures: [...homeFixtures(null), fixture('current-user', 'GET', '/user', { user })],
  steps: [{ kind: 'navigate', path: '/' }, homeReady, navCheckpoint('anonymous-home'),
    { kind: 'navigate', path: '/#/settings' }, settingsReady, settingsCheckpoint],
};
export const invalidSessions: BrowserJourney[] = [
  { id: 'malformed-token', token: 'not-a-jwt' }, { id: 'expired-token', token: expiredToken },
].map(({ id, token }) => ({ id, storage: { [tokenKey]: token }, fixtures: homeFixtures(token),
  steps: [{ kind: 'navigate', path: '/' }, homeReady, navCheckpoint(id)] }));
