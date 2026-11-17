import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateTarget, readManifest } from '../src/generic/context.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function workspace() {
  const parent = mkdtempSync(join(tmpdir(), 'vibedebt-context-')); roots.push(parent);
  const root = join(parent, 'app'), artifacts = join(parent, 'artifacts'); mkdirSync(root);
  return { root, artifacts };
}
it('rejects artifact storage overlapping the mutable target in either direction', () => {
  const { root, artifacts } = workspace();
  expect(() => validateTarget(root, join(root, '.runs'))).toThrow(/overlap/i);
  expect(() => validateTarget(root, join(root, '..'))).toThrow(/overlap/i);
  expect(() => validateTarget(root, artifacts)).not.toThrow();
});
it('rejects the engine and VibeMart as generic mutation targets', () => {
  const { artifacts } = workspace();
  expect(() => validateTarget(process.cwd(), artifacts)).toThrow(/engine|protected/i);
  expect(() => validateTarget(join(process.cwd(), 'fixtures/vibe-mart'), artifacts)).toThrow(/engine|protected/i);
});
it('rejects malformed or executable manifest data before any process is launched', () => {
  const { root } = workspace(), file = join(root, 'manifest.json');
  writeFileSync(file, JSON.stringify({ version: 9, targetDir: root }));
  expect(() => readManifest(file)).toThrow(/manifest|version/i);
  writeFileSync(file, JSON.stringify({ version: 1, root, artifacts: join(root, '..', 'artifacts'), commands: 'echo evil' }));
  expect(() => readManifest(file)).toThrow(/manifest|command/i);
});
it('accepts explicit source/config/output boundaries and rejects path escapes before execution', () => {
  const { root, artifacts } = workspace(), file = join(root, 'manifest.json');
  mkdirSync(join(root, 'lib')); mkdirSync(join(root, 'config'));
  writeFileSync(join(root, 'config/app.json'), JSON.stringify({ include: ['../lib'] }));
  const value = {
    version: 1, id: 'sample', revision: 'r', root, artifacts,
    selection: { sources: [{ file: 'lib/a.ts', className: 'A', memberName: 'headers' },
      { file: 'lib/b.ts', className: 'B', memberName: 'headers' }], destination: 'lib/headers.ts', helperName: 'headers' },
    checks: [{ label: 'check', command: process.execPath, args: [] }],
    server: { label: 'server', command: process.execPath, args: [] },
    browser: { version: 1, logicalId: 'sample', revision: 'r' },
    boundary: { sourceRoots: ['lib'], tsconfig: 'config/app.json', excludedPaths: ['generated-assets'] },
  };
  writeFileSync(file, JSON.stringify(value));
  expect(readManifest(file).boundary).toEqual(value.boundary);
  writeFileSync(file, JSON.stringify({ ...value, boundary: { ...value.boundary, sourceRoots: ['..'] } }));
  expect(() => readManifest(file)).toThrow(/boundary|path/i);
  writeFileSync(file, JSON.stringify({ ...value, boundary: { ...value.boundary, excludedPaths: ['../outside'] } }));
  expect(() => readManifest(file)).toThrow(/boundary|path/i);
});
