import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const reset = (): void => { execFileSync(process.execPath, ['scripts/reset-fixture.js']); };
const run = (args: string[]) => spawnSync(process.execPath, ['dist/cli/index.js', ...args],
  { encoding: 'utf8', timeout: 90000, windowsHide: true });
beforeAll(() => { execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json']); });
beforeEach(reset);
afterAll(reset);

describe('built production CLI', () => {
  it('supports optional map targets and reports clear errors', () => {
    const mapped = run(['map']);
    expect(mapped.status, mapped.stderr).toBe(0);
    expect(mapped.stdout).toContain('Monolithic files: 3');
    const missing = run(['map', 'does-not-exist']);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('existing directory');
    const help = run(['--help']);
    expect(help.stdout).toMatch(/anchor[\s\S]*heal[\s\S]*run/);
    const protectedOutput = run(['run', '--out', 'tests/fixture-invariants.test.ts']);
    expect(protectedOutput.status).toBe(1);
    expect(protectedOutput.stderr).toContain('Protected workspace path');
  });
  it('prints dry-run plans without producing output artifacts', () => {
    const result=run(['run','fixtures/vibe-mart','--dry-run']);
    expect(result.status,result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({dryRun:true,extractedModules:['src/domain/pricing.ts','src/services/apiRoutes.ts']});
    const preview=run(['heal','--dry-run']);
    expect(preview.status,preview.stderr).toBe(0);
    expect(JSON.parse(preview.stdout).changes).toHaveLength(6);
    const invalid=run(['run','--dry-run','--out','preview.md']);
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain('stdout');
    // Three cold CLI processes include two independent AST scans; their combined
    // startup cost can exceed Vitest's 5s unit-test default on Windows.
  }, 15000);

  it('runs the complete pipeline, writes a truthful PR report, and can replay anchor/heal', () => {
    mkdirSync('.vibedebt', { recursive: true });
    const dir = mkdtempSync(resolve('.vibedebt/cli-'));
    try {
      const report = join(dir, 'report.md');
      const result = run(['run', 'fixtures/vibe-mart', '--out', report, '--html', join(dir,'dashboard.html')]);
      expect(result.status, result.stderr + result.stdout).toBe(0);
      const markdown = readFileSync(report, 'utf8');
      expect(markdown).toContain('# VibeDebt Topology & Refactor PR Report');
      expect(markdown).toContain('| Orphaned state | 6 | 0 |');
      expect(markdown).toContain('109');
      expect(markdown).toContain('122');
      expect(markdown).toContain('src/domain/pricing.ts');
      expect(markdown).toContain('backward');
      expect(markdown).toContain('calculatePricing');
      expect(readFileSync(join(dir,'dashboard.html'),'utf8')).toContain('122 passing');
      expect(existsSync('fixtures/vibe-mart/src/services/apiRoutes.ts')).toBe(true);
      const anchored = run(['anchor', '--out', join(dir, 'cli-anchor.test.ts')]);
      expect(anchored.status, anchored.stderr).toBe(0);
      expect(anchored.stdout).toContain('Passing tests: 109');
      const healed = run(['heal', '--anchor', join(dir, 'cli-anchor.test.ts'), '--out', join(dir, 'heal.json')]);
      expect(healed.status, healed.stderr).toBe(0);
      expect(JSON.parse(readFileSync(join(dir, 'heal.json'), 'utf8')).changedFiles).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 90000);
});
