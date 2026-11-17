import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Project, SyntaxKind } from 'ts-morph';

function getAllFiles(dir: string, ext = '.ts'): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.worker-check') {
        files.push(...getAllFiles(fullPath, ext));
      }
    } else if (entry.name.endsWith(ext) && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('Architectural & Code Quality Standards Enforcement', () => {
  const srcFiles = getAllFiles('src');

  it('enforces that every engine file under src/ is strictly under 250 lines', () => {
    expect(srcFiles.length).toBeGreaterThan(20);
    const violations: { file: string; lines: number }[] = [];

    for (const file of srcFiles) {
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\n').length;
      if (lines > 250) {
        violations.push({ file, lines });
      }
    }

    expect(violations, `Files exceeding 250 lines: ${JSON.stringify(violations)}`).toEqual([]);
  });

  it('enforces zero explicit any keywords across all engine files under src/', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const anyViolations: { file: string; line: number }[] = [];

    for (const file of srcFiles) {
      const content = readFileSync(file, 'utf8');
      const sourceFile = project.createSourceFile(file, content, { overwrite: true });
      const anyKeywords = sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword);

      for (const node of anyKeywords) {
        anyViolations.push({
          file,
          line: node.getStartLineNumber(),
        });
      }
    }

    expect(anyViolations, `Explicit any types found: ${JSON.stringify(anyViolations)}`).toEqual([]);
  });
});
