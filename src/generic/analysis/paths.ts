import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { defaultExcludedNames, excludedPath, type BoundaryOptions } from '../boundary.js';

export const excluded = defaultExcludedNames;
export const slash = (path: string): string => path.replaceAll('\\', '/');
export const isTestSource = (path: string): boolean => /(?:^|\/)(?:__tests__|tests?|specs?)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(slash(path));
export function canonicalRoot(root: string): string {
  const absolute = resolve(root);
  if (lstatSync(absolute).isSymbolicLink()) throw new Error('Root path is a link');
  return realpathSync(absolute);
}
export function safePath(root: string, file: string, boundary: BoundaryOptions = {}): string {
  if (!file || isAbsolute(file) || /[\\:\u0000]/.test(file) || file.split('/').some(p => !p || p === '..' || p === '.')) throw new Error(`Unsafe path: ${file}`);
  if (excludedPath(file, boundary.excludedPaths)) throw new Error(`Excluded boundary path: ${file}`);
  const absolute = resolve(root, file);
  const rel = relative(root, absolute);
  if (rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`Path outside root: ${file}`);
  let current = root;
  for (const part of file.split('/')) {
    current = join(current, part);
    try {
      if (lstatSync(current).isSymbolicLink()) throw new Error(`Link path rejected: ${file}`);
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
  return absolute;
}
export function sourcePath(root: string, file: string, boundary: BoundaryOptions = {}): string {
  const absolute = safePath(root, file, boundary);
  const comparable = process.platform === 'win32' ? file.toLowerCase() : file;
  if (!(boundary.sourceRoots ?? ['.']).some(source => {
    const prefix = process.platform === 'win32' ? source.toLowerCase() : source;
    return prefix === '.' || comparable === prefix || comparable.startsWith(prefix + '/');
  })) throw new Error(`Path is outside declared source roots: ${file}`);
  return absolute;
}
