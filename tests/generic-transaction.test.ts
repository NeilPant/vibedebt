import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasChromium } from './helpers/browser.js';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { existsSync } from 'node:fs';
import filesystem from 'node:fs/promises';
import { captureTarget, healTarget } from '../src/generic/transaction.js';
import type { TargetManifest } from '../src/generic/context.js';
import { recoverSnapshot } from '../src/generic/runtime/snapshot.js';
import * as snapshotRuntime from '../src/generic/runtime/snapshot.js';

const require = createRequire(import.meta.url), roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function target(): Promise<TargetManifest> {
  const rawParent = await mkdtemp(join(tmpdir(), 'vibedebt-transaction-')); roots.push(rawParent);
  const parent = await filesystem.realpath(rawParent).catch(() => rawParent);
  if (parent !== rawParent) roots.push(parent);
  const root = join(parent, 'app'); await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'vite.config.ts'), 'export default { server: { fs: { strict: false } } };\n');
  await writeFile(join(root, 'package.json'), JSON.stringify({ type: 'module' }));
  await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
    target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', strict: true,
    skipLibCheck: true, types: [], lib: ['ES2022', 'DOM'],
  }, include: ['src'] }));
  const tokenTemplate = String.fromCharCode(96) + 'Token ' + String.fromCharCode(36) + '{token}' + String.fromCharCode(96);
  const source = (name: string) => 'export class ' + name + ' {\n' +
    'private session = { getToken(): string | undefined { return localStorage.getItem("token") ?? undefined; } };\n' +
    'private authorization = () => { const token = this.session.getToken(); return { headers: { Authorization: token ? ' +
    tokenTemplate + ' : undefined } }; };\noptions() { return this.authorization(); }\n}\n';
  await writeFile(join(root, 'src/account.ts'), source('Account'));
  await writeFile(join(root, 'src/post.ts'), source('Post'));
  await writeFile(join(root, 'index.html'), '<button id="user">User</button><button id="post">Post</button><script type="module" src="/src/main.ts"></script>');
  await writeFile(join(root, 'src/main.ts'), 'import {Account} from "./account"; import {Post} from "./post";\n' +
    'document.querySelector("#user")!.addEventListener("click", () => { void fetch("/api/user",{headers:{Authorization:new Account().options().headers.Authorization ?? ""}}); });\n' +
    'document.querySelector("#post")!.addEventListener("click", () => { void fetch("/api/post",{headers:{Authorization:new Post().options().headers.Authorization ?? ""}}); });\n');
  return {
    version: 1, id: 'transaction-test', revision: 'original', root, artifacts: join(parent, 'artifacts'),
    selection: { sources: [{ file: 'src/account.ts', className: 'Account', memberName: 'authorization' },
      { file: 'src/post.ts', className: 'Post', memberName: 'authorization' }],
    destination: 'src/headers.ts', helperName: 'headersForToken' },
    checks: [{ label: 'typecheck', command: process.execPath,
      args: [require.resolve('typescript/bin/tsc'), '--project', join(root, 'tsconfig.json'), '--noEmit'] }],
    server: { label: 'server', command: process.execPath,
      args: [join(dirname(require.resolve('vite/package.json')), 'bin/vite.js'), '--host', '127.0.0.1', '--port', '{{PORT}}', '--strictPort'] },
    browser: { version: 1, logicalId: 'transaction-test', revision: 'original', clock: '2026-01-01T00:00:00Z',
      apiOrigins: ['/api'], journeys: [{ id: 'headers', storage: { token: 'abc' },
        fixtures: ['user', 'post'].map(id => ({ id, method: 'GET', url: '/api/' + id,
          headers: { authorization: 'Token abc' }, response: { status: 200, json: {} }, min: 1 })),
        steps: [{ kind: 'navigate', path: '/' }, { kind: 'click', selector: '#user' },
          { kind: 'waitForRequest', fixture: 'user' }, { kind: 'click', selector: '#post' },
          { kind: 'waitForRequest', fixture: 'post' }, { kind: 'checkpoint', id: 'page', fields: [{ kind: 'url' }] }],
      }] },
  };
}
describe.skipIf(!hasChromium)('generic transaction boundary (run npx playwright install chromium)', () => {
it('passes a real pure extraction against unchanged browser request anchors', async () => {
  const config = await target(), anchor = await captureTarget(config), frozen = JSON.stringify(anchor);
  const result = await healTarget(config, anchor);
  expect(result.success, JSON.stringify(result)).toBe(true);
  expect(result.verification?.checks[0].code).toBe(0);
  expect(result.verification?.browser.success).toBe(true);
  expect(JSON.stringify(anchor)).toBe(frozen);
}, 120000);
it('detects type-correct auth mutation and restores original bytes through the real transaction', async () => {
  const config = await target(), anchor = await captureTarget(config);
  const before = await readFile(join(config.root, 'src/account.ts'), 'utf8');
  const result = await healTarget(config, anchor, { afterApplyForTest: async plan => {
    const helper = join(config.root, config.selection.destination);
    const text = await readFile(helper, 'utf8');
    expect(plan.changes.length).toBe(3);
    expect(text).toContain('Token ');
    await writeFile(helper, text.replace('Token ', 'Bearer '));
  } });
  expect(result.success).toBe(false);
  expect(result.verification?.checks[0].code, JSON.stringify(result)).toBe(0);
  expect(result.verification?.browser.failures.join('\n')).toContain('Bearer abc');
  expect(result.rolledBack, JSON.stringify(result)).toBe(true);
  expect(result.restoration?.matches).toBe(true);
  expect(result.restoredBrowser?.success).toBe(true);
  expect(await readFile(join(config.root, 'src/account.ts'), 'utf8')).toBe(before);
  expect(await readdir(join(config.root, 'src'))).not.toContain('headers.ts');
}, 120000);
it('rejects tampered anchor identity before mutating or starting a process', async () => {
  const config = await target(), anchor = await captureTarget(config);
  const tampered = { ...anchor, revision: 'other' };
  await expect(healTarget(config, tampered)).rejects.toThrow(/anchor/i);
}, 120000);
it('rejects an incomplete final source inventory even when functional gates pass', async () => {
  const config = await target(), anchor = await captureTarget(config);
  const poison = join(config.root, 'src/poison.ts'), outside = join(dirname(config.root), 'shared.ts');
  await writeFile(outside, '// linked content\n');
  let snapshotFile: string | undefined;
  try {
    const result = await healTarget(config, anchor, { afterApplyForTest: async () => { await link(outside, poison); } });
    snapshotFile = result.snapshotFile;
    expect(result.verification?.browser.success, JSON.stringify(result)).toBe(true);
    expect(result.success).toBe(false);
    expect(result.rolledBack).toBe(false);
    expect(result.error).toMatch(/inventory|hard link/i);
  } finally {
    await rm(poison, { force: true });
    if (snapshotFile) expect((await recoverSnapshot(snapshotFile)).matches).toBe(true);
  }
}, 120000);
it('rejects allowed-file content changed after preview and restores the admitted source', async () => {
  const config = await target(), anchor = await captureTarget(config);
  const result = await healTarget(config, anchor, { afterApplyForTest: async () => {
    const helper = join(config.root, config.selection.destination);
    await writeFile(helper, (await readFile(helper, 'utf8')) + '\n// changed after preview\n');
  } });
  expect(result.verification?.browser.success, JSON.stringify(result)).toBe(true);
  expect(result.success).toBe(false);
  expect(result.error).toMatch(/preview/i);
  expect(result.rolledBack).toBe(true);
  expect(result.restoredBrowser?.success).toBe(true);
}, 120000);
it('rolls back cancellation received during the final source audit despite passing behavioral gates', async () => {
  const config = await target(), anchor = await captureTarget(config);
  const priorListeners = new Set(process.listeners('SIGINT'));
  const verify = snapshotRuntime.verifySnapshot;
  let canceled = false;
  const spy = vi.spyOn(snapshotRuntime, 'verifySnapshot').mockImplementation(async snapshot => {
    const evidence = await verify(snapshot);
    if (!canceled && existsSync(join(config.root, config.selection.destination))) {
      const handlers = process.listeners('SIGINT').filter(handler => !priorListeners.has(handler));
      expect(handlers).toHaveLength(1);
      canceled = true;
      // Deliver the active transaction's SIGINT handler without interrupting Vitest.
      Reflect.apply(handlers[0], process, ['SIGINT']);
    }
    return evidence;
  });
  try {
    const result = await healTarget(config, anchor);
    expect(canceled).toBe(true);
    expect(result.verification?.browser.success, JSON.stringify(result)).toBe(true);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/canceled/i);
    expect(result.rolledBack).toBe(true);
    expect(result.restoration?.matches).toBe(true);
    expect(result.restoredBrowser?.success).toBe(true);
    expect(await readdir(join(config.root, 'src'))).not.toContain('headers.ts');
    expect(process.listeners('SIGINT')).toEqual([...priorListeners]);
  } finally { spy.mockRestore(); }
}, 120000);
it('does not publish an anchor canceled during its final source audit', async () => {
  const config = await target();
  await captureTarget(config);
  const priorListeners = new Set(process.listeners('SIGINT'));
  const verify = snapshotRuntime.verifySnapshot;
  const before = await readdir(config.artifacts);
  let canceled = false;
  const spy = vi.spyOn(snapshotRuntime, 'verifySnapshot').mockImplementation(async snapshot => {
    const evidence = await verify(snapshot);
    if (!canceled && existsSync(snapshot.snapshotFile)) {
      const handlers = process.listeners('SIGINT').filter(handler => !priorListeners.has(handler));
      expect(handlers).toHaveLength(1);
      canceled = true;
      Reflect.apply(handlers[0], process, ['SIGINT']);
    }
    return evidence;
  });
  try {
    await expect(captureTarget(config)).rejects.toThrow(/canceled/i);
    expect(canceled).toBe(true);
    const added = (await readdir(config.artifacts)).filter(name => !before.includes(name));
    expect(added).toHaveLength(1);
    expect(existsSync(join(config.artifacts, added[0], 'anchor.json'))).toBe(false);
    expect(process.listeners('SIGINT')).toEqual([...priorListeners]);
  } finally { spy.mockRestore(); }
}, 120000);
it.each(['write', 'rename'] as const)('removes anchor output when cancellation is received during its publication %s', async phase => {
  const config = await target();
  await captureTarget(config);
  const priorListeners = new Set(process.listeners('SIGINT'));
  const before = await readdir(config.artifacts), write = filesystem.writeFile, rename = filesystem.rename;
  let canceled = false;
  const cancel = (path: unknown) => {
    if (!canceled && typeof path === 'string' && basename(path).includes('anchor') && path.endsWith('.json')) {
      const handlers = process.listeners('SIGINT').filter(handler => !priorListeners.has(handler));
      expect(handlers).toHaveLength(1);
      canceled = true;
      Reflect.apply(handlers[0], process, ['SIGINT']);
    }
  };
  const spy = phase === 'write' ? vi.spyOn(filesystem, 'writeFile').mockImplementation(async (...args) => {
    await write(...args); cancel(args[0]);
  }) : vi.spyOn(filesystem, 'rename').mockImplementation(async (...args) => {
    await rename(...args); cancel(args[1]);
  });
  syncBuiltinESMExports();
  try {
    const outcome = await captureTarget(config).then(value => ({ value }), (error: unknown) => ({ error }));
    expect(canceled).toBe(true);
    expect('error' in outcome).toBe(true);
    expect('error' in outcome ? String(outcome.error) : 'resolved').toMatch(/canceled/i);
    const added = (await readdir(config.artifacts)).filter(name => !before.includes(name));
    expect(added).toHaveLength(1);
    expect((await readdir(join(config.artifacts, added[0]))).filter(name => name.includes('anchor'))).toEqual([]);
    expect(process.listeners('SIGINT')).toEqual([...priorListeners]);
  } finally { spy.mockRestore(); syncBuiltinESMExports(); }
}, 120000);
});
