import { relative } from 'node:path';
import { Node, SyntaxKind, ts, type SourceFile } from 'ts-morph';
import { slash } from './paths.js';
import type { AnalysisFile, ApiCall, HookCall, SourceLocation, SyntaxDeclaration, SyntaxExport, SyntaxImport } from './index.js';

const hookName = /^use[A-Z0-9]/;
const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'request']);
function location(node: Node): SourceLocation {
  const point = node.getSourceFile().getLineAndColumnAtPos(node.getStart());
  return { line: point.line, column: point.column };
}
function modifier(node: Node, kind: SyntaxKind): boolean {
  return ts.canHaveModifiers(node.compilerNode) && Boolean(ts.getModifiers(node.compilerNode)?.some(item => item.kind === kind));
}
export function syntaxInventory(root: string, file: SourceFile): AnalysisFile {
  const imports: SyntaxImport[] = [];
  const exports: SyntaxExport[] = [];
  const declarations: SyntaxDeclaration[] = [];
  const functions: SyntaxDeclaration[] = [];
  const classes: SyntaxDeclaration[] = [];
  const hookCalls: HookCall[] = [];
  const apiCalls: ApiCall[] = [];
  const hookAliases = new Map<string, string>();
  for (const statement of file.getImportDeclarations()) {
    const bindings: SyntaxImport['bindings'] = [];
    const defaultImport = statement.getDefaultImport();
    const namespaceImport = statement.getNamespaceImport();
    if (defaultImport) bindings.push({ local: defaultImport.getText(), imported: 'default', typeOnly: statement.isTypeOnly() });
    if (namespaceImport) bindings.push({ local: namespaceImport.getText(), imported: '*', typeOnly: statement.isTypeOnly() });
    for (const named of statement.getNamedImports()) {
      const imported = named.getName(); const local = named.getAliasNode()?.getText() ?? imported;
      const typeOnly = statement.isTypeOnly() || named.isTypeOnly();
      bindings.push({ local, imported, typeOnly });
      if (!typeOnly && hookName.test(imported)) hookAliases.set(local, imported);
    }
    imports.push({ specifier: statement.getModuleSpecifierValue(), bindings, ...location(statement) });
  }
  for (const statement of file.getStatements()) {
    if (Node.isExportDeclaration(statement)) {
      const specifier = statement.getModuleSpecifierValue(); const named = statement.getNamedExports();
      if (!named.length) exports.push({ name: '*', kind: 'star', ...(specifier ? { specifier } : {}), ...location(statement) });
      for (const item of named) exports.push({ name: item.getAliasNode()?.getText() ?? item.getName(), local: item.getName(), kind: 'named', ...(specifier ? { specifier } : {}), ...location(statement) });
    } else if (Node.isExportAssignment(statement)) exports.push({ name: 'default', kind: 'assignment', ...location(statement) });
    else if (modifier(statement, SyntaxKind.ExportKeyword)) {
      const names = Node.isVariableStatement(statement) ? statement.getDeclarations().map(item => item.getName()) : Node.isFunctionDeclaration(statement) || Node.isClassDeclaration(statement) || Node.isInterfaceDeclaration(statement) || Node.isTypeAliasDeclaration(statement) || Node.isEnumDeclaration(statement) ? [statement.getName() ?? 'default'] : [];
      const kind = statement.getKindName().replace(/Declaration$|Statement$/g, '').toLowerCase();
      for (const name of names) exports.push({ name: modifier(statement, SyntaxKind.DefaultKeyword) ? 'default' : name, kind, ...location(statement) });
    }
  }
  file.forEachDescendant(node => {
    if (Node.isFunctionDeclaration(node) || Node.isClassDeclaration(node) || Node.isInterfaceDeclaration(node) || Node.isTypeAliasDeclaration(node) || Node.isEnumDeclaration(node) || Node.isVariableDeclaration(node)) {
      const name = node.getName() ?? 'default';
      const declaration = { name, kind: node.getKindName().replace(/Declaration$/, '').toLowerCase(), ...location(node) };
      declarations.push(declaration);
      if (Node.isClassDeclaration(node)) classes.push(declaration);
      if (Node.isFunctionDeclaration(node)) functions.push(declaration);
    } else if (Node.isArrowFunction(node) || Node.isFunctionExpression(node) || Node.isMethodDeclaration(node)) {
      const parent = node.getParent();
      const name = Node.isMethodDeclaration(node) ? node.getName() : Node.isFunctionExpression(node) && node.getName() ? node.getName() : parent && (Node.isVariableDeclaration(parent) || Node.isPropertyDeclaration(parent) || Node.isPropertyAssignment(parent)) ? parent.getName() : undefined;
      if (name) functions.push({ name, kind: Node.isArrowFunction(node) ? 'arrow' : 'function', ...location(node) });
    }
    if (!Node.isCallExpression(node)) return;
    const expression = node.getExpression(); const callee = expression.getText();
    const name = Node.isIdentifier(expression) ? expression.getText() : Node.isPropertyAccessExpression(expression) ? expression.getName() : undefined;
    if (!name) return;
    const hook = hookAliases.get(name) ?? (hookName.test(name) ? name : undefined);
    if (hook) hookCalls.push({ callee, hook, ...location(node) });
    if (name === 'fetch' || (Node.isPropertyAccessExpression(expression) && httpMethods.has(name.toLowerCase()))) apiCalls.push({ callee, method: name === 'fetch' ? 'FETCH' : name.toUpperCase(), ...location(node) });
  });
  return { path: slash(relative(root, file.getFilePath())), lineCount: file.getFullText().split(/\r\n|\r|\n/).length, declarations, functions, classes, imports, exports, hookCalls, apiCalls };
}
