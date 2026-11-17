import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import { Node, SyntaxKind, ts, type Project } from 'ts-morph';
import { isTestSource, safePath, slash, sourcePath } from '../analysis/paths.js';
import { configurationContext } from '../analysis/project.js';
import type { EffectiveAnalysisOptions } from '../analysis/settings.js';
import { construction, normalized, wrapper } from './shape.js';
import { hash, type ExtractionPlan, type ExtractionSelection } from './index.js';

export function buildExtraction(root: string, project: Project, files: string[], selection: ExtractionSelection, options: EffectiveAnalysisOptions): ExtractionPlan {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, selection.helperName);
  if (!selection.sources.length || !/^[A-Za-z_$][\w$]*$/.test(selection.helperName) || scanner.scan() !== SyntaxKind.Identifier || scanner.scan() !== SyntaxKind.EndOfFileToken || ['token', 'undefined'].includes(selection.helperName)) throw new Error('Invalid selection or helper name');
  const boundary = { sourceRoots: options.sourceRoots, tsconfig: options.tsconfig, excludedPaths: options.excludedPaths };
  const configurationAbsent = !existsSync(safePath(root, options.tsconfig, options));
  const destination = sourcePath(root, selection.destination, options);
  if (!/\.ts$/.test(destination) || selection.sources.some(source => source.file === selection.destination)) throw new Error('Invalid destination path');
  const existing = existsSync(destination);
  const selected = selection.sources.map(source => {
    if (isTestSource(source.file)) throw new Error('Test files cannot be selected for production extraction');
    const absolute = sourcePath(root, source.file, options);
    const file = project.getSourceFile(absolute);
    if (!file) throw new Error(`Selected source is outside effective project: ${source.file}`);
    const cls = file.getClass(source.className);
    if (!cls) throw new Error(`Selected class symbol is missing: ${source.className}`);
    return { source, file, wrapper: wrapper(cls, source.memberName, root, options) };
  });
  if (new Set(selected.map(item => `${item.source.file}:${item.source.className}:${item.source.memberName}`)).size !== selected.length) throw new Error('Duplicate selected symbol');
  const sourceHashes: Record<string, string> = {};
  for (const file of [...files, ...selected.flatMap(item => item.wrapper.contextFiles), ...configurationContext(root, files, options)]) sourceHashes[slash(relative(root, file))] = hash(readFileSync(safePath(root, slash(relative(root, file)), options)));
  if (existsSync(safePath(root, 'package.json', options))) sourceHashes['package.json'] = hash(readFileSync(safePath(root, 'package.json', options)));
  let expression: string;
  let type: string;
  if (existing) {
    const helperFile = project.getSourceFile(destination) ?? project.addSourceFileAtPath(destination);
    const helper = helperFile.getFunction(selection.helperName);
    if (!helper || !helper.isExported() || helper.isAsync() || helper.getParameters().length !== 1 || helper.getTypeParameters().length || helper.getStatements().length !== 1) throw new Error('Destination collision or partial extraction');
    const parameter = helper.getParameters()[0]; const statement = helper.getStatements()[0];
    if (!Node.isReturnStatement(statement) || !statement.getExpression()) throw new Error('Destination collision: unsupported helper');
    expression = construction(statement.getExpressionOrThrow(), parameter);
    type = parameter.getTypeNodeOrThrow().getText();
    const expected = helperText(selection.helperName, type, expression);
    if (helperFile.getFullText() !== expected) throw new Error('Destination collision: helper is not the exact supported extraction');
    sourceHashes[selection.destination] = hash(readFileSync(destination));
    for (const item of selected) {
      const call = item.wrapper.returnExpression;
      if (!Node.isCallExpression(call) || call.getExpression().getText() !== selection.helperName || call.getArguments().length !== 1 || call.getArguments()[0].getSymbol()?.getDeclarations()[0] !== item.wrapper.declaration) throw new Error('Ambiguous partial extraction');
      const binding = call.getExpression().getSymbol()?.getAliasedSymbol();
      if (!binding?.getDeclarations().some(decl => decl === helper) || normalized(item.wrapper.tokenType) !== normalized(type)) throw new Error('Unresolved extracted helper binding or type mismatch');
    }
    return { root, changes: [], sourceHashes, noop: true, boundary, configurationAbsent };
  }
  expression = construction(selected[0].wrapper.returnExpression, selected[0].wrapper.declaration);
  type = selected[0].wrapper.tokenType;
  for (const item of selected) {
    if (normalized(construction(item.wrapper.returnExpression, item.wrapper.declaration)) !== normalized(expression) || item.wrapper.tokenType !== type) throw new Error('Selected constructions or token types mismatch');
    if (item.file.getDescendantsOfKind(SyntaxKind.Identifier).some(identifier => identifier.getText() === selection.helperName)) throw new Error('Helper name collision');
  }
  const before = new Map(selected.map(item => [item.source.file, item.file.getFullText()]));
  for (const item of selected) {
    item.wrapper.returnExpression.replaceWithText(`${selection.helperName}(${item.wrapper.declaration.getName()})`);
  }
  for (const file of new Set(selected.map(item => item.file))) {
    let specifier = slash(relative(dirname(file.getFilePath()), destination)).replace(/\.ts$/, '');
    if (!specifier.startsWith('.')) specifier = `./${specifier}`;
    if (file.getImportDeclarations().some(declaration => /^\..*\.js$/.test(declaration.getModuleSpecifierValue()))) specifier += '.js';
    file.addImportDeclaration({ namedImports: [selection.helperName], moduleSpecifier: specifier });
  }
  return { root, changes: [...[...before].map(([file, original]) => ({ file, before: original, after: project.getSourceFileOrThrow(sourcePath(root, file, options)).getFullText() })), { file: selection.destination, before: null, after: helperText(selection.helperName, type, expression) }], sourceHashes, noop: false, boundary, configurationAbsent };
}
function helperText(name: string, type: string, expression: string): string {
  return `export function ${name}(token: ${type}) {\n  return ${expression};\n}\n`;
}
