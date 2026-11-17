import { chmod, mkdir, readFile, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalFuture, assertSeparate, digest, inventory, readBlob, validateBoundary, validateSnapshot } from './snapshot-files.js';
import type { RestorationEvidence, WorkspaceSnapshot } from './types.js';
import { normalizeBoundary, type BoundaryOptions } from '../boundary.js';
export type { RestorationEvidence, SnapshotEntry, WorkspaceSnapshot } from './types.js';

export async function snapshotWorkspace(root: string, artifactDir: string, options: BoundaryOptions = {}): Promise<WorkspaceSnapshot> {
  const canonicalRoot = await canonicalFuture(root);
  const canonicalArtifacts = await canonicalFuture(artifactDir);
  assertSeparate(canonicalRoot, canonicalArtifacts);
  const identity = await stat(canonicalRoot);
  if (!identity.isDirectory()) throw new Error('Snapshot target must be a directory');
  const boundary = normalizeBoundary(canonicalRoot, options);
  const entries = await inventory(canonicalRoot, boundary.excludedPaths);
  // A fresh artifact directory prevents accidental overwrite of another recovery point.
  await mkdir(canonicalArtifacts, { recursive: true });
  await mkdir(path.join(canonicalArtifacts, 'blobs'));
  const snapshot: WorkspaceSnapshot = {
    version: 1, root: canonicalRoot, artifactDir: canonicalArtifacts,
    snapshotFile: path.join(canonicalArtifacts, 'snapshot.json'),
    rootIdentity: { dev: identity.dev, ino: identity.ino }, entries,
    boundary,
  };
  for (const entry of entries) {
    if (entry.type !== 'file') continue;
    const bytes = await readFile(path.join(canonicalRoot, entry.path));
    if (digest(bytes) !== entry.hash) throw new Error(`Workspace changed while snapshotting: ${entry.path}`);
    await writeFile(path.join(canonicalArtifacts, 'blobs', entry.hash!), bytes);
  }
  const evidence = await verifySnapshot(snapshot);
  if (!evidence.matches) throw new Error(`Workspace changed while snapshotting: ${evidence.differences.join(', ')}`);
  await writeFile(path.join(canonicalArtifacts, 'snapshot.json'), JSON.stringify(snapshot, null, 2), { flag: 'wx' });
  return snapshot;
}

export async function verifySnapshot(snapshot: WorkspaceSnapshot): Promise<RestorationEvidence> {
  await validateBoundary(snapshot);
  const current = await inventory(snapshot.root, snapshot.boundary?.excludedPaths, snapshot.boundary === undefined);
  const expected = new Map(snapshot.entries.map(e => [e.path, e]));
  const actual = new Map(current.map(e => [e.path, e]));
  const differences: string[] = [];
  const changedFiles: string[] = [];
  for (const entry of snapshot.entries) {
    const found = actual.get(entry.path);
    if (!found) differences.push(`Missing ${entry.type}: ${entry.path}`);
    else if (found.type !== entry.type) differences.push(`Type changed: ${entry.path}`);
    else {
      if (found.hash !== entry.hash) differences.push(`Bytes changed: ${entry.path}`);
      if (process.platform !== 'win32' && found.mode !== entry.mode) differences.push(`Mode changed: ${entry.path}`);
    }
    if (!found || found.type !== entry.type || found.hash !== entry.hash || (process.platform !== 'win32' && found.mode !== entry.mode)) changedFiles.push(entry.path);
  }
  for (const entry of current) if (!expected.has(entry.path)) {
    differences.push(`Created ${entry.type}: ${entry.path}`);
    changedFiles.push(entry.path);
  }
  return differences.length ? { matches: false, differences, changedFiles } : { matches: true, differences };
}

export async function restoreWorkspace(snapshot: WorkspaceSnapshot): Promise<RestorationEvidence> {
  await validateBoundary(snapshot);
  // Validate the entire current boundary and every backup before the first mutation.
  const current = await inventory(snapshot.root, snapshot.boundary?.excludedPaths, snapshot.boundary === undefined);
  for (const entry of snapshot.entries) if (entry.type === 'file') await readBlob(snapshot, entry);
  const expected = new Map(snapshot.entries.map(e => [e.path, e]));
  for (const entry of [...current].sort((a, b) => b.path.length - a.path.length)) {
    const original = expected.get(entry.path);
    if (original?.type === entry.type) continue;
    const absolute = path.join(snapshot.root, entry.path);
    if (entry.type === 'file') await rm(absolute);
    else {
      // Never recursively remove a directory: excluded children may remain in it.
      try { await rmdir(absolute); } catch (error) {
        throw new Error(`Cannot safely remove directory ${entry.path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  for (const entry of snapshot.entries.filter(e => e.type === 'directory').sort((a, b) => a.path.length - b.path.length)) {
    await mkdir(path.join(snapshot.root, entry.path), { recursive: true });
  }
  for (const entry of snapshot.entries) {
    if (entry.type === 'file') {
      const absolute = path.join(snapshot.root, entry.path);
      await writeFile(absolute, await readBlob(snapshot, entry));
      if (process.platform !== 'win32') await chmod(absolute, entry.mode);
    }
  }
  // Apply directory modes after content so originally read-only directories are usable.
  if (process.platform !== 'win32') {
    for (const entry of snapshot.entries.filter(e => e.type === 'directory').sort((a, b) => b.path.length - a.path.length)) await chmod(path.join(snapshot.root, entry.path), entry.mode);
  }
  return verifySnapshot(snapshot);
}

export async function recoverSnapshot(file: string): Promise<RestorationEvidence> {
  const value: unknown = JSON.parse(await readFile(file, 'utf8'));
  validateSnapshot(value);
  const [actual, expected] = await Promise.all([canonicalFuture(file), canonicalFuture(path.join(value.artifactDir, 'snapshot.json'))]);
  if (actual !== expected) throw new Error('Recovery manifest location does not match artifact directory');
  return restoreWorkspace(value);
}
