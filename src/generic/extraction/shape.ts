import { Node, SyntaxKind, ts, type ArrowFunction, type ClassDeclaration, type PropertyDeclaration, type Type, type VariableDeclaration } from 'ts-morph';
import { relative } from 'node:path';
import { safePath, slash } from '../analysis/paths.js';
import type { BoundaryOptions } from '../boundary.js';

export interface Wrapper { property: PropertyDeclaration; arrow: ArrowFunction; declaration: VariableDeclaration; returnExpression: Node; tokenType: string; contextFiles: string[] }
const fail = (message: string): never => { throw new Error(`Unsupported extraction shape: ${message}`); };
function tokenType(type: Type): string {
  const parts = type.isUnion() ? type.getUnionTypes() : [type];
  if (!parts.every(part => part.isString() || part.isStringLiteral() || part.isUndefined() || part.isNull())) fail('token type must resolve to string, undefined or null');
  return [...new Set(parts.map(part => part.isUndefined() ? 'undefined' : part.isNull() ? 'null' : 'string'))].sort().join(' | ');
}
export function wrapper(cls: ClassDeclaration, memberName: string, root: string, boundary: BoundaryOptions = {}): Wrapper {
  const member = cls.getMember(memberName);
  if (!member || !Node.isPropertyDeclaration(member) || member.getDecorators().length || member.isStatic()) fail('selected symbol must be an undecorated instance arrow property');
  const property = member as PropertyDeclaration;
  const arrow = property.getInitializer();
  if (!arrow || !Node.isArrowFunction(arrow) || arrow.isAsync() || arrow.getParameters().length || arrow.getTypeParameters().length) fail('selected member must be a synchronous zero-argument arrow');
  const fn = arrow as ArrowFunction; const body = fn.getBody();
  if (!Node.isBlock(body)) fail('expected two-statement body');
  const statements = body.asKindOrThrow(SyntaxKind.Block).getStatements();
  if (statements.length !== 2 || !Node.isVariableStatement(statements[0]) || !Node.isReturnStatement(statements[1])) fail('extra effects or unsupported wrapper statements');
  const first = statements[0].asKindOrThrow(SyntaxKind.VariableStatement);
  if (first.getDeclarationKind() !== 'const' || first.getDeclarations().length !== 1) fail('expected one constant token read');
  const declaration = first.getDeclarations()[0];
  if (!Node.isIdentifier(declaration.getNameNode())) fail('destructuring token');
  const call = declaration.getInitializer();
  if (!call || !Node.isCallExpression(call) || call.getArguments().length || call.getTypeArguments().length) fail('token read must be one resolved zero-argument call');
  const read = declaration.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
  const callee = read.getExpression();
  if (!Node.isPropertyAccessExpression(callee)) fail('token provider must be a property-access call');
  let access: Node = callee; const contextFiles: string[] = [];
  while (Node.isPropertyAccessExpression(access)) {
    const symbol = access.getNameNode().getSymbol();
    if (!symbol || !symbol.getDeclarations().length || symbol.getDeclarations().some(decl => Node.isGetAccessorDeclaration(decl) || Node.isSetAccessorDeclaration(decl))) fail('unresolved property binding or getter');
    for (const decl of symbol!.getDeclarations()) {
      const file = decl.getSourceFile(); const path = file.getFilePath();
      if (file.isDeclarationFile() && slash(path).includes('/node_modules/')) continue;
      contextFiles.push(safePath(root, slash(relative(root, path)), boundary));
    }
    access = access.getExpression();
  }
  if (access.getKind() !== SyntaxKind.ThisKeyword) fail('provider must retain its existing this binding');
  const signature = read.getReturnType();
  const type = tokenType(signature);
  if (tokenType(declaration.getType()) !== type) fail('token declaration type mismatch');
  const returned = statements[1].asKindOrThrow(SyntaxKind.ReturnStatement).getExpression();
  if (!returned) fail('missing return object');
  for (const reference of property.findReferencesAsNodes()) {
    const parent = reference.getParent();
    if (!parent || !Node.isPropertyAccessExpression(parent) || parent.getExpression().getKind() !== SyntaxKind.ThisKeyword || !Node.isCallExpression(parent.getParent()) || parent.getParentIfKind(SyntaxKind.CallExpression)?.getArguments().length) fail('unsupported caller reference');
  }
  return { property, arrow: fn, declaration, returnExpression: returned as Node, tokenType: type, contextFiles };
}
export function construction(expression: Node, token: VariableDeclaration | import('ts-morph').ParameterDeclaration): string {
  let leaves = 0;
  function isToken(node: Node): boolean { return Node.isIdentifier(node) && node.getSymbol()?.getDeclarations().some(decl => decl === token) === true; }
  function check(node: Node): void {
    if (Node.isObjectLiteralExpression(node)) {
      if (!node.getProperties().length) fail('empty construction');
      for (const property of node.getProperties()) {
        if (!Node.isPropertyAssignment(property) || ![SyntaxKind.Identifier, SyntaxKind.StringLiteral].includes(property.getNameNode().getKind())) fail('computed, shorthand, getter or spread property');
        check(property.asKindOrThrow(SyntaxKind.PropertyAssignment).getInitializerOrThrow());
      }
      return;
    }
    if (!Node.isConditionalExpression(node) || !isToken(node.getCondition())) fail('conditional token construction required');
    const conditional = node.asKindOrThrow(SyntaxKind.ConditionalExpression);
    const absent = conditional.getWhenFalse();
    if (!Node.isIdentifier(absent) || absent.getText() !== 'undefined' || absent.getSymbol()?.getDeclarations().some(decl => !decl.getSourceFile().isDeclarationFile())) fail('absent value must be global undefined');
    const present = conditional.getWhenTrue();
    if (!Node.isTemplateExpression(present) || present.getTemplateSpans().length !== 1) fail('expected a literal prefix and one token interpolation');
    const template = present.asKindOrThrow(SyntaxKind.TemplateExpression);
    const span = template.getTemplateSpans()[0];
    if (!isToken(span.getExpression()) || span.getLiteral().getLiteralText() !== '') fail('unexpected interpolation effects or suffix');
    leaves++;
  }
  check(expression);
  if (leaves !== 1) fail('expected exactly one conditional leaf');
  const start = expression.getStart(); let text = expression.getText();
  const refs = expression.getDescendantsOfKind(SyntaxKind.Identifier).filter(isToken).sort((a, b) => b.getStart() - a.getStart());
  for (const ref of refs) text = text.slice(0, ref.getStart() - start) + 'token' + text.slice(ref.getEnd() - start);
  return text;
}
export function normalized(text: string): string {
  const file = ts.createSourceFile('normalized.ts', `const result = (${text});`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return ts.createPrinter({ removeComments: true }).printFile(file);
}
