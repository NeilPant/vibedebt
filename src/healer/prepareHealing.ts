import { relative, resolve } from 'node:path';
import { scanProject } from '../cartographer/astScanner.js';
import { analyzeCodebase } from '../cartographer/index.js';
import { extractDomain } from './domainExtractor.js';
import { removeDeadState, rewriteEstimates, rewriteApi } from './componentRewriter.js';
import type { HealPlan, TopologyReport } from '../contracts/types.js';

/** LCS counts insertions/deletions without treating unchanged lines as removed. */
function lineChanges(before: string, after: string): {linesAdded:number; linesRemoved:number} {
  const lines=(text:string):string[] => text ? text.trimEnd().split(/\r?\n/) : [];
  const a=lines(before),b=lines(after);
  let previous=new Uint32Array(b.length+1);
  for(const left of a) {
    const current=new Uint32Array(b.length+1);
    for(let j=1;j<=b.length;j++) current[j]=left===b[j-1]?previous[j-1]+1:Math.max(previous[j],current[j-1]);
    previous=current;
  }
  return {linesAdded:b.length-previous[b.length],linesRemoved:a.length-previous[b.length]};
}
/** Builds the same AST edits for preview and execution; never calls project.save(). */
export function prepareHealing(targetDir: string, before: TopologyReport) {
  const {project,dir,sources}=scanProject(targetDir);
  const original=new Map(sources.map(s => [s.getFilePath(),{
    text:s.getFullText(),imports:s.getImportDeclarations().map(i=>i.getText()),
  }]));
  const extracted=extractDomain(project,dir),apiBoundaryFixes:string[]=[];
  const extractedModules=[...extracted.modules];
  if(!extracted.alreadyHealed) {
    for(const source of extracted.sources) removeDeadState(source,before.orphanedState);
    rewriteEstimates(extracted.sources[0]);
    extractedModules.push(...rewriteApi(project,dir,extracted.sources));
    apiBoundaryFixes.push('Components use centralized /api/v1 routes; server normalizes legacy /api aliases.');
  }
  const changes=project.getSourceFiles().flatMap(source=>{
    const old=original.get(source.getFilePath()),after=source.getFullText();
    if(old?.text===after) return [];
    const imports=source.getImportDeclarations().map(i=>i.getText());
    return [{file:relative(dir,source.getFilePath()).replaceAll('\\','/'),kind:old?'update' as const:'create' as const,
      before:old?.text??'',after,...lineChanges(old?.text??'',after),
      importsAdded:imports.filter(i=>!old?.imports.includes(i)),importsRemoved:old?.imports.filter(i=>!imports.includes(i))??[]}];
  }).sort((a,b)=>a.file.localeCompare(b.file));
  return {project,changes,extractedModules,apiBoundaryFixes};
}
export function previewHealing(targetDir: string, anchorFile: string): HealPlan {
  const target=resolve(targetDir),before=analyzeCodebase(target);
  const {changes,extractedModules}=prepareHealing(target,before);
  return {targetDir:target,anchorFile,before,changes,extractedModules,dryRun:true};
}
