import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { runCommand } from '../dist/generic/runtime/process.js';
import { realworldManifest, realworldRevision } from '../dist/benchmarks/realworld.js';
import { captureTarget, healTarget, previewTarget } from '../dist/generic/transaction.js';

const engine = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : resolve(process.argv[index + 1]);
};
const workspace = argument('--workspace', resolve(engine, '../VibeDebt-benchmarks'));
const baseline = argument('--baseline', join(workspace, 'realworld-28e1e43-baseline'));
await mkdir(workspace, { recursive: true });
const prepared = argument('--prepared', undefined);
const runDir = prepared ?? await mkdtemp(join(workspace, 'acceptance-'));
const report = { revision: realworldRevision, baseline, runDir, success: false };
const patch = join(engine, 'benchmarks/patches/register-import-case.patch');
const patchHash = createHash('sha256').update(await readFile(patch)).digest('hex');
if (patchHash !== 'cdfa4bec26fc18a92da10127f7377002df750f87bed6ad866b3fd7b2e9cd649e') throw new Error('Admission patch hash mismatch');
report.admissionPatch = { path: patch, sha256: patchHash, approved: true };
async function checked(command, args, cwd) {
  const result = await runCommand({ command, args, cwd, timeoutMs: 120000 });
  if (result.code !== 0 || result.timedOut) throw new Error(command + ' ' + args.join(' ') + '\n' + result.output);
  return result.output.trim();
}
try {
  if (await checked('git', ['rev-parse', 'HEAD'], baseline) !== realworldRevision) throw new Error('Benchmark revision mismatch');
  if (await checked('git', ['status', '--porcelain', '--untracked-files=no'], baseline)) throw new Error('Benchmark tracked source is dirty');
  const compatibility = realworldManifest(baseline, join(runDir, 'setup-artifacts')).admission.compatibility;
  report.compatibility = {};
  for (const [name, expected] of Object.entries(compatibility)) {
    const actual = JSON.parse(await readFile(join(baseline, 'node_modules', name, 'package.json'), 'utf8')).version;
    if (actual !== expected) throw new Error('Historical compatibility version mismatch: ' + name + ' expected ' + expected + ', actual ' + actual);
    report.compatibility[name] = actual;
  }
  const roots = [join(runDir, 'clean'), join(runDir, 'mutation')];
  for (const root of roots) {
    if (prepared) {
      if (await checked('git', ['rev-parse', 'HEAD'], root) !== realworldRevision) throw new Error('Prepared revision mismatch');
      const dirty = await checked('git', ['status', '--porcelain', '--untracked-files=all'], root);
      if (dirty !== 'M src/app/App.tsx') throw new Error('Prepared run must contain only the approved admission correction');
      const original = await checked('git', ['show', realworldRevision + ':src/app/App.tsx'], root);
      const expected = original.replace("from './register'", "from './Register'").replaceAll('\r\n', '\n').trim();
      if ((await readFile(join(root, 'src/app/App.tsx'), 'utf8')).replaceAll('\r\n', '\n').trim() !== expected) throw new Error('Prepared admission source mismatch');
      continue;
    }
    await checked('git', ['clone', '--local', '--no-hardlinks', baseline, root], workspace);
    await checked('git', ['checkout', '--detach', realworldRevision], root);
    await checked('git', ['apply', '--check', patch], root);
    await checked('git', ['apply', patch], root);
    // Independent copies retain the same admitted dependency graph without shared mutable links.
    await cp(join(baseline, 'node_modules'), join(root, 'node_modules'), {
      recursive: true, dereference: false, verbatimSymlinks: true,
      filter: path => !path.split(/[\\/]/).some(part => ['.cache', '.vite'].includes(part)),
    });
  }
  const clean = realworldManifest(roots[0], join(runDir, 'clean-artifacts'));
  const mutation = realworldManifest(roots[1], join(runDir, 'mutation-artifacts'));
  await writeFile(join(runDir, 'manifest-clean.json'), JSON.stringify(clean, null, 2));
  await writeFile(join(runDir, 'manifest-mutation.json'), JSON.stringify(mutation, null, 2));
  const anchor = await captureTarget(clean);
  const frozen = JSON.stringify(anchor);
  await writeFile(join(runDir, 'anchor.json'), JSON.stringify(anchor, null, 2));
  report.anchorHash = anchor.hash;
  report.bundleHash = anchor.bundle.hash;
  const preview = await previewTarget(clean);
  await writeFile(join(runDir, 'preview.json'), JSON.stringify(preview, null, 2));
  report.clean = await healTarget(clean, anchor, { checkpoint: true });
  if (!report.clean.success) throw new Error('Clean extraction failed: ' + report.clean.error);
  if (JSON.stringify(report.clean.plan.changes) !== JSON.stringify(preview.changes)) throw new Error('Applied extraction differs from preview');
  report.mutation = await healTarget(mutation, anchor, { afterApplyForTest: async () => {
    const helper = join(mutation.root, mutation.selection.destination);
    const before = await readFile(helper, 'utf8');
    if (!before.includes('Token ')) throw new Error('Expected authorization prefix absent; cannot inject selected fault');
    await writeFile(helper, before.replace('Token ', 'Bearer '));
  } });
  const result = report.mutation;
  const checkedTypes = result.verification?.checks.find(c => c.label === 'typecheck');
  if (checkedTypes?.code !== 0 || checkedTypes.timedOut) throw new Error('Injected tree did not pass actual target typecheck');
  if (result.success || !result.verification?.browser.failures.some(f => f.includes('Bearer '))) {
    throw new Error('Injected tree did not fail with actual authorization assertion evidence');
  }
  if (!result.rolledBack || !result.restoration?.matches || !result.restoredBrowser?.success) throw new Error('Restoration and restored replay did not pass');
  if (JSON.stringify(anchor) !== frozen) throw new Error('Anchor changed during acceptance');
  report.anchorUnchanged = true;
  report.anchorFileHash = createHash('sha256').update(await readFile(join(runDir, 'anchor.json'))).digest('hex');
  report.success = true;
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
}
await writeFile(join(runDir, 'acceptance.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ success: report.success, report: join(runDir, 'acceptance.json'), error: report.error }, null, 2));
