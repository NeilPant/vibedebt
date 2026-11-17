import { afterEach, expect, test } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mapTarget } from '../src/generic/analysis/index.js';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'scoped-map-')); roots.push(root);
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, baseUrl: '.', paths: { '@local/*': ['src/*'] } }, include: ['src'] }));
  await writeFile(join(root, 'src/model.ts'), 'export interface Store { read(): string | undefined }');
  await writeFile(join(root, 'src/client.ts'), "import { Store } from '@local/model'; export class Courier { constructor(private store: Store) {} options = () => { const value = this.store.read(); return { headers: { Authorization: value ? `Token ${value}` : undefined } }; }; send() { return this.options(); } }");
  return root;
}
test('prunes poison outputs before inventory and resolves configured aliases', async () => {
  const root = await fixture();
  for (const dir of ['node_modules', 'dist', '.git', '.vite', '.cache', 'coverage', 'build', '.vibedebt', 'artifacts']) {
    await mkdir(join(root, dir)); await writeFile(join(root, dir, 'poison.ts'), 'x'.repeat(2000));
  }
  await writeFile(join(root, 'src/ignored.test.ts'), 'export class TestOnly {}');
  const report = await mapTarget(root, { maxFileBytes: 1000 });
  expect(report.complete).toBe(true);
  expect(report.files.map(f => f.path).sort()).toEqual(['src/client.ts', 'src/ignored.test.ts', 'src/model.ts']);
  expect(report.candidates).toEqual(expect.arrayContaining([expect.objectContaining({ className: 'Courier', memberName: 'options', resolved: true })]));
  expect(report.diagnostics).toEqual([]);
});
test.each([{ maxFiles: 1 }, { maxFileBytes: 10 }, { maxTotalBytes: 10 }])('reports incomplete inventory when budget %j is exhausted', async options => {
  const report = await mapTarget(await fixture(), options);
  expect(report.complete).toBe(false); expect(report.diagnostics.join(' ')).toMatch(/limit|budget/i);
});
test('parent watchdog returns incomplete promptly even before inventory can run', async () => {
  const root = await fixture(); const started = Date.now();
  const report = await mapTarget(root, { timeoutMs: 1 });
  expect(report.complete).toBe(false); expect(report.diagnostics.join(' ')).toMatch(/timeout/i);
  expect(Date.now() - started).toBeLessThan(3000);
});
test('semantic watchdog has its own finite deadline', async () => {
  const report = await mapTarget(await fixture(), { semanticTimeoutMs: 1 });
  expect(report.complete).toBe(false); expect(report.diagnostics.join(' ')).toMatch(/semantic.*timeout/i);
});
test('enforces budgets on effective tsconfig sources rather than unrelated source trees', async () => {
  const root = await fixture(); await mkdir(join(root, 'unowned'));
  await writeFile(join(root, 'unowned/large.ts'), 'x'.repeat(3000));
  const report = await mapTarget(root, { maxFileBytes: 1000 });
  expect(report.complete).toBe(true); expect(report.files).toHaveLength(2);
});
test('inventories arbitrary component declarations, aliased hooks and HTTP source locations using syntax', async () => {
  const root = await fixture();
  await writeFile(join(root, 'src/dashboard.ts'), [
    "import React, { useEffect as observe, useState } from 'react';",
    "import api from './transport';",
    'export function Dashboard() {',
    '  const [value] = useState(0);',
    '  observe(() => {',
    "    void fetch('/items');",
    "    void api.get('/items');",
    '  }, []);',
    '  return value;',
    '}',
    'export class Store {}',
    'export { Dashboard as Screen };',
  ].join('\n'));
  const report = await mapTarget(root); expect(report.complete).toBe(true);
  const file = report.files.find(item => item.path === 'src/dashboard.ts');
  expect(file).toMatchObject({ lineCount: 12, functions: [{ name: 'Dashboard', line: 3, column: 1 }], classes: [{ name: 'Store', line: 11, column: 1 }] });
  expect(file?.imports).toEqual(expect.arrayContaining([expect.objectContaining({ specifier: 'react', bindings: expect.arrayContaining([{ local: 'React', imported: 'default', typeOnly: false }, { local: 'observe', imported: 'useEffect', typeOnly: false }]), line: 1, column: 1 })]));
  expect(file?.exports).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Dashboard', kind: 'function', line: 3 }), expect.objectContaining({ name: 'Screen', kind: 'named', local: 'Dashboard', line: 12 })]));
  expect(file?.hookCalls).toEqual([{ callee: 'useState', hook: 'useState', line: 4, column: 19 }, { callee: 'observe', hook: 'useEffect', line: 5, column: 3 }]);
  expect(file?.apiCalls).toEqual([{ callee: 'fetch', method: 'FETCH', line: 6, column: 10 }, { callee: 'api.get', method: 'GET', line: 7, column: 10 }]);
});
test('uses declared roots and custom config-relative aliases while pruning custom poison output', async () => {
  const root = await fixture(); await mkdir(join(root, 'config')); await mkdir(join(root, 'src/generated')); await mkdir(join(root, 'unowned'));
  await writeFile(join(root, 'src/generated/poison.ts'), 'x'.repeat(3000));
  await writeFile(join(root, 'unowned/poison.ts'), 'x'.repeat(3000));
  await writeFile(join(root, 'config/check.json'), JSON.stringify({ compilerOptions: { strict: true, baseUrl: '..', paths: { '@local/*': ['src/*'] } }, include: ['../src'] }));
  const report = await mapTarget(root, { sourceRoots: ['src'], tsconfig: 'config/check.json', excludedPaths: ['src/generated'], maxFileBytes: 1000, maxFiles: 2 });
  expect(report.complete).toBe(true); expect(report.files.map(file => file.path).sort()).toEqual(['src/client.ts', 'src/model.ts']);
  expect(report.candidates).toEqual(expect.arrayContaining([expect.objectContaining({ className: 'Courier', resolved: true })]));
});
test('rejects an explicitly missing selected config but supports an absent default config', async () => {
  const root = await fixture(); await rm(join(root, 'tsconfig.json'));
  const implicit = await mapTarget(root); expect(implicit.complete).toBe(true);
  const explicit = await mapTarget(root, { tsconfig: 'config/missing.json' });
  expect(explicit.complete).toBe(false); expect(explicit.diagnostics.join(' ')).toMatch(/configuration.*exist|config.*missing/i);
});
test('keeps legitimate src/build source while pruning root build output', async () => {
  const root = await fixture(); await mkdir(join(root, 'src/build')); await mkdir(join(root, 'build'));
  await writeFile(join(root, 'src/build/feature.ts'), 'export const feature = 42;');
  await writeFile(join(root, 'build/poison.ts'), 'x'.repeat(3000));
  const report = await mapTarget(root, { sourceRoots: ['src'], maxFileBytes: 1000 });
  expect(report.complete).toBe(true); expect(report.files.map(file => file.path)).toContain('src/build/feature.ts');
});
test('prunes custom excluded junctions without following their outside source tree', async () => {
  const root = await fixture(); const outside = await mkdtemp(join(tmpdir(), 'scoped-poison-')); roots.push(outside);
  await writeFile(join(outside, 'poison.ts'), 'x'.repeat(3000));
  await symlink(outside, join(root, 'src/generated'), 'junction');
  const report = await mapTarget(root, { sourceRoots: ['src'], excludedPaths: ['src/generated'], maxFiles: 2, maxFileBytes: 1000 });
  expect(report.complete).toBe(true); expect(report.files.map(file => file.path).sort()).toEqual(['src/client.ts', 'src/model.ts']);
});
