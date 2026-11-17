import { existsSync, realpathSync } from 'node:fs';
import { resolve, relative, dirname, basename, join, isAbsolute } from 'node:path';

/** Resolve existing ancestors so junctions and symbolic links cannot bypass boundaries. */
export function canonicalPath(path: string): string {
  const absolute = resolve(path);
  const realpathFn = realpathSync.native ?? realpathSync;
  const resolved = existsSync(absolute) ? realpathFn(absolute) : (() => {
    const parent = dirname(absolute);
    return parent === absolute ? absolute : join(canonicalPath(parent), basename(absolute));
  })();
  if (process.platform === 'win32' && resolved.length >= 2 && resolved[1] === ':') {
    return resolved[0].toUpperCase() + resolved.slice(1);
  }
  return resolved;
}
function contains(parent: string, child: string): boolean {
  const rest = relative(parent, child);
  return rest === '' || (!rest.startsWith('..') && !isAbsolute(rest));
}
const protectedPaths = ['fixtures/vibe-mart-pristine', 'tests/fixture-invariants.test.ts', 'scripts/reset-fixture.js'];
function rejectProtected(path: string, ancestors: boolean): void {
  const candidate = canonicalPath(path);
  for (const protectedPath of protectedPaths) {
    const guarded = canonicalPath(protectedPath);
    if (contains(guarded, candidate) || (ancestors && contains(candidate, guarded))) {
      throw new Error(`Protected workspace path cannot be modified: ${path}`);
    }
  }
}
export function assertMutableTarget(path: string): void { rejectProtected(path, true); }
export function assertArtifactPath(path: string): void { rejectProtected(path, false); }
