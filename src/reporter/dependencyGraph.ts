import { posix } from 'node:path';
import type { TopologyReport } from '../contracts/types.js';

export const escapeEntity = (value: string): string =>
  [...value].map(c => `#${c.codePointAt(0)};`).join('');

export function dependencyGraph(report: TopologyReport): string {
  if (report.files.length === 0) return 'flowchart LR\n  empty["No source files"]';

  const paths = report.files.map(f => f.path);
  const smellFiles = new Set<string>([
    ...report.orphanedState.map(o => o.file),
    ...report.duplicatedLogic.flatMap(d => d.occurrences.map(o => o.file)),
  ]);

  if (report.files.length > 40) {
    return generateCollapsedGraph(report, paths);
  }

  const lines: string[] = ['flowchart LR'];

  // Group files by directory
  const dirMap = new Map<string, number[]>();
  for (let i = 0; i < report.files.length; i++) {
    const dir = posix.dirname(report.files[i].path) || '.';
    const list = dirMap.get(dir) ?? [];
    list.push(i);
    dirMap.set(dir, list);
  }

  const sortedDirs = [...dirMap.keys()].sort();
  for (const [dirIndex, dir] of sortedDirs.entries()) {
    const fileIndices = (dirMap.get(dir) ?? []).sort((a, b) =>
      report.files[a].path.localeCompare(report.files[b].path)
    );
    lines.push(`  subgraph dir_${dirIndex} ["${escapeEntity(dir)}"]`);
    for (const idx of fileIndices) {
      const file = report.files[idx];
      const base = posix.basename(file.path);
      const text = `${base} · ${file.lineCount} lines`;
      lines.push(`    f${idx}["${escapeEntity(text)}"]`);
    }
    lines.push('  end');
  }

  // De-duplicate and drop self edges
  const edgeSet = new Set<string>();
  for (const [index, file] of report.files.entries()) {
    for (const item of file.imports) {
      if (!item.source.startsWith('.')) continue;
      const exact = posix.normalize(posix.join(posix.dirname(file.path), item.source));
      const base = exact.replace(/\.(js|jsx)$/, '');
      const candidates = [
        exact,
        ...['.ts', '.tsx', '.js', '.jsx'].map(ext => base + ext),
        ...['.ts', '.tsx', '.js', '.jsx'].map(ext => base + '/index' + ext),
      ];
      const resolved = candidates.find(p => paths.includes(p));
      const targetIndex = resolved === undefined ? -1 : paths.indexOf(resolved);
      if (targetIndex >= 0 && targetIndex !== index) {
        edgeSet.add(`  f${index} --> f${targetIndex}`);
      }
    }
  }

  for (const edge of [...edgeSet].sort()) {
    lines.push(edge);
  }

  // Theme styling classes
  lines.push('  classDef monolith fill:#fb8e82,stroke:#e06c60,stroke-width:2px,color:#182238;');
  lines.push('  classDef focused fill:#7de2c3,stroke:#48b897,stroke-width:2px,color:#182238;');
  lines.push('  classDef smell fill:#c4bcff,stroke:#9e93ff,stroke-width:2px,color:#182238;');

  for (let i = 0; i < report.files.length; i++) {
    const file = report.files[i];
    if (file.monolithScore) {
      lines.push(`  class f${i} monolith;`);
    } else if (smellFiles.has(file.path)) {
      lines.push(`  class f${i} smell;`);
    } else {
      lines.push(`  class f${i} focused;`);
    }
  }

  return lines.join('\n');
}

function generateCollapsedGraph(report: TopologyReport, paths: string[]): string {
  const lines: string[] = ['flowchart LR'];
  const dirMap = new Map<string, number[]>();

  for (let i = 0; i < report.files.length; i++) {
    const dir = posix.dirname(report.files[i].path) || '.';
    const list = dirMap.get(dir) ?? [];
    list.push(i);
    dirMap.set(dir, list);
  }

  const sortedDirs = [...dirMap.keys()].sort();
  const dirToIndex = new Map<string, number>();

  for (const [idx, dir] of sortedDirs.entries()) {
    dirToIndex.set(dir, idx);
    const count = (dirMap.get(dir) ?? []).length;
    const text = `${dir} (${count} files)`;
    lines.push(`  d${idx}["${escapeEntity(text)}"]`);
  }

  // Inter-directory edge count
  const dirEdgeCounts = new Map<string, number>();
  for (const [fileIndex, file] of report.files.entries()) {
    const sourceDir = posix.dirname(file.path) || '.';
    for (const item of file.imports) {
      if (!item.source.startsWith('.')) continue;
      const exact = posix.normalize(posix.join(posix.dirname(file.path), item.source));
      const base = exact.replace(/\.(js|jsx)$/, '');
      const candidates = [
        exact,
        ...['.ts', '.tsx', '.js', '.jsx'].map(ext => base + ext),
        ...['.ts', '.tsx', '.js', '.jsx'].map(ext => base + '/index' + ext),
      ];
      const resolved = candidates.find(p => paths.includes(p));
      if (!resolved) continue;
      const targetDir = posix.dirname(resolved) || '.';
      if (sourceDir !== targetDir) {
        const key = `${sourceDir}=>${targetDir}`;
        dirEdgeCounts.set(key, (dirEdgeCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const sortedDirEdges = [...dirEdgeCounts.keys()].sort();
  for (const key of sortedDirEdges) {
    const [fromDir, toDir] = key.split('=>');
    const count = dirEdgeCounts.get(key) ?? 1;
    const fromIdx = dirToIndex.get(fromDir)!;
    const toIdx = dirToIndex.get(toDir)!;
    lines.push(`  d${fromIdx} -- "${count} imports" --> d${toIdx}`);
  }

  lines.push('  classDef dirNode fill:#182238,stroke:#303d5b,stroke-width:2px,color:#dae1f4;');
  for (let idx = 0; idx < sortedDirs.length; idx++) {
    lines.push(`  class d${idx} dirNode;`);
  }

  return lines.join('\n');
}
