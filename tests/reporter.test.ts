import { it, expect } from 'vitest';
import { htmlDashboard, dependencyGraph } from '../src/reporter/htmlVisualizer.js';
import { analyzeCodebase } from '../src/cartographer/index.js';
import type { HealResult } from '../src/contracts/types.js';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { markdownReport } from '../src/reporter/markdownReporter.js';

const before = analyzeCodebase('fixtures/vibe-mart');
it('resolves JavaScript imports and TSX directory indices', () => {
  const report=structuredClone(before);
  report.files=report.files.slice(0,4);
  for(const [i,path] of ['a.js','b.js','c.tsx','view/index.tsx'].entries()) report.files[i]={...report.files[i],path,imports:[]};
  report.files[0].imports=[{source:'./b.js',names:[]}];
  report.files[2].imports=[{source:'./view',names:[]}];
  expect(dependencyGraph(report)).toContain('f0 --> f1');
  expect(dependencyGraph(report)).toContain('f2 --> f3');
});
it('writes HTML through the map CLI', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vibedebt-html-'));
  try {
    const file = join(dir, 'dashboard.html');
    const result = spawnSync(process.execPath, ['bin/vibedebt.js', 'map', 'fixtures/vibe-mart', '--html', file], {encoding:'utf8'});
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(file, 'utf8')).toContain('Architecture observatory');
  } finally { rmSync(dir, {recursive:true, force:true}); }
});
it('renders a self-contained interactive report with real source evidence', () => {
  const html = htmlDashboard(before);
  expect(html).toContain('VibeDebt');
  expect(html).toContain('Dependency graph');
  expect(html).toContain('Monolith heatmap');
  expect(html).toContain('Duplicated math');
  expect(html).toContain('hoveredProductIndex');
  expect(html).toContain('discountPercent');
  expect(html).toContain('mermaid.initialize');
  expect(html).toContain('addEventListener');
  expect(html).not.toMatch(/<script[^>]+src=/);
  expect(dependencyGraph(before)).toMatch(/f\d+ --> f\d+/);
});
it('shows genuine after metrics and escapes hostile paths/snippets', () => {
  const report = structuredClone(before);
  report.files[0].path = '</script><img src=x onerror=alert(1)>';
  report.duplicatedLogic[0].signature = '<svg onload=alert(1)>';
  const after = {files: [], duplicatedLogic: [], orphanedState: [], apiInconsistencies: []};
  const result: HealResult = {targetDir: 'fixture', anchorFile: '', before, after, extractedModules: [],
    success: true, rolledBack: false, changedFiles: [], apiBoundaryFixes: [],
    verification: {success: true, passed: 122, failed: 0, output: ''}};
  const html = htmlDashboard(report, result);
  expect(html).toContain('122 passing');
  expect(html).toContain('&lt;svg onload=alert(1)&gt;');
  expect(html).not.toContain('</script><img');
  expect(html).toContain('Before');
  expect(html).toContain('After');
  result.success=false;result.rolledBack=true;result.checkpoint={ref:'refs/vibedebt/checkpoints/test',commit:'abc123'};
  const markdown=markdownReport({targetDir:'fixture',before,after,heal:result,
    anchor:{targetDir:'fixture',entryPoint:'index.ts',testFile:'anchor.test.ts',contracts:[],testCount:109,
      verification:{success:true,passed:109,failed:0,output:''}}});
  expect(markdown).toContain(result.checkpoint.ref);
  expect(htmlDashboard(before,result)).toContain(result.checkpoint.ref);
});
