import { afterEach, beforeAll, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { snapshotWorkspace } from '../src/generic/runtime/snapshot.js';
import { runCommand } from '../src/generic/runtime/process.js';

const roots: string[] = [];
beforeAll(() => { execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json']); });
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
it('recovers deleted configured source roots and tsconfig through the production CLI', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'vibedebt-cli-recovery-')); roots.push(parent);
  const root = join(parent, 'app'), artifacts = join(parent, 'artifacts');
  await mkdir(join(root, 'src'), { recursive: true }); await mkdir(join(root, 'config'));
  await writeFile(join(root, 'src/value.ts'), 'export const value = 7;\n');
  const configText = JSON.stringify({ include: ['../src'] }); await writeFile(join(root, 'config/app.json'), configText);
  const boundary = { sourceRoots: ['src'], tsconfig: 'config/app.json', excludedPaths: ['generated'] };
  const snapshot = await snapshotWorkspace(root, join(artifacts, 'snapshot'), boundary);
  const manifest = {
    version: 1, id: 'recover', revision: 'r', root, artifacts, boundary,
    selection: { sources: [{ file: 'src/value.ts', className: 'A', memberName: 'header' },
      { file: 'src/value.ts', className: 'B', memberName: 'header' }], destination: 'src/header.ts', helperName: 'header' },
    checks: [{ label: 'check', command: process.execPath, args: [] }],
    server: { label: 'server', command: process.execPath, args: [] },
    browser: { version: 1, logicalId: 'recover', revision: 'r' },
  };
  const file = join(artifacts, 'manifest.json'); await writeFile(file, JSON.stringify(manifest));
  await rm(join(root, 'src'), { recursive: true }); await rm(join(root, 'config'), { recursive: true });
  const result = await runCommand({ command: process.execPath, cwd: process.cwd(), timeoutMs: 10000,
    args: [resolve('dist/cli/index.js'), 'target-recover', '--manifest', file, '--snapshot', snapshot.snapshotFile] });
  expect(result.code, result.output).toBe(0);
  expect(JSON.parse(result.output).matches).toBe(true);
  expect(await readFile(join(root, 'src/value.ts'), 'utf8')).toBe('export const value = 7;\n');
  expect(await readFile(join(root, 'config/app.json'), 'utf8')).toBe(configText);
}, 15000);
