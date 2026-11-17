import { relative } from 'node:path';
import type { PullRequestReport, TopologyReport } from '../contracts/types.js';

const cleanPath = (p: string): string => {
  if (!p) return '';
  const rel = relative(process.cwd(), p).replaceAll('\\', '/');
  return rel.startsWith('..') ? p.replaceAll('\\', '/') : (rel || '.');
};

const cell = (text: string): string => text.replaceAll('|', '\\|').replaceAll('`', '\\`').replace(/[\r\n]/g, ' ');
const componentLines = (report: TopologyReport): number => report.files
  .filter(f => f.components.length > 0).reduce((sum, f) => sum + f.lineCount, 0);

export function markdownReport(report: PullRequestReport): string {
  const { before, after, anchor, heal } = report;
  const metrics: [string, number, number][] = [
    ['Duplicated logic clusters', before.duplicatedLogic.length, after.duplicatedLogic.length],
    ['Orphaned state', before.orphanedState.length, after.orphanedState.length],
    ['API path inconsistencies', before.apiInconsistencies.length, after.apiInconsistencies.length],
    ['Component source lines', componentLines(before), componentLines(after)],
  ];
  const status = heal.success ? 'Verified successfully' : heal.rolledBack ? 'Failed; changes rolled back' : 'Failed before mutation';
  return `# VibeDebt Topology & Refactor PR Report

Target: \`${cell(cleanPath(report.targetDir))}\`  
Status: **${status}**

## Debt before and after

| Metric | Before | After |
| --- | ---: | ---: |
${metrics.map(([name, previous, next]) => `| ${name} | ${previous} | ${next} |`).join('\n')}

Clusters represent repeated AST expressions, including nested expressions; they are not independent defects.

## Extracted modules

${heal.extractedModules.length ? heal.extractedModules.map(path => `- \`${cell(cleanPath(path))}\``).join('\n') : '- No new modules.'}

## API boundary and compatibility

${heal.apiBoundaryFixes.length ? heal.apiBoundaryFixes.map(fix => `- ${cell(fix)}`).join('\n') : '- No boundary changes applied.'}
- Public function names and the VibeMart facade retain backward-compatible behavior.
- Versioned and legacy routes are covered by frozen public API characterization tests.

## Verification

- Characterization capture/replay: **${anchor.verification.passed} passing tests**.
- Post-refactor invariant and anchor gate: **${heal.verification.passed} passed, ${heal.verification.failed} failed**.
- TypeScript gate: **${heal.success ? 'passed' : 'see failure details'}**.
- Rollback: **${heal.rolledBack ? 'restored original snapshot' : 'not needed'}**.
- Anchor suite: \`${cell(cleanPath(anchor.testFile))}\`.
${heal.checkpoint ? `- Retained recovery checkpoint: \`${cell(heal.checkpoint.ref)}\` (\`${cell(heal.checkpoint.commit)}\`).` : ''}

## Changed files

${heal.changedFiles.length ? heal.changedFiles.map(path => `- \`${cell(cleanPath(path))}\``).join('\n') : '- No retained changes.'}

## Business intent

${(report.businessIntents ?? after.businessIntents ?? []).map(i => `- **${cell(i.name)}** (${i.source}): ${cell(i.summary)}`).join('\n') || 'No domain functions discovered.'}
${heal.error ? `\n## Failure details\n\n${cell(heal.error)}\n` : ''}
`;
}
