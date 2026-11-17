import { isAbsolute, relative, resolve } from 'node:path';
import { existsSync, statSync, lstatSync } from 'node:fs';
import { canonicalPath } from '../verification/pathSafety.js';

export interface BoundaryOptions { sourceRoots?: string[]; tsconfig?: string; excludedPaths?: string[] }
export const defaultExcludedNames = new Set([
  'node_modules', 'dist', 'build', 'coverage', '.git', '.vite', 'cache', 'caches',
  '.cache', '.turbo', '.next', '.vibedebt', 'artifacts',
]);
const anywhereExcludedNames = new Set(['node_modules', '.git', '.vite', '.cache', '.turbo', '.next', '.vibedebt']);
export function relativeSetting(value: string, allowRoot = false): string {
  if (typeof value !== 'string' || !value || /[:\0]/.test(value) || isAbsolute(value)) throw new Error('Boundary paths must be relative');
  const path = value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
  if ((path === '.' && !allowRoot) || path.split('/').some(part => !part || part === '..' || (part === '.' && path !== '.'))) {
    throw new Error('Invalid boundary path: ' + value);
  }
  return path;
}
export function excludedPath(path: string, excludedPaths: string[] = []): boolean {
  const normalized = path.replaceAll('\\', '/');
  const comparable = process.platform === 'win32' ? normalized.toLowerCase() : normalized;
  const parts = normalized.split('/');
  return parts.some(part => anywhereExcludedNames.has(part.toLowerCase())) ||
    defaultExcludedNames.has(parts[0].toLowerCase()) ||
    excludedPaths.some(setting => {
      const value = process.platform === 'win32' ? setting.toLowerCase() : setting;
      return comparable === value || comparable.startsWith(value + '/');
    });
}
export function normalizeBoundary(root: string, options: BoundaryOptions = {}, requireExisting = true): Required<BoundaryOptions> {
  if (options.sourceRoots !== undefined && (!Array.isArray(options.sourceRoots) || !options.sourceRoots.length)) throw new Error('Source roots must be a nonempty list');
  if (options.excludedPaths !== undefined && !Array.isArray(options.excludedPaths)) throw new Error('Excluded paths must be a list');
  const result = { sourceRoots: (options.sourceRoots ?? ['.']).map(path => relativeSetting(path, true)),
    tsconfig: relativeSetting(options.tsconfig ?? 'tsconfig.json'),
    excludedPaths: (options.excludedPaths ?? []).map(path => relativeSetting(path)) };
  const canonical = canonicalPath(root);
  // Excluded paths are lexical pruning rules; never follow a poison output link.
  for (const item of [...result.sourceRoots, result.tsconfig]) {
    const resolved = canonicalPath(resolve(canonical, item)), rest = relative(canonical, resolved);
    if (rest.startsWith('..') || isAbsolute(rest)) throw new Error('Boundary path escapes the target: ' + item);
  }
  for (const path of result.sourceRoots) {
    if (path !== '.' && excludedPath(path, result.excludedPaths)) throw new Error('Source root is excluded: ' + path);
    const full = resolve(canonical, path);
    if (requireExisting && (!existsSync(full) || lstatSync(full).isSymbolicLink() || !statSync(full).isDirectory())) throw new Error('Source root must be an existing non-link directory: ' + path);
  }
  if (excludedPath(result.tsconfig, result.excludedPaths)) throw new Error('TypeScript configuration is excluded');
  if (requireExisting && options.tsconfig !== undefined && !existsSync(resolve(canonical, result.tsconfig))) throw new Error('Selected TypeScript configuration does not exist');
  return result;
}
