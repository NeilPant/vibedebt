import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { anchor } from '../src/anchor/index.js';
import { extractContracts } from '../src/anchor/contractExtractor.js';
import { runVitest } from '../src/verification/vitestRunner.js';

describe('behavioral anchors', () => {
  it('retains assertion diagnostics from isolated verification failures', async () => {
    mkdirSync('.vibedebt', { recursive: true });
    const dir = mkdtempSync(resolve('.vibedebt/diagnostics-'));
    try {
      const file = join(dir, 'broken.test.ts');
      writeFileSync(file, "import {it, expect} from 'vitest'; it('sentinel mismatch', () => expect(1).toBe(2));");
      const result = await runVitest([file]);
      expect(result.success).toBe(false);
      expect(result.failed).toBe(1);
      expect(result.output).toContain('expected 1 to be 2');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('discovers re-exported contracts and records runnable public behavior', async () => {
    mkdirSync('.vibedebt', { recursive: true });
    const dir = mkdtempSync(resolve('.vibedebt/anchor-test-'));
    try {
      const contracts = extractContracts('fixtures/vibe-mart');
      expect(contracts.map(c => c.name)).toEqual(expect.arrayContaining([
        'computeCartPricing', 'ShopDashboard', 'CartItem', 'handleMockRestRequest', 'VibeMart',
      ]));
      const result = await anchor('fixtures/vibe-mart', { out: join(dir, 'generated.test.ts') });
      expect(result.testCount).toBeGreaterThan(80);
      expect(result.verification.success, result.verification.output).toBe(true);
      const source = readFileSync(result.testFile, 'utf8');
      expect(source).toContain('/src/index');
      expect(source).not.toMatch(/inMemoryOrders|discountPercent \+=|ShopDashboard\.tsx/);
      const replay = await runVitest([result.testFile]);
      expect(replay.passed).toBe(result.testCount);
      expect(replay.success, replay.output).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 60000);

  it('fails clearly on unsupported public contracts without creating output', async () => {
    mkdirSync('.vibedebt', { recursive: true });
    const dir = mkdtempSync(resolve('.vibedebt/unsupported-'));
    try {
      mkdirSync(join(dir, 'src'));
      writeFileSync(join(dir, 'src/index.ts'), 'export const unrelated = 1;');
      await expect(anchor(dir)).rejects.toThrow(/unsupported.*public/i);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
