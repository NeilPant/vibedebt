import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, stat, chmod, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { isAlive as alive } from '../src/generic/runtime/process-tree.js';

const temporary: string[] = [];
async function fixture() {
  const rawBase = await mkdtemp(path.join(os.tmpdir(), 'generic-runtime-'));
  temporary.push(rawBase);
  const base = await realpath(rawBase).catch(() => rawBase);
  if (base !== rawBase) temporary.push(base);
  const root = path.join(base, 'target');
  const artifacts = path.join(base, 'artifacts');
  await mkdir(root);
  return { base, root, artifacts };
}
afterEach(async () => { await Promise.all(temporary.splice(0).map(p => rm(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {}))); });
async function snapshots() {
  const module = await import('../src/generic/runtime/snapshot.js').catch(() => null);
  expect(module, 'snapshot runtime must exist').not.toBeNull();
  return module!;
}
async function processes() {
  const module = await import('../src/generic/runtime/process.js').catch(() => null);
  expect(module, 'process runtime must exist').not.toBeNull();
  return module!;
}
async function freePort() {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No TCP port');
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

describe('generic workspace recovery', () => {
  it('restores dirty binary ignored and untracked bytes and exact directory existence from a serialized snapshot', async () => {
    const api = await snapshots();
    const { root, artifacts } = await fixture();
    await mkdir(path.join(root, 'src', 'empty'), { recursive: true });
    await writeFile(path.join(root, '.gitignore'), 'ignored.bin\n');
    await writeFile(path.join(root, 'ignored.bin'), Buffer.from([0, 255, 128, 10]));
    await writeFile(path.join(root, 'src', 'dirty.ts'), 'dirty, preexisting');
    const snapshot = await api.snapshotWorkspace(root, artifacts);
    const serialized = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
    await rm(path.join(root, 'src'), { recursive: true });
    await writeFile(path.join(root, 'ignored.bin'), 'corrupt');
    await mkdir(path.join(root, 'new', 'nested'), { recursive: true });
    await writeFile(path.join(root, 'new', 'nested', 'new.ts'), 'created');
    expect((await api.verifySnapshot(serialized)).matches).toBe(false);
    expect(await api.restoreWorkspace(serialized)).toEqual({ matches: true, differences: [] });
    expect(await readFile(path.join(root, 'ignored.bin'))).toEqual(Buffer.from([0, 255, 128, 10]));
    expect(await readFile(path.join(root, 'src', 'dirty.ts'), 'utf8')).toBe('dirty, preexisting');
    expect((await stat(path.join(root, 'src', 'empty'))).isDirectory()).toBe(true);
    await expect(stat(path.join(root, 'new'))).rejects.toThrow();
    expect(await api.recoverSnapshot(path.join(artifacts, 'snapshot.json'))).toEqual({ matches: true, differences: [] });
  });

  it('prunes dependency output git and cache links before descent while preserving excluded bytes', async () => {
    const api = await snapshots();
    const { base, root, artifacts } = await fixture();
    const outside = path.join(base, 'outside');
    await mkdir(outside);
    await writeFile(path.join(outside, 'sentinel'), 'safe');
    for (const name of ['node_modules', 'dist', 'build', 'coverage', '.git', '.vite', 'cache', '.cache']) {
      await symlink(outside, path.join(root, name), process.platform === 'win32' ? 'junction' : 'dir');
    }
    const snapshot = await api.snapshotWorkspace(root, artifacts);
    await writeFile(path.join(outside, 'sentinel'), 'excluded bytes changed after capture');
    await writeFile(path.join(root, 'new.ts'), 'temporary');
    expect((await api.restoreWorkspace(snapshot)).matches).toBe(true);
    expect(await readFile(path.join(outside, 'sentinel'), 'utf8')).toBe('excluded bytes changed after capture');
    expect((await stat(path.join(root, 'node_modules'))).isDirectory()).toBe(true);
  });

  it('rejects owned links before snapshot or any restoration writes', async () => {
    const api = await snapshots();
    const { base, root, artifacts } = await fixture();
    await writeFile(path.join(root, 'original.txt'), 'original');
    const snapshot = await api.snapshotWorkspace(root, artifacts);
    await writeFile(path.join(root, 'original.txt'), 'changed');
    const outside = path.join(base, 'outside');
    await mkdir(outside);
    await symlink(outside, path.join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(api.snapshotWorkspace(root, path.join(base, 'second'))).rejects.toThrow(/link|junction/i);
    await expect(api.verifySnapshot(snapshot)).rejects.toThrow(/link|junction/i);
    await expect(api.restoreWorkspace(snapshot)).rejects.toThrow(/link|junction/i);
    expect(await readFile(path.join(root, 'original.txt'), 'utf8')).toBe('changed');
  });

  it('rejects overlapping artifact storage and corrupt recovery data before writes', async () => {
    const api = await snapshots();
    const { root, artifacts } = await fixture();
    await expect(api.snapshotWorkspace(root, path.join(root, 'snapshots'))).rejects.toThrow(/outside|overlap/i);
    await writeFile(path.join(root, 'keep'), 'before');
    const snapshot = await api.snapshotWorkspace(root, artifacts);
    await writeFile(path.join(root, 'keep'), 'changed');
    const bad = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
    bad.entries[0].path = '../escape';
    await expect(api.restoreWorkspace(bad)).rejects.toThrow(/path|invalid/i);
    expect(await readFile(path.join(root, 'keep'), 'utf8')).toBe('changed');
    await writeFile(path.join(artifacts, 'blobs', snapshot.entries[0].hash!), 'corrupt');
    await expect(api.restoreWorkspace(snapshot)).rejects.toThrow(/hash|corrupt/i);
    expect(await readFile(path.join(root, 'keep'), 'utf8')).toBe('changed');
  });

  it('preserves actual Git HEAD and staged index while recovering dirty untracked ignored files', async () => {
    const api = await snapshots();
    const { root, artifacts } = await fixture();
    const git = (args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
    git(['init', '-q']);
    await writeFile(path.join(root, 'tracked'), 'committed');
    await writeFile(path.join(root, '.gitignore'), 'ignored\n');
    git(['add', '.']);
    git(['-c', 'user.name=Runtime Test', '-c', 'user.email=runtime@example.invalid', 'commit', '-qm', 'baseline']);
    await writeFile(path.join(root, 'tracked'), 'staged');
    git(['add', 'tracked']);
    await writeFile(path.join(root, 'tracked'), 'dirty');
    await writeFile(path.join(root, 'ignored'), 'ignored bytes');
    await writeFile(path.join(root, 'untracked'), 'untracked bytes');
    const head = git(['rev-parse', 'HEAD']);
    const index = await readFile(path.join(root, '.git', 'index'));
    const snapshot = await api.snapshotWorkspace(root, artifacts);
    await rm(path.join(root, 'tracked'));
    await rm(path.join(root, 'ignored'));
    await writeFile(path.join(root, 'untracked'), 'bad');
    expect((await api.restoreWorkspace(snapshot)).matches).toBe(true);
    expect(git(['rev-parse', 'HEAD'])).toBe(head);
    expect(await readFile(path.join(root, '.git', 'index'))).toEqual(index);
    expect(await readFile(path.join(root, 'tracked'), 'utf8')).toBe('dirty');
    expect(await readFile(path.join(root, 'ignored'), 'utf8')).toBe('ignored bytes');
    expect(await readFile(path.join(root, 'untracked'), 'utf8')).toBe('untracked bytes');
  });

  it.skipIf(process.platform === 'win32')('restores executable mode and detects mode changes', async () => {
    const api = await snapshots();
    const { root, artifacts } = await fixture();
    const script = path.join(root, 'run');
    await writeFile(script, '#!/bin/sh\n');
    await chmod(script, 0o755);
    const snapshot = await api.snapshotWorkspace(root, artifacts);
    await chmod(script, 0o644);
    expect((await api.verifySnapshot(snapshot)).matches).toBe(false);
    expect((await api.restoreWorkspace(snapshot)).matches).toBe(true);
    expect((await stat(script)).mode & 0o777).toBe(0o755);
  });
});

describe('generic supervised processes', () => {
  it('reports a terminated child or zombie process as not alive', async () => {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    const pid = child.pid!;
    expect(pid).toBeGreaterThan(0);
    expect(alive(pid)).toBe(true);
    child.kill('SIGKILL');
    const until = Date.now() + 5000;
    while (alive(pid) && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 50));
    expect(alive(pid)).toBe(false);
  });

  it('retains exit status stdout and stderr from a real process', async () => {
    const api = await processes();
    const { root } = await fixture();
    const result = await api.runCommand({ command: process.execPath, args: ['-e', 'console.log("out");console.error("err");process.exit(7)'], cwd: root });
    expect(result).toMatchObject({ code: 7, timedOut: false });
    expect(result.output).toContain('out');
    expect(result.output).toContain('err');
  });

  it('times out and terminates the real descendant process tree', async () => {
    const api = await processes();
    const { root } = await fixture();
    const script = 'const {spawn}=require("node:child_process");const c=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"});console.log(c.pid);setInterval(()=>{},1000)';
    const start = Date.now();
    const result = await api.runCommand({ command: process.execPath, args: ['-e', script], cwd: root, timeoutMs: 700 });
    expect(result.timedOut).toBe(true);
    expect(result.code).not.toBe(0);
    expect(Date.now() - start).toBeLessThan(12000);
    const pid = Number(result.output.trim().split(/\s+/)[0]);
    expect(pid).toBeGreaterThan(0);
    expect(alive(pid)).toBe(false);
  }, 15000);

  it('waits for HTTP readiness then stops the server and its descendant', async () => {
    const api = await processes();
    const { root } = await fixture();
    const port = await freePort();
    const pidFile = path.join(root, 'child.pid');
    const script = `const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(c.pid));require('node:http').createServer((q,s)=>s.end('ready')).listen(${port},'127.0.0.1')`;
    const server = await api.startServer({ command: process.execPath, args: ['-e', script], cwd: root, timeoutMs: 5000 }, `http://127.0.0.1:${port}`);
    expect(await (await fetch(`http://127.0.0.1:${port}`)).text()).toBe('ready');
    const child = Number(await readFile(pidFile, 'utf8'));
    await server.stop();
    await server.stop();
    expect(alive(child)).toBe(false);
    await expect(fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(1000) })).rejects.toThrow();
  }, 15000);

  it('bounds failed readiness and cleans up the launched child', async () => {
    const api = await processes();
    const { root } = await fixture();
    const pidFile = path.join(root, 'server.pid');
    const script = `require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));setInterval(()=>{},1000)`;
    const port = await freePort();
    await expect(api.startServer({ command: process.execPath, args: ['-e', script], cwd: root, timeoutMs: 600 }, `http://127.0.0.1:${port}`)).rejects.toThrow(/ready|readiness/i);
    expect(alive(Number(await readFile(pidFile, 'utf8')))).toBe(false);
  }, 15000);
});

// These regressions exercise boundary replacement and recovery-data validation,
// rather than comparing implementation-derived manifests.
describe('recovery boundary regressions', () => {
  it('reports concrete changed relative paths and exposes its recovery manifest', async () => {
    const api = await snapshots();
    const { root, artifacts } = await fixture();
    await writeFile(path.join(root, 'old.ts'), 'before');
    const snapshot = await api.snapshotWorkspace(root, artifacts);
    expect(snapshot.snapshotFile).toBe(path.join(artifacts, 'snapshot.json'));
    await writeFile(path.join(root, 'old.ts'), 'after');
    await mkdir(path.join(root, 'new'));
    await writeFile(path.join(root, 'new', 'helper.ts'), 'helper');
    expect((await api.verifySnapshot(snapshot)).changedFiles?.sort()).toEqual(['new', 'new/helper.ts', 'old.ts']);
  });

  it('rejects replaced target roots and does not write the replacement', async () => {
    const api = await snapshots();
    const { root, artifacts } = await fixture();
    await writeFile(path.join(root, 'keep'), 'original');
    const snapshot = await api.snapshotWorkspace(root, artifacts);
    const { rename } = await import('node:fs/promises');
    await rename(root, `${root}-original`);
    await mkdir(root);
    await writeFile(path.join(root, 'keep'), 'replacement');
    await expect(api.restoreWorkspace(snapshot)).rejects.toThrow(/identity|root/i);
    expect(await readFile(path.join(root, 'keep'), 'utf8')).toBe('replacement');
  });

  it('restores file-to-directory and directory-to-file replacements', async () => {
    const api = await snapshots();
    const { root, artifacts } = await fixture();
    await writeFile(path.join(root, 'file'), 'bytes');
    await mkdir(path.join(root, 'dir'));
    await writeFile(path.join(root, 'dir', 'child'), 'child');
    const snapshot = await api.snapshotWorkspace(root, artifacts);
    await rm(path.join(root, 'file'));
    await mkdir(path.join(root, 'file'));
    await writeFile(path.join(root, 'file', 'created'), 'new');
    await rm(path.join(root, 'dir'), { recursive: true });
    await writeFile(path.join(root, 'dir'), 'replaced');
    expect((await api.restoreWorkspace(snapshot)).matches).toBe(true);
    expect(await readFile(path.join(root, 'file'), 'utf8')).toBe('bytes');
    expect(await readFile(path.join(root, 'dir', 'child'), 'utf8')).toBe('child');
  });

  it('rejects included hard links so recovery cannot overwrite an external inode', async () => {
    const api = await snapshots();
    const { base, root, artifacts } = await fixture();
    const { link } = await import('node:fs/promises');
    const external = path.join(base, 'outside-file');
    await writeFile(external, 'external');
    await writeFile(path.join(root, 'keep'), 'original');
    const snapshot = await api.snapshotWorkspace(root, artifacts);
    await rm(path.join(root, 'keep'));
    await link(external, path.join(root, 'keep'));
    await expect(api.restoreWorkspace(snapshot)).rejects.toThrow(/hard.link|link/i);
    expect(await readFile(external, 'utf8')).toBe('external');
  });

  it('runs Windows npm batch commands without losing arguments', async () => {
    const api = await processes();
    const { root } = await fixture();
    const result = await api.runCommand({ command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args: ['--version'], cwd: root, timeoutMs: 10000 });
    expect(result.code, result.output).toBe(0);
    expect(result.output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  }, 15000);

  it('rejects nonfinite process timeouts before launching', async () => {
    const api = await processes();
    const { root } = await fixture();
    await expect(api.runCommand({ command: process.execPath, args: ['-e', 'throw new Error("must not run")'], cwd: root, timeoutMs: Infinity })).rejects.toThrow(/finite/i);
  });
});


describe('process ownership regressions', () => {
  it('cleans a real child after its wrapper exits normally', async () => {
    const api = await processes();
    const { root } = await fixture();
    const script = 'const {spawn}=require("node:child_process");const c=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"});console.log(c.pid);c.unref()';
    const result = await api.runCommand({ command: process.execPath, args: ['-e', script], cwd: root, timeoutMs: 5000 });
    expect(result.code).toBe(0);
    expect(result.timedOut).toBe(false);
    const childPid = Number(result.output.trim());
    const until = Date.now() + 5000;
    while (alive(childPid) && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 50));
    expect(alive(childPid)).toBe(false);
  }, 15000);

  it('rejects a readiness URL already owned by a different server before launch', async () => {
    const api = await processes();
    const { root } = await fixture();
    const { createServer: httpServer } = await import('node:http');
    const unrelated = httpServer((_request, response) => response.end('unrelated'));
    await new Promise<void>(resolve => unrelated.listen(0, '127.0.0.1', resolve));
    const address = unrelated.address();
    if (!address || typeof address === 'string') throw new Error('Missing address');
    try {
      await expect(api.startServer({ command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], cwd: root, timeoutMs: 500 }, `http://127.0.0.1:${address.port}`)).rejects.toThrow(/occupied|already/i);
      expect(await (await fetch(`http://127.0.0.1:${address.port}`)).text()).toBe('unrelated');
    } finally { await new Promise<void>((resolve, reject) => unrelated.close(error => error ? reject(error) : resolve())); }
  });
});

describe('handled cancellation', () => {
  async function waitForPid(file: string): Promise<number> {
    const until = Date.now() + 4000;
    while (Date.now() < until) {
      try { return Number(await readFile(file, 'utf8')); } catch { await new Promise(resolve => setTimeout(resolve, 20)); }
    }
    throw new Error('Child did not start');
  }

  it('aborts a running command and kills its actual descendant before rejection', async () => {
    const api = await processes();
    const { root } = await fixture();
    const pidFile = path.join(root, 'abort-child.pid');
    const script = `const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(c.pid));setInterval(()=>{},1000)`;
    const controller = new AbortController();
    const pending = api.runCommand({ command: process.execPath, args: ['-e', script], cwd: root, timeoutMs: 5000, signal: controller.signal });
    const rejection = expect(pending).rejects.toThrow(/abort/i);
    const pid = await waitForPid(pidFile);
    controller.abort();
    await rejection;
    expect(alive(pid)).toBe(false);
  }, 15000);

  it('stops a ready server and its descendant on abort', async () => {
    const api = await processes();
    const { root } = await fixture();
    const pidFile = path.join(root, 'abort-server-child.pid');
    const port = await freePort();
    const script = `const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(c.pid));require('node:http').createServer((q,s)=>s.end('ready')).listen(${port},'127.0.0.1')`;
    const controller = new AbortController();
    const server = await api.startServer({ command: process.execPath, args: ['-e', script], cwd: root, timeoutMs: 5000, signal: controller.signal }, `http://127.0.0.1:${port}`);
    const pid = await waitForPid(pidFile);
    controller.abort();
    const until = Date.now() + 6000;
    while (alive(pid) && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 20));
    try { expect(alive(pid)).toBe(false); } finally { await server.stop(); }
    const { default: events } = await import('node:events');
    expect(events.getEventListeners(controller.signal, 'abort')).toHaveLength(0);
    await expect(fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(1000) })).rejects.toThrow();
  }, 15000);

  it('does not launch a command when its signal is already aborted', async () => {
    const api = await processes();
    const { root } = await fixture();
    const file = path.join(root, 'must-not-exist');
    await expect(api.runCommand({ command: process.execPath, args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(file)},'bad')`], cwd: root, signal: AbortSignal.abort() })).rejects.toThrow(/abort/i);
    await expect(stat(file)).rejects.toThrow();
  });

  it('aborts pending server readiness and cleans up before rejection', async () => {
    const api = await processes();
    const { root } = await fixture();
    const pidFile = path.join(root, 'not-ready-server.pid');
    const port = await freePort();
    const controller = new AbortController();
    const script = `require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));setInterval(()=>{},1000)`;
    const pending = api.startServer({ command: process.execPath, args: ['-e', script], cwd: root, timeoutMs: 5000, signal: controller.signal }, `http://127.0.0.1:${port}`);
    const rejection = expect(pending).rejects.toThrow(/abort/i);
    const pid = await waitForPid(pidFile);
    controller.abort();
    await rejection;
    expect(alive(pid)).toBe(false);
    const { default: events } = await import('node:events');
    expect(events.getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  }, 15000);
});

describe('shared snapshot ownership boundary', () => {
  it('prunes custom generated poison before descent and retains the wider included configuration boundary through recovery', async () => {
    const api = await snapshots();
    const { base, root, artifacts } = await fixture();
    await mkdir(path.join(root, 'src'));
    await mkdir(path.join(root, 'generated-output'));
    const outside = path.join(base, 'poison');
    await mkdir(outside);
    await symlink(outside, path.join(root, 'generated-output', 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    await writeFile(path.join(root, 'src', 'owned.ts'), 'original source');
    await writeFile(path.join(root, 'config.json'), 'original config');
    const snapshot = await api.snapshotWorkspace(root, artifacts, { sourceRoots: ['src'], excludedPaths: ['generated-output'] });
    await rm(path.join(root, 'src'), { recursive: true });
    await writeFile(path.join(root, 'config.json'), 'mutated config');
    await writeFile(path.join(root, 'generated-output', 'build.js'), 'keep generated');
    expect((await api.recoverSnapshot(snapshot.snapshotFile)).matches).toBe(true);
    expect(await readFile(path.join(root, 'src', 'owned.ts'), 'utf8')).toBe('original source');
    expect(await readFile(path.join(root, 'config.json'), 'utf8')).toBe('original config');
    expect(await readFile(path.join(root, 'generated-output', 'build.js'), 'utf8')).toBe('keep generated');
  });

  it('continues to recover old serialized snapshots without new boundary fields', async () => {
    const api = await snapshots();
    const { root, artifacts } = await fixture();
    await writeFile(path.join(root, 'owned'), 'original');
    const snapshot = await api.snapshotWorkspace(root, artifacts);
    const old = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
    delete old.boundary;
    await writeFile(path.join(root, 'owned'), 'new');
    expect((await api.restoreWorkspace(old)).matches).toBe(true);
    expect(await readFile(path.join(root, 'owned'), 'utf8')).toBe('original');
  });
});

async function checkpoints() {
  const module = await import('../src/generic/runtime/checkpoint.js').catch(() => null);
  expect(module, 'generic snapshot-owned checkpoint module must exist').not.toBeNull();
  return module!;
}
describe('snapshot-owned Git checkpoints', () => {
  it('rejects inherited ancestor repositories without changing their refs or index', async () => {
    const api = await snapshots();
    const checkpoint = await checkpoints();
    const { base, root, artifacts } = await fixture();
    const git = (args: string[]) => execFileSync('git', args, { cwd: base, encoding: 'utf8' });
    git(['init', '-q']);
    await writeFile(path.join(base, 'ancestor'), 'ancestor');
    git(['add', 'ancestor']);
    git(['-c', 'user.name=Runtime Test', '-c', 'user.email=runtime@example.invalid', 'commit', '-qm', 'ancestor baseline']);
    await writeFile(path.join(root, 'source.ts'), 'target');
    const beforeRefs = git(['show-ref']);
    const beforeIndex = await readFile(path.join(base, '.git', 'index'));
    const snapshot = await api.snapshotWorkspace(root, artifacts);
    await expect(checkpoint.createTargetCheckpoint(snapshot)).rejects.toThrow(/root|owned|ancestor/i);
    expect(git(['show-ref'])).toBe(beforeRefs);
    expect(await readFile(path.join(base, '.git', 'index'))).toEqual(beforeIndex);
  });

  it('commits captured included ignored bytes while excluding unignored outputs and preserving HEAD and the real index', async () => {
    const api = await snapshots();
    const checkpoint = await checkpoints();
    const { root, artifacts } = await fixture();
    const git = (args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
    git(['init', '-q']);
    await writeFile(path.join(root, '.gitignore'), 'ignored source.ts\n');
    await writeFile(path.join(root, 'tracked.ts'), 'committed');
    git(['add', '.']);
    git(['-c', 'user.name=Runtime Test', '-c', 'user.email=runtime@example.invalid', 'commit', '-qm', 'baseline']);
    await writeFile(path.join(root, 'tracked.ts'), 'staged');
    git(['add', 'tracked.ts']);
    await writeFile(path.join(root, 'tracked.ts'), 'captured dirty');
    await writeFile(path.join(root, 'ignored source.ts'), 'captured ignored');
    await mkdir(path.join(root, 'node_modules'));
    await writeFile(path.join(root, 'node_modules', 'must-exclude'), 'unignored dependency');
    await mkdir(path.join(root, 'out-custom'));
    await writeFile(path.join(root, 'out-custom', 'must-exclude'), 'unignored output');
    const snapshot = await api.snapshotWorkspace(root, artifacts, { excludedPaths: ['out-custom'] });
    const head = git(['rev-parse', 'HEAD']);
    const index = await readFile(path.join(root, '.git', 'index'));
    await writeFile(path.join(root, 'tracked.ts'), 'later mutable bytes');
    await writeFile(path.join(root, 'ignored source.ts'), 'later ignored bytes');
    const result = await checkpoint.createTargetCheckpoint(snapshot);
    expect(result.ref).toMatch(/^refs\/vibedebt\/checkpoints\//);
    expect(git(['rev-parse', result.ref]).trim()).toBe(result.commit);
    expect(git(['ls-tree', '-r', '--name-only', result.commit]).trim().split('\n')).toEqual(['.gitignore', 'ignored source.ts', 'tracked.ts']);
    expect(git(['show', `${result.commit}:ignored source.ts`])).toBe('captured ignored');
    expect(git(['show', `${result.commit}:tracked.ts`])).toBe('captured dirty');
    expect(git(['rev-parse', 'HEAD'])).toBe(head);
    expect(await readFile(path.join(root, '.git', 'index'))).toEqual(index);
    expect(await readFile(path.join(root, 'tracked.ts'), 'utf8')).toBe('later mutable bytes');
  });
});

it('restores legitimate nested build source while pruning root build output', async () => {
  const api = await snapshots();
  const { base, root, artifacts } = await fixture();
  await mkdir(path.join(root, 'src', 'build'), { recursive: true });
  await writeFile(path.join(root, 'src', 'build', 'source.ts'), 'nested source');
  const output = path.join(base, 'external-output');
  await mkdir(output);
  await symlink(output, path.join(root, 'build'), process.platform === 'win32' ? 'junction' : 'dir');
  const snapshot = await api.snapshotWorkspace(root, artifacts, { sourceRoots: ['src'] });
  await writeFile(path.join(root, 'src', 'build', 'source.ts'), 'changed');
  expect((await api.restoreWorkspace(snapshot)).matches).toBe(true);
  expect(await readFile(path.join(root, 'src', 'build', 'source.ts'), 'utf8')).toBe('nested source');
});

it('preserves legacy any-depth exclusions when recovering old snapshots without a boundary field', async () => {
  const api = await snapshots();
  const { base, root, artifacts } = await fixture();
  await mkdir(path.join(root, 'src'));
  await writeFile(path.join(root, 'owned.ts'), 'captured');
  const old = await api.snapshotWorkspace(root, artifacts);
  delete old.boundary;
  await writeFile(old.snapshotFile, JSON.stringify(old));
  await mkdir(path.join(root, 'src', 'build'));
  const outside = path.join(base, 'legacy-output');
  await mkdir(outside);
  await writeFile(path.join(outside, 'keep'), 'excluded original output');
  await symlink(outside, path.join(root, 'src', 'build', 'poison'), process.platform === 'win32' ? 'junction' : 'dir');
  await writeFile(path.join(root, 'owned.ts'), 'changed');
  expect((await api.verifySnapshot(old)).changedFiles).toEqual(['owned.ts']);
  expect((await api.recoverSnapshot(old.snapshotFile)).matches).toBe(true);
  expect(await readFile(path.join(root, 'owned.ts'), 'utf8')).toBe('captured');
  expect(await readFile(path.join(root, 'src', 'build', 'poison', 'keep'), 'utf8')).toBe('excluded original output');
});
