import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { canonicalRoot, safePath, sourcePath } from '../analysis/paths.js';
import { normalizeAnalysisOptions } from '../analysis/settings.js';
import { supervise } from '../analysis/supervise.js';
import { normalizeBoundary, type BoundaryOptions } from '../boundary.js';
import type { AnalysisOptions } from '../analysis/index.js';
export interface ExtractionSelection { sources: {file: string; className: string; memberName: string}[]; destination: string; helperName: string }
export interface ExtractionPlan { root: string; changes: {file: string; before: string | null; after: string}[]; sourceHashes: Record<string,string>; noop: boolean; boundary?: Required<BoundaryOptions>; configurationAbsent?: boolean }
export const hash = (text: string | Buffer): string => createHash('sha256').update(text).digest('hex');
export async function prepareExtraction(root: string, selection: ExtractionSelection, options: AnalysisOptions = {}): Promise<ExtractionPlan> {
  const canonical = canonicalRoot(root); const effective = normalizeAnalysisOptions(canonical, options);
  return supervise<ExtractionPlan>({ operation: 'extract', root: canonical, selection, options: effective }, effective);
}
export async function applyExtraction(plan: ExtractionPlan): Promise<void> {
  const root = canonicalRoot(plan.root);
  if (root !== plan.root) throw new Error('Stale canonical root');
  if (plan.configurationAbsent && existsSync(safePath(root, plan.boundary?.tsconfig ?? 'tsconfig.json', plan.boundary))) throw new Error('Stale configuration appeared');
  const boundary = normalizeBoundary(root, plan.configurationAbsent ? { sourceRoots: plan.boundary?.sourceRoots, excludedPaths: plan.boundary?.excludedPaths } : plan.boundary);
  if (plan.noop !== (plan.changes.length === 0)) throw new Error('Invalid no-op plan');
  const files = new Set<string>();
  for (const [file, expected] of Object.entries(plan.sourceHashes)) {
    const absolute = safePath(root, file, boundary);
    if (!existsSync(absolute) || hash(await readFile(absolute)) !== expected) throw new Error(`Stale source: ${file}`);
  }
  for (const change of plan.changes) {
    const absolute = sourcePath(root, change.file, boundary);
    if (files.has(change.file)) throw new Error('Duplicate plan path'); files.add(change.file);
    if (change.before === null) { if (existsSync(absolute)) throw new Error(`Stale destination exists: ${change.file}`); }
    else if (!plan.sourceHashes[change.file] || !existsSync(absolute) || await readFile(absolute, 'utf8') !== change.before) throw new Error(`Stale source: ${change.file}`);
  }
  // All paths and hashes are checked before the first write. Transactions own recovery.
  for (const change of [...plan.changes].sort((a, b) => Number(b.before === null) - Number(a.before === null))) {
    const absolute = sourcePath(root, change.file, boundary);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, change.after, { encoding: 'utf8', flag: change.before === null ? 'wx' : 'w' });
  }
}
