import { createServer, type Server } from 'node:http';
import { getEventListeners } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';
import { hasChromium } from './helpers/browser.js';
import { captureBrowser, replayBrowser } from '../src/generic/browser/index.js';
import type { BrowserPlan } from '../src/generic/browser/types.js';

const servers: Server[] = [];
async function app(prefix = 'Token', extra = false, document?: string, onRequest?: () => void): Promise<string> {
  const server = createServer((_req, response) => {
    onRequest?.();
    response.setHeader('content-type', 'text/html');
    response.end(document ?? `<body><button>Load</button><output></output><script>
      document.querySelector('button').onclick=async()=>{
        const r=await fetch('https://api.example.invalid/user',{headers:{Authorization:'${prefix} synthetic'}});
        document.querySelector('output').textContent=(await r.json()).name;
        localStorage.setItem('seen','yes');
        ${extra ? "await fetch('https://api.example.invalid/unexpected');" : ''}
      };</script></body>`);
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing server address');
  return `http://127.0.0.1:${address.port}`;
}
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) =>
    server.close(error => error ? reject(error) : resolve()))));
});
const plan: BrowserPlan = {
  version: 1, logicalId: 'tiny-app', revision: 'pinned', clock: '2026-01-01T00:00:00Z',
  apiOrigins: ['https://api.example.invalid'],
  journeys: [{ id: 'loads-user', fixtures: [{ id: 'user', method: 'GET',
    url: 'https://api.example.invalid/user', headers: { authorization: 'Token synthetic' },
    response: { status: 200, json: { name: 'Ada' } },
  }], steps: [
    { kind: 'navigate', path: '/' }, { kind: 'click', selector: 'button' },
    { kind: 'waitFor', selector: 'output:text-is("Ada")' },
    { kind: 'checkpoint', id: 'loaded', fields: [
      { kind: 'text', selector: 'output' }, { kind: 'url' }, { kind: 'storage', key: 'seen' },
    ] },
  ] }],
};

describe.skipIf(!hasChromium)('generic browser boundary (run npx playwright install chromium)', () => {
  it('captures real DOM and request observations and replays the frozen bundle across ports', async () => {
    const bundle = await captureBrowser(await app(), plan);
    expect(JSON.stringify(bundle)).toContain('Ada');
    expect(JSON.stringify(bundle)).toContain('Token synthetic');
    expect(Object.isFrozen(bundle)).toBe(true);
    expect(await replayBrowser(await app(), plan, JSON.parse(JSON.stringify(bundle))))
      .toEqual({ success: true, passed: 1, failed: 0, failures: [] });
  }, 30000);
  it('retains actual wrong Authorization as an assertion failure without waiting for a timeout', async () => {
    const bundle = await captureBrowser(await app(), plan);
    const result = await replayBrowser(await app('Bearer'), plan, bundle);
    expect(result.success).toBe(false);
    expect(result.failures.join('\n')).toMatch(/authorization.*Token synthetic.*Bearer synthetic/i);
    expect(result.failures.join('\n')).not.toMatch(/timeout/i);
  }, 30000);
  it('blocks and reports unexpected outbound API traffic', async () => {
    const bundle = await captureBrowser(await app(), plan);
    const result = await replayBrowser(await app('Token', true), plan, bundle);
    expect(result.success).toBe(false);
    expect(result.failures.join('\n')).toContain('Unexpected request GET https://api.example.invalid/unexpected');
  }, 30000);
  it('rejects changed plans and changed serialized observations before starting a browser', async () => {
    const bundle = await captureBrowser(await app(), plan);
    const changed = structuredClone(plan);
    changed.journeys[0].fixtures[0].headers.authorization = 'Bearer synthetic';
    await expect(replayBrowser('http://127.0.0.1:1', changed, bundle)).rejects.toThrow(/configuration/);
    const tampered = JSON.parse(JSON.stringify(bundle));
    tampered.observations = [];
    await expect(replayBrowser('http://127.0.0.1:1', plan, tampered)).rejects.toThrow(/integrity/);
  }, 30000);
  it('seeds storage once, preserves removal across reload, and isolates subsequent journeys', async () => {
    const url = await app('Token', false, `<button onclick="localStorage.removeItem('seed');location.reload()">Clear</button>
      <output></output><script>document.querySelector('output').textContent=localStorage.getItem('seed')??'empty';</script>`);
    const storagePlan: BrowserPlan = { ...plan, journeys: [
      { id: 'seed-removal', storage: { seed: 'initial' }, fixtures: [], steps: [
        { kind: 'navigate', path: '/' },
        { kind: 'checkpoint', id: 'seeded', fields: [{ kind: 'text', selector: 'output' }] },
        { kind: 'click', selector: 'button' }, { kind: 'waitFor', selector: 'output:text-is("empty")' },
        { kind: 'checkpoint', id: 'removed', fields: [{ kind: 'storage', key: 'seed' }] },
      ] },
      { id: 'fresh', fixtures: [], steps: [{ kind: 'navigate', path: '/' },
        { kind: 'checkpoint', id: 'isolated', fields: [{ kind: 'text', selector: 'output' }] }] },
    ] };
    const bundle = await captureBrowser(url, storagePlan);
    expect(bundle.observations[0].checkpoints).toEqual([
      { id: 'seeded', values: ['initial'] }, { id: 'removed', values: [null] },
    ]);
    expect(bundle.observations[1].checkpoints).toEqual([{ id: 'isolated', values: ['empty'] }]);
  }, 30000);
  it('fails required requests that the frontend never issues', async () => {
    const missingPlan: BrowserPlan = structuredClone(plan);
    missingPlan.journeys[0].fixtures.push({ id: 'missing', method: 'GET',
      url: 'https://api.example.invalid/missing', headers: {}, response: { status: 200, json: {} } });
    await expect(captureBrowser(await app(), missingPlan)).rejects.toThrow('Missing required request missing');
  }, 30000);
  it('counts a journey containing punctuation only once when several assertions fail', async () => {
    const namedPlan = structuredClone(plan);
    namedPlan.journeys[0].id = 'tiny:authenticated';
    const bundle = await captureBrowser(await app(), namedPlan);
    const result = await replayBrowser(await app('Bearer'), namedPlan, bundle);
    expect({ passed: result.passed, failed: result.failed }).toEqual({ passed: 0, failed: 1 });
  }, 30000);
  it('does not treat an undeclared same-origin form POST as an application asset', async () => {
    const url = await app('Token', false, '<form action="/unplanned" method="post"><button>Send</button></form><output>ready</output>');
    const formPlan: BrowserPlan = { ...plan, journeys: [{ id: 'form', fixtures: [], steps: [
      { kind: 'navigate', path: '/' }, { kind: 'click', selector: 'button' },
      { kind: 'checkpoint', id: 'after-post', fields: [{ kind: 'url' }] },
    ] }] };
    await expect(captureBrowser(url, formPlan)).rejects.toThrow('Unexpected request POST <app>/unplanned');
  }, 30000);
  it('cancels a running browser journey and closes it before returning canceled evidence', async () => {
    const controller = new AbortController();
    let navigated = false;
    const url = await app('Token', false, '<p>Waiting</p>', () => {
      navigated = true;
      setTimeout(() => controller.abort(), 100);
    });
    const waitingPlan: BrowserPlan = { ...plan, journeyTimeoutMs: 1500, journeys: [{
      id: 'waiting', fixtures: [], steps: [{ kind: 'navigate', path: '/' },
        { kind: 'waitFor', selector: '#never-appears' },
        { kind: 'checkpoint', id: 'unreachable', fields: [{ kind: 'url' }] }],
    }] };
    await expect(captureBrowser(url, waitingPlan, { signal: controller.signal })).rejects.toThrow(/canceled/i);
    expect(navigated).toBe(true);
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
    expect(await replayBrowser(await app(), plan, await captureBrowser(await app(), plan)))
      .toMatchObject({ success: true });
  }, 10000);
  it('rejects an already canceled replay before navigation without changing the frozen bundle', async () => {
    const bundle = await captureBrowser(await app(), plan);
    const serialized = JSON.stringify(bundle);
    const controller = new AbortController();
    controller.abort();
    await expect(replayBrowser('http://127.0.0.1:1', plan, bundle, { signal: controller.signal }))
      .rejects.toThrow(/canceled/i);
    expect(JSON.stringify(bundle)).toBe(serialized);
  }, 10000);
  it('replays independent API calls initiated in opposite orders without changing auth or request bodies', async () => {
    const document = (order: string[]) => `<output></output><script>
      Promise.all(${JSON.stringify(order)}.map(async id=>{
        const response=await fetch('https://api.example.invalid/'+id,{
          method:'POST',headers:{Authorization:'Token synthetic','Content-Type':'application/json'},
          body:JSON.stringify({id})});
        return (await response.json()).name;
      })).then(names=>document.querySelector('output').textContent=[...new Set(names)].sort().join(','));</script>`;
    const independentPlan: BrowserPlan = { ...plan, journeys: [{ id: 'independent', fixtures: [
      { id: 'alpha', method: 'POST', url: 'https://api.example.invalid/alpha',
        headers: { authorization: 'Token synthetic' }, body: { id: 'alpha' },
        response: { status: 200, json: { name: 'Ada' } }, max: 2 },
      { id: 'beta', method: 'POST', url: 'https://api.example.invalid/beta',
        headers: { authorization: 'Token synthetic' }, body: { id: 'beta' },
        response: { status: 200, json: { name: 'Grace' } } },
    ], steps: [{ kind: 'navigate', path: '/' }, { kind: 'waitFor', selector: 'output:text-is("Ada,Grace")' },
      { kind: 'checkpoint', id: 'complete', fields: [{ kind: 'text', selector: 'output' }] }] }] };
    const first = await app('Token', false, document(['alpha', 'beta']));
    const opposite = await app('Token', false, document(['beta', 'alpha']));
    const bundle = await captureBrowser(first, independentPlan);
    expect(await replayBrowser(opposite, independentPlan, bundle))
      .toEqual({ success: true, passed: 1, failed: 0, failures: [] });
    const repeated = await app('Token', false, document(['beta', 'alpha', 'alpha']));
    // Preserve multiplicity even when repeated traffic is permitted by the fixture bounds.
    const repeatedResult = await replayBrowser(repeated, independentPlan, bundle);
    expect(repeatedResult.success).toBe(false);
    expect(repeatedResult.failures.join('\n')).toContain('frozen browser observations differ');
    expect(repeatedResult.failures.join('\n')).not.toContain('Unexpected extra request');
  }, 15000);
});
