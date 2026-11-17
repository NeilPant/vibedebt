import { supervise } from './supervise.js';
import { normalizeAnalysisOptions } from './settings.js';
import { canonicalRoot } from './paths.js';
import type { BoundaryOptions } from '../boundary.js';
export interface AnalysisOptions extends BoundaryOptions { maxFiles?: number; maxFileBytes?: number; maxTotalBytes?: number; timeoutMs?: number; semanticTimeoutMs?: number; heapMb?: number }
export interface AnalysisCandidate { file: string; className: string; memberName: string; resolved: boolean; evidence?: string; rejection?: string }
export interface SourceLocation { line: number; column: number }
export interface SyntaxDeclaration extends SourceLocation { name: string; kind?: string }
export interface SyntaxImport extends SourceLocation { specifier: string; bindings: { local: string; imported: string; typeOnly: boolean }[] }
export interface SyntaxExport extends SourceLocation { name: string; kind: string; local?: string; specifier?: string }
export interface HookCall extends SourceLocation { callee: string; hook: string }
export interface ApiCall extends SourceLocation { callee: string; method: string }
export interface AnalysisFile { path: string; lineCount?: number; declarations?: SyntaxDeclaration[]; functions?: SyntaxDeclaration[]; classes?: SyntaxDeclaration[]; imports?: SyntaxImport[]; exports?: SyntaxExport[]; hookCalls?: HookCall[]; apiCalls?: ApiCall[] }
export interface AnalysisReport { complete: boolean; files: AnalysisFile[]; candidates: AnalysisCandidate[]; diagnostics: string[] }
export async function mapTarget(root: string, options: AnalysisOptions = {}): Promise<AnalysisReport> {
  try {
    const canonical = canonicalRoot(root); const effective = normalizeAnalysisOptions(canonical, options);
    return await supervise<AnalysisReport>({ operation: 'map', root: canonical, options: effective }, effective);
  } catch (error) { return { complete: false, files: [], candidates: [], diagnostics: [error instanceof Error ? error.message : String(error)] }; }
}
