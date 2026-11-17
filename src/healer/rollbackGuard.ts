import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, rmdirSync, lstatSync, unlinkSync } from 'node:fs';
import { resolve, join, relative, dirname } from 'node:path';
import type { VerificationResult } from '../contracts/types.js';
import { assertMutableTarget } from '../verification/pathSafety.js';

interface Snapshot { files: Map<string, Buffer>; directories: Set<string> }
function snapshot(targetDir: string): Snapshot {
  const root = resolve(targetDir), files = new Map<string, Buffer>(), directories = new Set<string>();
  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (dir === root && entry.name === '.git') continue;
      const path = join(dir, entry.name), key = relative(root, path);
      if (lstatSync(path).isSymbolicLink()) throw new Error(`Refusing symbolic link in snapshot: ${path}`);
      if (entry.isDirectory()) { directories.add(key); walk(path); }
      else if (entry.isFile()) files.set(key, readFileSync(path));
      else throw new Error(`Unsupported file in snapshot: ${path}`);
    }
  }
  walk(root); return { files, directories };
}
function restore(root: string, before: Snapshot): void {
  function removeNewLinks(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (dir === root && entry.name === '.git') continue;
      const path = join(dir, entry.name);
      if (lstatSync(path).isSymbolicLink()) unlinkSync(path);
      else if (entry.isDirectory()) removeNewLinks(path);
    }
  }
  removeNewLinks(root);
  const current = snapshot(root);
  for (const key of current.files.keys()) if (!before.files.has(key)) rmSync(join(root, key));
  for (const key of [...current.directories].sort((a, b) => b.length - a.length)) {
    if (!before.directories.has(key)) rmdirSync(join(root, key));
  }
  for (const key of before.directories) mkdirSync(join(root, key), { recursive: true });
  for (const [key, bytes] of before.files) {
    mkdirSync(dirname(join(root, key)), { recursive: true }); writeFileSync(join(root, key), bytes);
  }
}

/** Restores only this exact target, including binary bytes, deleted files and empty directories. */
export async function withRollback(targetDir: string, mutate: () => Promise<void>,
  verify: () => Promise<VerificationResult>): Promise<{
    success: boolean; rolledBack: boolean; verification: VerificationResult; changedFiles: string[]; error?: string;
  }> {
  assertMutableTarget(targetDir);
  const root = resolve(targetDir), before = snapshot(root);
  let verification: VerificationResult = { success: false, passed: 0, failed: 1, output: '' };
  try {
    await mutate();
    verification = await verify();
    if (!verification.success) throw new Error(`Post-refactor verification failed: ${verification.output}`);
    const after = snapshot(root);
    const changedFiles = [...new Set([...before.files.keys(), ...after.files.keys()])]
      .filter(key => !before.files.has(key) || !after.files.has(key) || !before.files.get(key)!.equals(after.files.get(key)!))
      .map(key => key.replaceAll('\\', '/')).sort();
    return { success: true, rolledBack: false, verification, changedFiles };
  } catch (error) {
    restore(root, before);
    return { success: false, rolledBack: true, verification, changedFiles: [],
      error: error instanceof Error ? error.message : String(error) };
  }
}
