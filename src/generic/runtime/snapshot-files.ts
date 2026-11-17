import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, stat } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import type { SnapshotEntry, WorkspaceSnapshot } from './types.js';
import { defaultExcludedNames, excludedPath, relativeSetting } from '../boundary.js';

function excluded(relative: string, excludedPaths: string[], legacyDefaults: boolean): boolean {
  return excludedPath(relative, excludedPaths) || (legacyDefaults && relative.split('/').some(part => defaultExcludedNames.has(part.toLowerCase())));
}

function nativePath(location: string): string {
  const realpathFn = realpathSync.native ?? realpathSync;
  const resolved = realpathFn(location);
  if (process.platform === 'win32' && resolved.length >= 2 && resolved[1] === ':') {
    return resolved[0].toUpperCase() + resolved.slice(1);
  }
  return resolved;
}

export function digest(bytes: Uint8Array): string { return createHash('sha256').update(bytes).digest('hex'); }
export function within(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
export function assertSeparate(root: string, artifacts: string): void {
  if (within(root, artifacts) || within(artifacts, root)) throw new Error('Snapshot artifact storage must be outside and not overlap the target');
}
export async function canonicalFuture(location: string): Promise<string> {
  const absolute = path.resolve(location);
  try {
    return nativePath(absolute);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const parent = path.dirname(absolute);
    if (parent === absolute) throw error;
    return path.join(await canonicalFuture(parent), path.basename(absolute));
  }
}
export async function inventory(root: string, excludedPaths: string[] = [], legacyDefaults = false): Promise<SnapshotEntry[]> {
  const result: SnapshotEntry[] = [];
  async function walk(directory: string, prefix: string): Promise<void> {
    for (const item of (await readdir(directory)).sort()) {
      const relative = prefix ? `${prefix}/${item}` : item;
      if (excluded(relative, excludedPaths, legacyDefaults)) continue; // Prune before lstat, including excluded junctions.
      const absolute = path.join(directory, item);
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) throw new Error(`Unsupported owned link/junction: ${relative}`);
      const mode = info.mode & 0o777;
      if (info.isDirectory()) {
        result.push({ path: relative, type: 'directory', mode });
        await walk(absolute, relative);
      } else if (info.isFile()) {
        if (info.nlink > 1) throw new Error(`Unsupported owned hard link: ${relative}`);
        result.push({ path: relative, type: 'file', mode, hash: digest(await readFile(absolute)) });
      } else throw new Error(`Unsupported special file: ${relative}`);
    }
  }
  await walk(root, '');
  return result;
}
function validEntry(value: unknown): value is SnapshotEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Partial<SnapshotEntry>;
  if (typeof e.path !== 'string' || !e.path || e.path.includes('\\') || e.path.includes(':') || e.path.includes('\0')) return false;
  if (e.path.split('/').some(p => !p || p === '.' || p === '..')) return false;
  if (path.isAbsolute(e.path) || !Number.isInteger(e.mode) || e.mode! < 0 || e.mode! > 0o777) return false;
  return e.type === 'directory' ? e.hash === undefined : e.type === 'file' && typeof e.hash === 'string' && /^[a-f0-9]{64}$/.test(e.hash);
}
export function validateSnapshot(value: unknown): asserts value is WorkspaceSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Invalid snapshot');
  const s = value as Partial<WorkspaceSnapshot>;
  if (s.version !== 1 || typeof s.root !== 'string' || typeof s.artifactDir !== 'string' || !path.isAbsolute(s.root) || !path.isAbsolute(s.artifactDir)) throw new Error('Invalid snapshot root or artifact path');
  if (s.snapshotFile !== path.join(s.artifactDir, 'snapshot.json')) throw new Error('Invalid snapshot manifest path');
  if (!s.rootIdentity || !Number.isFinite(s.rootIdentity.dev) || !Number.isFinite(s.rootIdentity.ino) || !Array.isArray(s.entries) || !s.entries.every(validEntry)) throw new Error('Invalid snapshot entries/path/identity');
  if (s.boundary !== undefined) {
    if (!s.boundary || typeof s.boundary !== 'object') throw new Error('Invalid snapshot boundary');
    for (const key of ['sourceRoots', 'excludedPaths'] as const) {
      const settings = s.boundary[key];
      if (settings !== undefined) {
        if (!Array.isArray(settings) || !settings.every(p => typeof p === 'string') || (key === 'sourceRoots' && !settings.length)) throw new Error('Invalid snapshot boundary paths');
        settings.forEach(p => {
          if (relativeSetting(p, key === 'sourceRoots') !== p) throw new Error('Snapshot boundary paths must be normalized');
        });
      }
    }
    if (s.boundary.tsconfig !== undefined && relativeSetting(s.boundary.tsconfig) !== s.boundary.tsconfig) throw new Error('Snapshot tsconfig path must be normalized');
  }
  const paths = new Map<string, SnapshotEntry>();
  for (const e of s.entries) {
    if (excluded(e.path, s.boundary?.excludedPaths ?? [], s.boundary === undefined)) throw new Error(`Snapshot entry is excluded: ${e.path}`);
    const key = process.platform === 'win32' ? e.path.toLowerCase() : e.path;
    if (paths.has(key)) throw new Error(`Invalid duplicate snapshot path: ${e.path}`);
    paths.set(key, e);
  }
  for (const e of s.entries) {
    const parts = e.path.split('/');
    parts.pop();
    while (parts.length) {
      const parent = parts.join('/');
      const key = process.platform === 'win32' ? parent.toLowerCase() : parent;
      if (paths.get(key)?.type !== 'directory') throw new Error(`Invalid snapshot parent path: ${parent}`);
      parts.pop();
    }
  }
}
export async function validateBoundary(snapshot: WorkspaceSnapshot): Promise<void> {
  validateSnapshot(snapshot);
  const root = nativePath(snapshot.root);
  if (root !== snapshot.root || (await lstat(snapshot.root)).isSymbolicLink()) throw new Error('Snapshot target root changed');
  const identity = await stat(root);
  if (identity.dev !== snapshot.rootIdentity.dev || identity.ino !== snapshot.rootIdentity.ino) throw new Error('Snapshot target identity changed');
  const artifact = nativePath(snapshot.artifactDir);
  if (artifact !== snapshot.artifactDir) throw new Error('Snapshot artifact path changed');
  assertSeparate(root, artifact);
}
export async function readBlob(snapshot: WorkspaceSnapshot, entry: SnapshotEntry): Promise<Buffer> {
  const blob = path.join(snapshot.artifactDir, 'blobs', entry.hash!);
  if (nativePath(blob) !== blob || !(await lstat(blob)).isFile()) throw new Error(`Invalid snapshot blob path: ${entry.path}`);
  const bytes = await readFile(blob);
  if (digest(bytes) !== entry.hash) throw new Error(`Snapshot blob hash corrupt: ${entry.path}`);
  return bytes;
}
