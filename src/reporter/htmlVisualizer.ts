import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import type { TopologyReport, HealResult } from '../contracts/types.js';
import { dashboardStyle } from './dashboardStyle.js';

const escape = (value: string): string => value.replace(/[&<>"']/g, c =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c] ?? c));

export function dependencyGraph(report: TopologyReport): string {
  const paths = report.files.map(f => f.path);
  // Numeric entities keep filenames inert inside Mermaid's quoted labels.
  const label = (path: string): string => [...path].map(c => `#${c.codePointAt(0)};`).join('');
  const nodes = paths.map((path, i) => `f${i}["${label(path)}"]`);
  for (const [index, file] of report.files.entries()) for (const item of file.imports) {
    if (!item.source.startsWith('.')) continue;
    const exact = posix.normalize(posix.join(posix.dirname(file.path), item.source));
    const base = exact.replace(/\.(js|jsx)$/, '');
    const candidates=[exact,...['.ts','.tsx','.js','.jsx'].map(ext=>base+ext),
      ...['.ts','.tsx','.js','.jsx'].map(ext=>base+'/index'+ext)];
    const resolved=candidates.find(path=>paths.includes(path));
    const found=resolved===undefined?-1:paths.indexOf(resolved);
    if (found >= 0) nodes.push(`f${index} --> f${found}`);
  }
  return 'flowchart LR\n' + nodes.join('\n');
}

export function htmlDashboard(report: TopologyReport, heal?: HealResult): string {
  const after = heal?.after;
  const counts = (r: TopologyReport): number[] => [r.files.length, r.duplicatedLogic.length, r.orphanedState.length, r.apiInconsistencies.length];
  const names = ['Source files', 'Duplicate clusters', 'Orphaned state', 'API inconsistencies'];
  const metrics = counts(report).map((n, i) => `<div class="metric">${names[i]}<strong>${n}</strong>
    ${after ? `Before &rarr; After <b>${counts(after)[i]}</b>` : '<small>Current topology</small>'}</div>`).join('');
  const tiles = report.files.map(file => `<article class="tile ${file.monolithScore ? 'hot' : 'cool'}" data-filter="${escape(file.path.toLowerCase())}">
    <h3>${escape(file.path)}</h3><b>${file.lineCount} lines</b> &middot; ${file.functions.length} functions
    <div class="muted">${file.monolithScore ? 'Monolithic component' : 'Focused source file'} &middot; ${file.stateHooks.length} state hooks</div></article>`).join('');
  const duplicates = report.duplicatedLogic.map((cluster, i) => `<details data-filter="${escape(cluster.occurrences.map(o => o.file).join(' ').toLowerCase())}">
    <summary>Cluster ${i + 1} &middot; ${escape(cluster.category)} &middot; ${cluster.occurrences.length} occurrences</summary>
    <div class="evidence">${cluster.occurrences.map(o => `<article><h3>${escape(o.file)}:${o.line}</h3><pre>${escape(o.snippet ?? cluster.signature)}</pre></article>`).join('')}</div>
    <details><summary>Normalized AST signature</summary><pre>${escape(cluster.signature)}</pre></details></details>`).join('');
  const orphans = report.orphanedState.map(o => `<article data-filter="${escape(o.file.toLowerCase())}"><span class="badge">${escape(o.kind)}</span>
    <b>${escape(o.name)}</b><div>${escape(o.file)}:${o.line}</div><small>${escape(o.reason)}</small></article>`).join('');
  const runtime = readFileSync(new URL('../../assets/mermaid.min.js', import.meta.url), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>VibeDebt · Architecture observatory</title><style>${dashboardStyle}</style></head><body><main>
<header><span class="eyebrow">VibeDebt / Architecture observatory</span><h1>Untangle your architecture.</h1>
<p class="muted">Source evidence, dependency topology, and measured refactoring outcomes. Runs entirely offline.</p>
<nav><a href="#topology">Dependencies</a><a href="#heatmap">Heatmap</a><a href="#duplicates">Duplicated math</a><a href="#orphans">Orphaned state</a></nav>
<label>Filter source evidence <input id="filter" type="search" placeholder="Find a source file…"></label>
<button id="expand" type="button">Expand diff cards</button></header>
<div class="metrics">${metrics}</div>
${heal ? `<p>${heal.success ? 'Verified refactor' : 'Refactor failed'} · ${heal.verification.passed} passing / ${heal.verification.failed} failed · ${heal.rolledBack ? 'Rolled back' : 'No rollback needed'}</p>` : ''}
${heal?.checkpoint ? `<p>Recovery checkpoint: <code>${escape(heal.checkpoint.ref)}</code> (${escape(heal.checkpoint.commit)})</p>` : ''}
<section id="topology"><h2>Dependency graph</h2><div class="graph"><pre class="mermaid">${escape(dependencyGraph(report))}</pre></div>
<details><summary>Mermaid source</summary><pre>${escape(dependencyGraph(report))}</pre></details></section>
<section id="heatmap"><h2>Monolith heatmap</h2><p class="muted">Coral marks JSX functions spanning at least 300 lines.</p><div class="heatmap">${tiles || 'No source files.'}</div></section>
<section id="duplicates"><h2>Duplicated math · source comparison</h2><p class="muted">Repeated AST expressions, including nested expressions; each cluster is not an independent defect.</p>${duplicates || 'No duplicated logic detected.'}</section>
<section id="orphans"><h2>Orphaned state</h2><div class="evidence">${orphans || 'No unread state detected.'}</div></section>
<section><h2>API boundaries</h2>${report.apiInconsistencies.map(a => `<p><b>${escape(a.resource)}</b> ${a.endpoints.map(e => `<span class="badge">${escape(e)}</span>`).join('')}</p>`).join('') || 'No inconsistent routes detected.'}</section>
<section><h2>Business intent</h2>${(after?.businessIntents ?? report.businessIntents ?? []).map(i => `<article><b>${escape(i.name)}</b><span class="badge">${i.source}</span><p>${escape(i.summary)}</p></article>`).join('') || 'No domain functions discovered.'}</section>
<footer>Generated by VibeDebt. Mermaid 11.12.2 (MIT); runtime embedded. All values describe the analyzed snapshot.</footer>
</main><script>${runtime}</script><script>
mermaid.initialize({startOnLoad:false,theme:'dark',securityLevel:'strict',flowchart:{htmlLabels:false}});
mermaid.run({querySelector:'.mermaid'}).catch(()=>{document.querySelector('.graph').textContent='Graph could not render; open Mermaid source below.'});
document.getElementById('filter').addEventListener('input',event=>{const q=event.target.value.toLowerCase();
document.querySelectorAll('[data-filter]').forEach(el=>{el.hidden=!el.dataset.filter.includes(q)});});
document.getElementById('expand').addEventListener('click',()=>{const cards=[...document.querySelectorAll('#duplicates>details')];
const open=cards.some(el=>!el.open);cards.forEach(el=>{el.open=open});});
</script></body></html>`;
}
