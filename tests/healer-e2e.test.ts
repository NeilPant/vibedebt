import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { analyzeCodebase } from '../src/cartographer/index.js';
import { anchor } from '../src/anchor/index.js';
import { heal } from '../src/healer/index.js';
import { withRollback } from '../src/healer/rollbackGuard.js';
import { runVitest } from '../src/verification/vitestRunner.js';

const target = resolve('fixtures/vibe-mart');
const reset = (): void => { execFileSync(process.execPath, ['scripts/reset-fixture.js']); };
beforeEach(reset);
afterAll(reset);

describe('map → anchor → heal', () => {
  it('previews exact changes without creating anchors, locks, artifacts or fixture files', async () => {
    const snapshot = (dir: string): Record<string,string> => !existsSync(dir) ? {} : Object.fromEntries(readdirSync(dir, {recursive:true,withFileTypes:true})
      .filter(e => e.isFile()).map(e => { const file=join(e.parentPath,e.name); return [file,readFileSync(file).toString('base64')]; }));
    const before = snapshot(target), artifacts = snapshot(resolve('.vibedebt'));
    const preview = await heal(target, {dryRun:true});
    expect(preview.dryRun).toBe(true);
    expect(preview.extractedModules).toContain('src/domain/pricing.ts');
    expect(preview.changes?.filter(c => c.kind === 'create')).toHaveLength(2);
    expect(preview.changes?.some(c => c.linesRemoved > 0 && c.importsAdded.length)).toBe(true);
    expect(snapshot(target)).toEqual(before);
    expect(snapshot(resolve('.vibedebt'))).toEqual(artifacts);
  }, 60000);
  it('extracts domain/API modules, reduces debt and passes all 13 invariants plus anchors', async () => {
    const before = analyzeCodebase(target);
    const preview = await heal(target, {dryRun:true});
    const baseline = await anchor(target);
    const result = await heal(target, { anchorFile: baseline.testFile });
    expect(result.success, result.error ?? result.verification.output).toBe(true);
    expect(result.rolledBack).toBe(false);
    for (const change of preview.changes ?? []) expect(readFileSync(join(target,change.file),'utf8')).toBe(change.after);
    expect(result.verification.passed).toBe(13 + baseline.testCount);
    expect(existsSync(join(target, 'src/domain/pricing.ts'))).toBe(true);
    expect(existsSync(join(target, 'src/services/apiRoutes.ts'))).toBe(true);
    expect(result.after.duplicatedLogic.length).toBeLessThan(before.duplicatedLogic.length);
    expect(result.after.apiInconsistencies).toEqual([]);
    expect(result.after.orphanedState).toEqual([]);
    expect(result.after.businessIntents).toHaveLength(5);
    for (const name of ['ShopDashboard', 'CheckoutModal', 'OrderManagement']) {
      const file = `src/${name}.tsx`;
      expect(result.after.files.find(f => f.path === file)!.lineCount)
        .toBeLessThan(before.files.find(f => f.path === file)!.lineCount);
    }
    const dashboard = readFileSync(join(target, 'src/ShopDashboard.tsx'), 'utf8');
    expect(dashboard).toContain('promoInputDraft');
    expect(dashboard).not.toContain('totalCatalogImpressions');
    const repeat = await heal(target, { anchorFile: baseline.testFile });
    expect(repeat.success, repeat.error).toBe(true);
    expect(repeat.changedFiles).toEqual([]);
  }, 90000);

  it('refuses mutation when supplied anchor tests already fail', async () => {
    const baseline = await anchor(target);
    const file = join(target, 'src/ShopDashboard.tsx'), original = readFileSync(file, 'utf8');
    // The supplied frozen anchor deliberately fails after its public function changes.
    const poisoned = baseline.testFile.replace('.test.ts', '-poison.test.ts');
    writeFileSync(poisoned, readFileSync(baseline.testFile, 'utf8') +
      "\nit('forced regression gate', () => expect(api.computeCartPricing([item(100)]).netTotal).toBe(123456));\n");
    try {
      const result = await heal(target, { anchorFile: poisoned });
      expect(result.success).toBe(false);
      expect(readFileSync(file, 'utf8')).toBe(original);
      expect(existsSync(join(target, 'src/domain'))).toBe(false);
    } finally { rmSync(poisoned, { force: true }); }
  }, 60000);

  it('automatically restores fixture bytes when real invariant and anchor tests fail after mutation', async () => {
    const baseline = await anchor(target);
    const file = join(target, 'src/ShopDashboard.tsx'), original = readFileSync(file);
    const result = await withRollback(target, async () => {
      writeFileSync(file, original.toString().replace('subtotal >= 200', 'subtotal >= 201'));
      mkdirSync(join(target, 'src/domain'));
      writeFileSync(join(target, 'src/domain/temporary.ts'), 'export const temporary = true;');
    }, () => runVitest(['tests/fixture-invariants.test.ts', baseline.testFile]));
    expect(result.rolledBack).toBe(true);
    expect(result.verification.failed).toBeGreaterThan(0);
    expect(readFileSync(file)).toEqual(original);
    expect(existsSync(join(target, 'src/domain'))).toBe(false);
  }, 60000);

  it('restores exact bytes after a failed post-mutation verification or exception', async () => {
    mkdirSync('.vibedebt', { recursive: true });
    const dir = mkdtempSync(resolve('.vibedebt/rollback-'));
    try {
      const file = join(dir, 'original.bin'), bytes = Buffer.from([0, 255, 13, 10]);
      writeFileSync(file, bytes);
      const result = await withRollback(dir, async () => {
        writeFileSync(file, 'broken'); mkdirSync(join(dir, 'new'));
        writeFileSync(join(dir, 'new/extra.ts'), 'bad');
      }, async () => ({success: false, passed: 0, failed: 1, output: 'regression'}));
      expect(result.rolledBack).toBe(true);
      expect(readFileSync(file)).toEqual(bytes);
      expect(existsSync(join(dir, 'new'))).toBe(false);
      const thrown = await withRollback(dir, async () => { writeFileSync(file, 'bad'); throw new Error('write failure'); },
        async () => ({success: true, passed: 1, failed: 0, output: ''}));
      expect(thrown.error).toContain('write failure');
      expect(readFileSync(file)).toEqual(bytes);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
