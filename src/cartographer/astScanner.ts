import { statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { Node, Project, type SourceFile } from 'ts-morph';
import type { FileNode, StateHook } from '../contracts/types.js';

export function scanProject(targetDir: string): { dir: string; project: Project; sources: SourceFile[] } {
  const dir = resolve(targetDir);
  try { if (!statSync(dir).isDirectory()) throw new Error(); }
  catch { throw new Error(`Target must be an existing directory: ${targetDir}`); }
  const project = new Project({ skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: true, jsx: 4 }, skipFileDependencyResolution: true });
  const sources = project.addSourceFilesAtPaths([
    `${dir.replaceAll('\\', '/')}/**/*.{ts,tsx,js,jsx}`,
    `!${dir.replaceAll('\\', '/')}/**/node_modules/**`,
    `!${dir.replaceAll('\\', '/')}/**/*.d.ts`,
  ]).sort((a, b) => a.getFilePath().localeCompare(b.getFilePath()));
  return { dir, project, sources };
}

export function inventory(source: SourceFile, dir: string): FileNode {
  const path = relative(dir, source.getFilePath()).replaceAll('\\', '/');
  const functions: string[] = [], components: string[] = [];
  const stateHooks: StateHook[] = [];
  let monolithScore = false;
  source.forEachDescendant(node => {
    if (Node.isFunctionDeclaration(node) || Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
      const parent = node.getParent();
      const name = Node.isVariableDeclaration(parent) ? parent.getName() :
        Node.isFunctionDeclaration(node) || Node.isFunctionExpression(node) ? node.getName() : undefined;
      if (name) {
        functions.push(name);
        if (node.getDescendants().some(n => Node.isJsxElement(n) || Node.isJsxSelfClosingElement(n))) {
          components.push(name);
          if (node.getEndLineNumber() - node.getStartLineNumber() + 1 >= 300) monolithScore = true;
        }
      }
    }
    if (Node.isVariableDeclaration(node)) {
      const init = node.getInitializer(), binding = node.getNameNode();
      if (Node.isCallExpression(init) && /^(useState|React\.useState)$/.test(init.getExpression().getText()) &&
          Node.isArrayBindingPattern(binding)) {
        const [value, setter] = binding.getElements();
        stateHooks.push({ file: path, line: node.getStartLineNumber(), name: value?.getText() ?? '', setter: setter?.getText() });
      }
    }
  });
  return { path, functions, components, stateHooks, monolithScore,
    lineCount: source.getFullText().trimEnd().split(/\r?\n/).length,
    imports: source.getImportDeclarations().map(i => ({ source: i.getModuleSpecifierValue(),
      names: [i.getDefaultImport()?.getText(), i.getNamespaceImport()?.getText(),
        ...i.getNamedImports().map(n => n.getText())].filter((n): n is string => !!n) })),
    exports: [...source.getExportedDeclarations().keys()].sort() };
}
