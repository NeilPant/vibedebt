import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { canonicalPath } from '../verification/pathSafety.js';
import type { BrowserPlan, AnchorBundle } from './browser/types.js';
import type { ExtractionSelection } from './extraction/index.js';
import { normalizeBoundary, type BoundaryOptions } from './boundary.js';

export interface TargetCommand { label: string; command: string; args: string[]; timeoutMs?: number }
export interface TargetManifest {
  version: 1; id: string; revision: string; root: string; artifacts: string;
  selection: ExtractionSelection; browser: BrowserPlan; checks: TargetCommand[]; server: TargetCommand;
  boundary?: BoundaryOptions;
  admission?: { patches: { path: string; sha256: string }[]; compatibility: Record<string, string> };
}
export interface TargetAnchor {
  version: 1; id: string; revision: string; configurationHash: string; hash: string;
  sourceManifest: { path: string; type: string; hash?: string }[]; bundle: AnchorBundle;
}
function contains(parent: string, child: string): boolean {
  const rest = relative(parent, child); return rest === '' || (!rest.startsWith('..') && !isAbsolute(rest));
}
export function validateTarget(root: string, artifacts: string): void {
  const target = canonicalPath(root), output = canonicalPath(artifacts);
  const engine = canonicalPath(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
  if (!existsSync(target) || !statSync(target).isDirectory()) throw new Error('Target must be an existing directory');
  if (contains(target, output) || contains(output, target)) throw new Error('Target and artifacts overlap');
  if (contains(engine, target) || contains(target, engine)) throw new Error('Generic target overlaps the protected engine');
  if (contains(engine, output)) throw new Error('Artifacts overlap the protected engine');
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function command(value: unknown): value is TargetCommand {
  return object(value) && typeof value.label === 'string' && typeof value.command === 'string' &&
    value.command.length > 0 && Array.isArray(value.args) && value.args.every(a => typeof a === 'string') &&
    (value.timeoutMs === undefined || (typeof value.timeoutMs === 'number' && value.timeoutMs > 0 && Number.isFinite(value.timeoutMs)));
}
export function readManifest(file: string, options: { recovery?: boolean } = {}): TargetManifest {
  const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!object(value) || value.version !== 1 || typeof value.id !== 'string' ||
      typeof value.revision !== 'string' || typeof value.root !== 'string' ||
      typeof value.artifacts !== 'string' || !Array.isArray(value.checks) || !value.checks.length ||
      !value.checks.every(command) || !command(value.server) || !object(value.selection) ||
      !object(value.browser) || value.browser.logicalId !== value.id || value.browser.revision !== value.revision) {
    throw new Error('Invalid target manifest version, identity, selection or command records');
  }
  const selection = value.selection;
  if (!Array.isArray(selection.sources) || selection.sources.length < 2 ||
      !selection.sources.every(s => object(s) && ['file', 'className', 'memberName'].every(k => typeof s[k] === 'string')) ||
      typeof selection.destination !== 'string' || typeof selection.helperName !== 'string') {
    throw new Error('Invalid target manifest extraction selection');
  }
  const manifest = value as unknown as TargetManifest;
  manifest.root = resolve(dirname(file), manifest.root); manifest.artifacts = resolve(dirname(file), manifest.artifacts);
  if (value.boundary !== undefined && !object(value.boundary)) throw new Error('Invalid target manifest boundary');
  normalizeBoundary(manifest.root, manifest.boundary, !options.recovery);
  validateTarget(manifest.root, manifest.artifacts); return manifest;
}
export function configurationHash(manifest: TargetManifest): string {
  const { root: _root, artifacts: _artifacts, ...portable } = manifest;
  return createHash('sha256').update(JSON.stringify(portable)).digest('hex');
}
export function validateAnchor(manifest: TargetManifest, anchor: TargetAnchor): void {
  const { hash, ...body } = anchor;
  if (anchor.version !== 1 || anchor.id !== manifest.id || anchor.revision !== manifest.revision ||
      anchor.configurationHash !== configurationHash(manifest) || !Array.isArray(anchor.sourceManifest) ||
      hash !== createHash('sha256').update(JSON.stringify(body)).digest('hex')) {
    throw new Error('Wrong-target or stale anchor configuration; explicit recapture on the original baseline is required');
  }
}
