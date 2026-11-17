import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { anchor } from '../src/anchor/index.js';
import { heal } from '../src/healer/index.js';
import { assertArtifactPath, assertMutableTarget } from '../src/verification/pathSafety.js';
import { synthesize } from '../src/anchor/vitestSynthesizer.js';

const reset = (): void => { execFileSync(process.execPath, ['scripts/reset-fixture.js']); };
beforeEach(reset);
afterAll(reset);
describe('fail-closed safety boundaries', () => {
  it('rejects protected files, pristine targets, and their ancestor directories', async () => {
    expect(() => assertMutableTarget('fixtures/vibe-mart-pristine')).toThrow(/protected/i);
    expect(() => assertMutableTarget('fixtures')).toThrow(/protected/i);
    expect(() => assertArtifactPath('tests/fixture-invariants.test.ts')).toThrow(/protected/i);
    expect(() => assertArtifactPath('scripts/reset-fixture.js')).toThrow(/protected/i);
    const invariant = readFileSync('tests/fixture-invariants.test.ts');
    await expect(anchor('fixtures/vibe-mart', {out: 'tests/fixture-invariants.test.ts'})).rejects.toThrow(/protected/i);
    await expect(heal('fixtures/vibe-mart-pristine')).rejects.toThrow(/protected/i);
    expect(readFileSync('tests/fixture-invariants.test.ts')).toEqual(invariant);
  });
  it('rejects unrelated anchors before performing any refactoring', async () => {
    mkdirSync('.vibedebt', {recursive: true});
    const dir = mkdtempSync(resolve('.vibedebt/wrong-anchor-'));
    try {
      const file = join(dir, 'wrong.test.ts');
      writeFileSync(file, "import {it, expect} from 'vitest'; it('unrelated', () => expect(true).toBe(true));");
      await expect(heal('fixtures/vibe-mart', {anchorFile: file})).rejects.toThrow(/anchor.*target/i);
      writeFileSync(file, synthesize(resolve('fixtures/vibe-mart-pristine/src/index.ts'), file, {}));
      await expect(heal('fixtures/vibe-mart', {anchorFile: file})).rejects.toThrow(/anchor.*target/i);
    } finally { rmSync(dir, {recursive: true, force: true}); }
  }, 60000);
  it('preserves an additional public REST alias while simplifying the standard route pair', async () => {
    const file = 'fixtures/vibe-mart/src/mockApi.ts';
    writeFileSync(file, readFileSync(file, 'utf8').replace("pathname === '/api/orders') && method === 'GET'",
      "pathname === '/api/orders' || pathname === '/api/legacy-orders') && method === 'GET'"));
    const baseline = await anchor('fixtures/vibe-mart');
    writeFileSync(baseline.testFile, readFileSync(baseline.testFile, 'utf8') +
      "\nit('extra public alias preserved', async () => expect((await api.handleMockRestRequest('/api/legacy-orders')).status).toBe(200));\n");
    const result = await heal('fixtures/vibe-mart', {anchorFile: baseline.testFile});
    expect(result.success, result.error).toBe(true);
    expect(result.verification.passed).toBe(123);
  }, 60000);
  it('refuses to overwrite an existing hand-written test file', async () => {
    mkdirSync('.vibedebt', {recursive: true});
    const dir = mkdtempSync(resolve('.vibedebt/existing-output-'));
    try {
      const file = join(dir, 'manual.test.ts'); writeFileSync(file, '// preserve me');
      await expect(anchor('fixtures/vibe-mart', {out: file})).rejects.toThrow(/overwrite/i);
      expect(readFileSync(file, 'utf8')).toBe('// preserve me');
    } finally { rmSync(dir, {recursive: true, force: true}); }
  }, 60000);
  it.each(['estimate', 'effect', 'default'])('rejects an unsupported %s shape without losing behavior', async kind => {
    const baseline = await anchor('fixtures/vibe-mart');
    const file = kind === 'default' ? 'fixtures/vibe-mart/src/CheckoutModal.tsx' : 'fixtures/vibe-mart/src/ShopDashboard.tsx';
    const original = readFileSync(file, 'utf8');
    const modified = kind === 'estimate' ? original.replace('pricing.netTotal * 0.05', 'pricing.netTotal * 0.06') :
      kind === 'default' ? original.replace('cart: CartItem[],', 'cart: CartItem[] = [],') :
        original.replace('totalCatalogImpressions += data.length;', 'totalCatalogImpressions += data.length;');
    // A live effect is added alongside the otherwise dead session timer.
    const changedFile = kind === 'effect' ? 'fixtures/vibe-mart/src/CheckoutModal.tsx' : file;
    const content = kind === 'effect' ? readFileSync(changedFile, 'utf8').replace(
      'setSessionTimeoutId(timerId);', 'setSessionTimeoutId(timerId); console.info("live session effect");') : modified;
    writeFileSync(changedFile, content);
    const result = await heal('fixtures/vibe-mart', {anchorFile: baseline.testFile});
    expect(result.success, result.error).toBe(false);
    expect(result.error).toMatch(/unsupported/i);
    expect(readFileSync(changedFile, 'utf8')).toBe(content);
  }, 60000);
});
