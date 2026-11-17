import { afterEach, expect, test } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { applyExtraction, prepareExtraction, type ExtractionSelection } from '../src/generic/extraction/index.js';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
const selection: ExtractionSelection = { sources: [{ file: 'src/a.ts', className: 'Courier', memberName: 'options' }, { file: 'src/b.ts', className: 'Messenger', memberName: 'configuration' }], destination: 'src/shared.ts', helperName: 'makeOptions' };
async function fixture(edit = '') {
  const root = await mkdtemp(join(tmpdir(), 'scoped-extract-')); roots.push(root); await mkdir(join(root, 'src'));
  await writeFile(join(root, 'package.json'), '{"type":"module"}');
  await writeFile(join(root, 'tsconfig.json'), '{"compilerOptions":{"strict":true,"target":"ES2022","module":"ESNext"},"include":["src"]}');
  for (const [file, cls, member] of [['a', 'Courier', 'options'], ['b', 'Messenger', 'configuration']]) {
    await writeFile(join(root, `src/${file}.ts`), `export class ${cls} { constructor(private vault: { read(): string | undefined }) {} ${member} = () => { const credential = this.vault.read(); ${edit} return { headers: { Authorization: credential ? \`Token \${credential}\` : undefined } }; }; run() { return this.${member}(); } }`);
  }
  return root;
}
test('retains wrapper binding and fresh session reads, exact absent property and prefix', async () => {
  const root = await fixture(); const plan = await prepareExtraction(root, selection);
  expect(plan.changes).toHaveLength(3); expect(plan.noop).toBe(false);
  expect(await readFile(join(root, 'src/a.ts'), 'utf8')).toBe(plan.changes.find(c => c.file === 'src/a.ts')?.before);
  await applyExtraction(plan);
  const script = `import { registerHooks } from 'node:module'; registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.'))return n(s+'.ts',c);throw e;}}}); const { Courier }=await import(${JSON.stringify(pathToFileURL(join(root, 'src/a.ts')).href)}); let calls=0; let token; const c=new Courier({read(){ calls++; return token; }}); const f=c.options; const absent=f(); token='abc'; const present=f(); token=''; const empty=c.run(); console.log(JSON.stringify({calls, own:Object.hasOwn(absent.headers,'Authorization'), absent:absent.headers.Authorization===undefined, present, empty:empty.headers.Authorization===undefined}));`;
  const result = JSON.parse(execFileSync(process.execPath, ['--experimental-transform-types', '--input-type=module', '-e', script], { encoding: 'utf8' }));
  expect(result).toEqual({ calls: 3, own: true, absent: true, present: { headers: { Authorization: 'Token abc' } }, empty: true });
  const noop = await prepareExtraction(root, selection); expect(noop.noop).toBe(true); expect(noop.changes).toEqual([]); await applyExtraction(noop);
}, 15000);
test('rejects an extra effect before constructing a plan', async () => {
  await expect(prepareExtraction(await fixture('console.log(credential);'), selection)).rejects.toThrow(/unsupported|effect|shape/i);
});
test('rejects a token getter rather than moving its read', async () => {
  const root = await fixture(); const file = join(root, 'src/a.ts');
  await writeFile(file, (await readFile(file, 'utf8')).replace('read(): string | undefined', 'readonly read: string | undefined').replace('this.vault.read()', 'this.vault.read'));
  await expect(prepareExtraction(root, selection)).rejects.toThrow(/unsupported|call|shape/i);
});
test('rejects incompatible selected types', async () => {
  const root = await fixture(); const file = join(root, 'src/a.ts');
  await writeFile(file, (await readFile(file, 'utf8')).replace('string | undefined', 'number'));
  await expect(prepareExtraction(root, selection)).rejects.toThrow(/type|token/i);
});
test('rejects prefixes that differ only by meaningful literal whitespace', async () => {
  const root = await fixture(); const file = join(root, 'src/b.ts');
  await writeFile(file, (await readFile(file, 'utf8')).replace('Token ${credential}', 'Token${credential}'));
  await expect(prepareExtraction(root, selection)).rejects.toThrow(/mismatch/i);
});
test('rejects a getter returning the token reader function', async () => {
  const root = await fixture(); const file = join(root, 'src/a.ts');
  await writeFile(file, (await readFile(file, 'utf8')).replace('constructor(private vault: { read(): string | undefined }) {}', 'get vault() { return { read: (): string | undefined => undefined }; }'));
  await expect(prepareExtraction(root, selection)).rejects.toThrow(/getter/i);
});
test('rejects reserved helper identifiers before creating invalid source', async () => {
  await expect(prepareExtraction(await fixture(), { ...selection, helperName: 'class' })).rejects.toThrow(/name|identifier/i);
});
test('rejects explicitly selected test files as production extraction sources', async () => {
  const root = await fixture(); await writeFile(join(root, 'src/a.test.ts'), await readFile(join(root, 'src/a.ts')));
  await expect(prepareExtraction(root, { ...selection, sources: [{ ...selection.sources[0], file: 'src/a.test.ts' }] })).rejects.toThrow(/test|production/i);
});
test('rejects stale no-op helper bytes during application', async () => {
  const root = await fixture(); await applyExtraction(await prepareExtraction(root, selection));
  const noop = await prepareExtraction(root, selection);
  await writeFile(join(root, 'src/shared.ts'), 'changed');
  await expect(applyExtraction(noop)).rejects.toThrow(/stale/i);
}, 15000);
test('rejects existing destination and stale source without writing', async () => {
  const root = await fixture(); const plan = await prepareExtraction(root, selection);
  await writeFile(join(root, 'src/shared.ts'), 'existing');
  await expect(applyExtraction(plan)).rejects.toThrow(/stale|exist|destination/i);
  expect(await readFile(join(root, 'src/a.ts'), 'utf8')).toBe(plan.changes.find(c => c.file === 'src/a.ts')?.before);
  await expect(prepareExtraction(root, selection)).rejects.toThrow(/exist|collision|partial/i);
  await rm(join(root, 'src/shared.ts')); await writeFile(join(root, 'src/b.ts'), 'changed');
  await expect(applyExtraction(plan)).rejects.toThrow(/stale/i);
  await expect(readFile(join(root, 'src/shared.ts'))).rejects.toThrow();
}, 15000);
test('rejects escapes and directory junction destinations before writes', async () => {
  const root = await fixture(); const outside = await mkdtemp(join(tmpdir(), 'scoped-outside-')); roots.push(outside);
  await expect(prepareExtraction(root, { ...selection, destination: '../escape.ts' })).rejects.toThrow(/path|escape|outside/i);
  await symlink(outside, join(root, 'linked'), 'junction');
  await expect(prepareExtraction(root, { ...selection, destination: 'linked/helper.ts' })).rejects.toThrow(/link|escape|outside/i);
});
test('rejects selected semantics resolved through a source junction outside the root', async () => {
  const root = await fixture(); const outside = await mkdtemp(join(tmpdir(), 'scoped-dependency-')); roots.push(outside);
  await writeFile(join(outside, 'model.ts'), 'export interface Store { read(): string | undefined }');
  await symlink(outside, join(root, 'src/linked'), 'junction');
  const file = join(root, 'src/a.ts');
  await writeFile(file, "import { Store } from './linked/model';\n" + (await readFile(file, 'utf8')).replace('{ read(): string | undefined }', 'Store'));
  await expect(prepareExtraction(root, selection)).rejects.toThrow(/link|outside|escape/i);
});
test('extracts with custom config and hashes selected configuration before application', async () => {
  const root = await fixture(); await mkdir(join(root, 'config'));
  const config = 'config/check.json'; const text = '{"compilerOptions":{"strict":true},"include":["../src"]}';
  await writeFile(join(root, config), text); await rm(join(root, 'tsconfig.json'));
  const plan = await prepareExtraction(root, selection, { sourceRoots: ['src'], tsconfig: config });
  expect(plan.changes).toHaveLength(3); expect(plan.sourceHashes[config]).toMatch(/^[a-f0-9]{64}$/);
  await writeFile(join(root, config), text + '\n');
  await expect(applyExtraction(plan)).rejects.toThrow(/stale/i);
  await expect(readFile(join(root, selection.destination))).rejects.toThrow();
  await writeFile(join(root, config), text); await applyExtraction(plan);
  expect((await prepareExtraction(root, selection, { sourceRoots: ['src'], tsconfig: config })).noop).toBe(true);
}, 15000);
test('hashes owned inherited configuration and rejects a newly appeared default config', async () => {
  const root = await fixture(); await mkdir(join(root, 'config'));
  await writeFile(join(root, 'config/base.json'), '{"compilerOptions":{"strict":true}}');
  await writeFile(join(root, 'config/check.json'), '{"extends":"./base.json","include":["../src"]}');
  const plan = await prepareExtraction(root, selection, { sourceRoots: ['src'], tsconfig: 'config/check.json' });
  expect(plan.sourceHashes['config/base.json']).toMatch(/^[a-f0-9]{64}$/);
  await writeFile(join(root, 'config/base.json'), '{"compilerOptions":{"strict":false}}');
  await expect(applyExtraction(plan)).rejects.toThrow(/stale/i);
  await rm(join(root, 'tsconfig.json')); const absent = await prepareExtraction(root, selection);
  await writeFile(join(root, 'tsconfig.json'), '{}');
  await expect(applyExtraction(absent)).rejects.toThrow(/stale/i);
}, 15000);
test('allows extraction destinations in legitimate src/build source directories', async () => {
  const root = await fixture(); await mkdir(join(root, 'src/build'));
  const plan = await prepareExtraction(root, { ...selection, destination: 'src/build/helper.ts' }, { sourceRoots: ['src'] });
  await applyExtraction(plan); expect(await readFile(join(root, 'src/build/helper.ts'), 'utf8')).toContain('export function makeOptions');
});
test('rejects custom excluded destinations and selections outside declared roots', async () => {
  const root = await fixture(); await mkdir(join(root, 'src/generated'));
  await expect(prepareExtraction(root, { ...selection, destination: 'src/generated/helper.ts' }, { sourceRoots: ['src'], excludedPaths: ['src/generated'] })).rejects.toThrow(/excluded|boundary/i);
  await expect(prepareExtraction(root, { ...selection, destination: 'helper.ts' }, { sourceRoots: ['src'] })).rejects.toThrow(/source root|boundary/i);
  await mkdir(join(root, 'other'));
  await expect(prepareExtraction(root, selection, { sourceRoots: ['other'] })).rejects.toThrow(/source root|boundary|effective project/i);
});
