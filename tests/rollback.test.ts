import { it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, symlinkSync, existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { withRollback } from '../src/healer/rollbackGuard.js';

it('reports deletion of an originally empty file', async () => {
  mkdirSync('.vibedebt', { recursive: true });
  const dir = mkdtempSync(resolve('.vibedebt/empty-delete-'));
  try {
    writeFileSync(join(dir, 'empty.ts'), '');
    const result = await withRollback(dir, async () => { rmSync(join(dir, 'empty.ts')); },
      async () => ({success: true, passed: 1, failed: 0, output: ''}));
    expect(result.changedFiles).toEqual(['empty.ts']);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

it('removes a newly created directory link during rollback without following it', async () => {
  mkdirSync('.vibedebt', { recursive: true });
  const dir = mkdtempSync(resolve('.vibedebt/link-rollback-'));
  try {
    const target = join(dir, 'target'), external = join(dir, 'external');
    mkdirSync(target); mkdirSync(external); writeFileSync(join(external, 'keep.txt'), 'external bytes');
    const result = await withRollback(target, async () => {
      symlinkSync(external, join(target, 'new-link'), process.platform === 'win32' ? 'junction' : 'dir');
      throw new Error('injected failure');
    }, async () => ({success: true, passed: 1, failed: 0, output: ''}));
    expect(result.rolledBack).toBe(true);
    expect(existsSync(join(target, 'new-link'))).toBe(false);
    expect(readFileSync(join(external, 'keep.txt'), 'utf8')).toBe('external bytes');
  } finally { rmSync(dir, {recursive: true, force: true}); }
});
