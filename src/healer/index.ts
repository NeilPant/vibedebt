import { existsSync, openSync, closeSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { analyzeCodebase } from '../cartographer/index.js';
import { anchor } from '../anchor/index.js';
import { runVitest, typecheck, workspace } from '../verification/vitestRunner.js';
import { prepareHealing, previewHealing } from './prepareHealing.js';
import { createCheckpoint } from './gitCheckpoint.js';
import { withRollback } from './rollbackGuard.js';
import type { HealResult, HealPlan, VerificationResult } from '../contracts/types.js';
import { assertMutableTarget, canonicalPath } from '../verification/pathSafety.js';
import { validateAnchor } from '../anchor/anchorIdentity.js';

interface HealOptions {anchorFile?:string; checkpoint?:boolean}
export function heal(targetDir:string,options:HealOptions & {dryRun:true}):Promise<HealPlan>;
export function heal(targetDir:string,options?:HealOptions & {dryRun?:false}):Promise<HealResult>;
export async function heal(targetDir: string, options: HealOptions & {dryRun?:boolean} = {}): Promise<HealResult | HealPlan> {
  assertMutableTarget(targetDir);
  const target = canonicalPath(targetDir);
  if(options.dryRun) return previewHealing(target,options.anchorFile ?? join(workspace,'.vibedebt/generated-anchor.test.ts'));
  // A lock prevents overlapping processes from capturing/restoring each other's mutations.
  mkdirSync(join(workspace, '.vibedebt'), { recursive: true });
  const lockPath = join(workspace, '.vibedebt', createHash('sha256').update(target.toLowerCase()).digest('hex') + '.lock');
  let lock: number;
  try { lock = openSync(lockPath, 'wx'); } catch { throw new Error(`Target is already being healed: ${target}`); }
  try {
    const before = analyzeCodebase(target);
    const anchorFile = resolve(options.anchorFile ?? (await anchor(target)).testFile);
    if (!existsSync(anchorFile)) throw new Error(`Anchor file does not exist: ${anchorFile}`);
    validateAnchor(anchorFile, join(target, 'src/index.ts'));
    const testFiles = [join(workspace, 'tests/fixture-invariants.test.ts'), anchorFile];
    const verify = async (): Promise<VerificationResult> => {
      const checked = await typecheck();
      if (!checked.success) return checked;
      return runVitest(testFiles);
    };
    const baseline = await verify();
    const plan:HealPlan = { targetDir: target, anchorFile, before, extractedModules: [], changes:[] };
    if (!baseline.success) return { ...plan, success: false, rolledBack: false, after: before,
      changedFiles: [], apiBoundaryFixes: [], verification: baseline, error: `Baseline verification failed; no changes made:\n${baseline.output}` };
    const apiBoundaryFixes: string[] = [];
    let checkpoint:HealResult['checkpoint'];
    const guarded = await withRollback(target, async () => {
      const prepared=prepareHealing(target,before);
      plan.extractedModules=prepared.extractedModules;plan.changes=prepared.changes;
      apiBoundaryFixes.push(...prepared.apiBoundaryFixes);
      if(options.checkpoint && prepared.changes.length) checkpoint=createCheckpoint(target);
      await prepared.project.save();
    }, verify);
    return { ...plan, ...guarded, checkpoint, after: guarded.success ? analyzeCodebase(target) : before,
      extractedModules: guarded.success ? plan.extractedModules : [], apiBoundaryFixes: guarded.success ? apiBoundaryFixes : [] };
  } finally { closeSync(lock); rmSync(lockPath, { force: true }); }
}
