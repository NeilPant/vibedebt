import { normalizeBoundary } from '../boundary.js';
import type { AnalysisOptions } from './index.js';

const numericKeys = ['maxFiles', 'maxFileBytes', 'maxTotalBytes', 'timeoutMs', 'semanticTimeoutMs', 'heapMb'] as const;
type NumericLimits = Required<Pick<AnalysisOptions, typeof numericKeys[number]>>;
export const defaults: NumericLimits = { maxFiles: 2000, maxFileBytes: 2 * 1024 * 1024, maxTotalBytes: 32 * 1024 * 1024, timeoutMs: 30000, semanticTimeoutMs: 60000, heapMb: 512 };
export type EffectiveAnalysisOptions = Required<AnalysisOptions>;
export function normalizeAnalysisOptions(root: string, options: AnalysisOptions = {}): EffectiveAnalysisOptions {
  const limits = { ...defaults };
  for (const key of numericKeys) {
    const value = options[key] ?? defaults[key];
    if (!Number.isFinite(value) || value <= 0) throw new Error('Analysis limits must be positive finite numbers');
    limits[key] = value;
  }
  return { ...limits, ...normalizeBoundary(root, options) };
}
