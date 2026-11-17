import type { Command } from 'commander';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, isAbsolute } from 'node:path';
import { canonicalPath } from '../verification/pathSafety.js';
import type { TargetManifest, TargetAnchor } from '../generic/context.js';

async function manifest(file: string, recovery = false): Promise<TargetManifest> {
  return (await import('../generic/context.js')).readManifest(file, { recovery });
}
async function save(config: TargetManifest, path: string, data: unknown): Promise<void> {
  const root = canonicalPath(config.artifacts), output = canonicalPath(path), rest = relative(root, output);
  if (!rest || rest.startsWith('..') || isAbsolute(rest)) throw new Error('Output must be a file inside the manifest artifact directory');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(data, null, 2), { flag: 'wx' });
}
export function registerGenericCommands(program: Command): void {
  program.command('target-map').description('Analyze an isolated target using its declared source configuration')
    .requiredOption('--manifest <path>', 'Target manifest JSON').action(async (options: { manifest: string }) => {
      const config = await manifest(options.manifest);
      const report = await (await import('../generic/analysis/index.js')).mapTarget(config.root, config.boundary);
      console.log(JSON.stringify(report, null, 2));
      if (!report.complete) process.exitCode = 1;
    });
  program.command('target-preview').description('Preview a bounded extraction without writing target or artifact files')
    .requiredOption('--manifest <path>', 'Target manifest JSON').action(async (options: { manifest: string }) => {
      console.log(JSON.stringify(await (await import('../generic/transaction.js')).previewTarget(await manifest(options.manifest)), null, 2));
    });
  program.command('target-anchor').description('Capture and verify frozen browser/API observations on the original target')
    .requiredOption('--manifest <path>', 'Target manifest JSON').requiredOption('--out <path>', 'New anchor file in artifact directory')
    .action(async (options: { manifest: string; out: string }) => {
      const config = await manifest(options.manifest);
      const anchor = await (await import('../generic/transaction.js')).captureTarget(config);
      await save(config, options.out, anchor); console.log('Verified anchor saved to ' + options.out);
    });
  program.command('target-heal').description('Apply a bounded extraction behind target checks and immutable browser anchors')
    .requiredOption('--manifest <path>', 'Target manifest JSON').requiredOption('--anchor <path>', 'Existing frozen anchor JSON')
    .option('--checkpoint', 'Retain a separate-index Git recovery checkpoint')
    .action(async (options: { manifest: string; anchor: string; checkpoint?: boolean }) => {
      const config = await manifest(options.manifest), anchor: TargetAnchor = JSON.parse(await readFile(options.anchor, 'utf8')) as TargetAnchor;
      const result = await (await import('../generic/transaction.js')).healTarget(config, anchor, { checkpoint: options.checkpoint });
      console.log(JSON.stringify(result, null, 2)); if (!result.success) process.exitCode = 1;
    });
  program.command('target-recover').description('Restore an external source snapshot and verify the original bytes')
    .requiredOption('--manifest <path>', 'Target manifest JSON').requiredOption('--snapshot <path>', 'Recovery snapshot JSON')
    .action(async (options: { manifest: string; snapshot: string }) => {
      const config = await manifest(options.manifest, true);
      const data: unknown = JSON.parse(await readFile(options.snapshot, 'utf8'));
      if (typeof data !== 'object' || data === null || !('root' in data) ||
          typeof data.root !== 'string' || canonicalPath(data.root) !== canonicalPath(config.root)) throw new Error('Wrong-target recovery snapshot');
      const { withTargetLock } = await import('../generic/locking.js');
      const result = await withTargetLock(config.root, async () => (await import('../generic/runtime/snapshot.js')).recoverSnapshot(options.snapshot));
      console.log(JSON.stringify(result, null, 2)); if (!result.matches) process.exitCode = 1;
    });
}
