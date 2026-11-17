import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { canonicalFuture, readBlob, validateBoundary, within } from './snapshot-files.js';
import type { WorkspaceSnapshot } from './types.js';

const execute = promisify(execFile);
/** A supplemental Git ref containing captured owned files, never a source of rollback bytes. */
export async function createTargetCheckpoint(snapshot: WorkspaceSnapshot): Promise<{ ref: string; commit: string }> {
  await validateBoundary(snapshot);
  const baseEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')));
  const run = async (args: string[], env: NodeJS.ProcessEnv = baseEnv): Promise<string> => {
    try {
      const result = await execute('git', args, { cwd: snapshot.root, env, windowsHide: true, encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024 });
      return result.stdout.trim();
    } catch (error) { throw new Error(`Cannot create target-owned Git checkpoint: ${error instanceof Error ? error.message : String(error)}`); }
  };
  const repositoryRoot = await canonicalFuture(await run(['rev-parse', '--show-toplevel']));
  if (repositoryRoot !== snapshot.root) throw new Error('Checkpoint requires a Git root owned exactly by the target; ancestor repositories are refused');
  const files = snapshot.entries.filter(entry => entry.type === 'file');
  for (const entry of files) await readBlob(snapshot, entry);
  const temporary = await mkdtemp(path.join(snapshot.artifactDir, 'checkpoint-index-'));
  const env = { ...baseEnv, GIT_INDEX_FILE: path.join(temporary, 'index'), GIT_OPTIONAL_LOCKS: '0' };
  const git = (args: string[]) => run(args, env);
  try {
    await git(['read-tree', '--empty']);
    for (const entry of files) {
      const blob = path.join(snapshot.artifactDir, 'blobs', entry.hash!);
      const object = await git(['hash-object', '-w', '--', blob]);
      const mode = (entry.mode & 0o111) !== 0 ? '100755' : '100644';
      // Separate argv values preserve spaces, tabs, commas and leading dashes in paths.
      await git(['update-index', '--add', '--cacheinfo', mode, object, entry.path]);
    }
    const tree = await git(['write-tree']);
    const parent = await git(['rev-parse', '--verify', 'HEAD']).catch(() => '');
    const commit = await git(['-c', 'user.name=VibeDebt', '-c', 'user.email=vibedebt@localhost', 'commit-tree', tree,
      ...(parent ? ['-p', parent] : []), '-m', 'VibeDebt: snapshot-owned checkpoint before extraction']);
    const ref = `refs/vibedebt/checkpoints/${randomUUID()}`;
    await git(['update-ref', ref, commit, '0'.repeat(commit.length)]);
    return { ref, commit };
  } finally {
    if (!within(snapshot.artifactDir, temporary) || temporary === snapshot.artifactDir) throw new Error('Checkpoint cleanup path escaped artifact directory');
    await rm(temporary, { recursive: true, force: true });
  }
}
