import { parentPort, workerData } from 'node:worker_threads';
import { relative } from 'node:path';
import { Node } from 'ts-morph';
import { canonicalRoot, isTestSource, slash } from './paths.js';
import { inventory, scopedProject } from './project.js';
import { syntaxInventory } from './syntax.js';
import { construction, wrapper } from '../extraction/shape.js';
import { buildExtraction } from '../extraction/builder.js';
import type { AnalysisCandidate, AnalysisReport } from './index.js';
import type { EffectiveAnalysisOptions } from './settings.js';
import type { ExtractionSelection } from '../extraction/index.js';

const input = workerData as { operation: 'map' | 'extract'; root: string; options: EffectiveAnalysisOptions; selection: ExtractionSelection };
try {
  const root = canonicalRoot(input.root);
  const files = inventory(root, input.options);
  const project = scopedProject(root, files, input.options);
  const admitted = project.getSourceFiles();
  const candidates: AnalysisCandidate[] = [];
  const fileEvidence = input.operation === 'map' ? admitted.map(file => syntaxInventory(root, file)) : [];
  const syntax = admitted.flatMap(file => isTestSource(relative(root, file.getFilePath())) ? [] : file.getClasses().flatMap(cls => cls.getProperties().filter(property => Node.isArrowFunction(property.getInitializer())).map(property => ({ file, cls, property }))));
  parentPort?.postMessage({ phase: 'semantic' });
  if (input.operation === 'extract') {
    const result = buildExtraction(root, project, files, input.selection, input.options);
    parentPort?.postMessage({ result });
  } else {
    for (const { file, cls, property } of syntax) {
      const candidate: AnalysisCandidate = { file: slash(relative(root, file.getFilePath())), className: cls.getName() ?? '', memberName: property.getName(), resolved: false };
      try {
        const shape = wrapper(cls, property.getName(), root, input.options); construction(shape.returnExpression, shape.declaration);
        candidate.resolved = true; candidate.evidence = `Resolved token type: ${shape.tokenType}; zero-argument provider call; pure conditional object construction`;
      } catch (error) { candidate.rejection = error instanceof Error ? error.message : String(error); }
      candidates.push(candidate);
    }
    const result: AnalysisReport = { complete: true, files: fileEvidence, candidates, diagnostics: [] };
    parentPort?.postMessage({ result });
  }
} catch (error) { parentPort?.postMessage({ error: error instanceof Error ? error.message : String(error) }); }
