import { Node, SyntaxKind, type Project, type SourceFile } from 'ts-morph';
import { join } from 'node:path';
import type { OrphanedStateItem } from '../contracts/types.js';
import { assertShape, matchesShape, timerEffects, deadMutations } from './shapeGuard.js';

/** Only the known write-only VibeMart buffers are eligible for removal. */
export function removeDeadState(source: SourceFile, smells: OrphanedStateItem[]): void {
  const allowed = new Set(['hoveredProductIndex', 'tempZipCodeBuffer', 'sessionTimeoutId',
    'lastPollingTime', 'totalCatalogImpressions', 'inMemoryAuditQueue']);
  for (const smell of smells.filter(s => source.getFilePath().replaceAll('\\', '/').endsWith('/' + s.file))) {
    if (!allowed.has(smell.name)) continue;
    const declaration = source.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find(d => {
      const name = d.getNameNode();
      return Node.isArrayBindingPattern(name) ? name.getElements()[0]?.getText() === smell.name : d.getName() === smell.name;
    });
    if (!declaration) continue;
    const binding = declaration.getNameNode();
    const init = declaration.getInitializerOrThrow();
    const initialValues: Record<string, string> = { hoveredProductIndex: '-1', tempZipCodeBuffer: "''",
      sessionTimeoutId: 'null', lastPollingTime: 'Date.now()', totalCatalogImpressions: '0', inMemoryAuditQueue: '[]' };
    if (Node.isArrayBindingPattern(binding)) {
      if (!Node.isCallExpression(init) || init.getExpression().getText() !== 'useState' || init.getArguments().length !== 1) {
        throw new Error('Unsupported orphan state initializer');
      }
      assertShape(init.getArguments()[0], initialValues[smell.name], 'orphan state initializer');
      const setter = binding.getElements()[1];
      if (Node.isBindingElement(setter)) {
        const setterName = setter.getNameNode();
        if (!Node.isIdentifier(setterName)) throw new Error('Unsupported state setter binding');
        for (const ref of setterName.findReferencesAsNodes()) {
          if (ref.wasForgotten()) continue;
          const effect = ref.getAncestors().find(n => Node.isCallExpression(n) && n.getExpression().getText() === 'useEffect');
          if (effect && ['sessionTimeoutId', 'lastPollingTime'].includes(smell.name)) {
            assertShape(effect, timerEffects[smell.name], 'timer effect');
            effect.getFirstAncestorByKindOrThrow(SyntaxKind.ExpressionStatement).remove(); continue;
          }
          const attr = ref.getFirstAncestorByKind(SyntaxKind.JsxAttribute);
          if (attr && smell.name === 'hoveredProductIndex') {
            const expression = attr.getInitializer();
            const expected = attr.getNameNode().getText() === 'onMouseEnter' ?
              '() => setHoveredProductIndex(idx)' : '() => setHoveredProductIndex(-1)';
            if (!Node.isJsxExpression(expression) || !expression.getExpression()) throw new Error('Unsupported hover handler');
            assertShape(expression.getExpressionOrThrow(), expected, 'hover handler'); attr.remove(); continue;
          }
          const statement = ref.getFirstAncestorByKindOrThrow(SyntaxKind.ExpressionStatement);
          assertShape(statement.getExpression(), 'setTempZipCodeBuffer(e.target.value.trim())', 'ZIP buffer write');
          statement.remove();
        }
      }
    } else if (Node.isIdentifier(binding)) {
      assertShape(init, initialValues[smell.name], 'dead buffer initializer');
      for (const ref of binding.findReferencesAsNodes()) {
        const statement = ref.getFirstAncestorByKindOrThrow(SyntaxKind.ExpressionStatement);
        if (!deadMutations[smell.name]?.some(expected => matchesShape(statement.getExpression(), expected))) {
          throw new Error('Unsupported dead buffer mutation');
        }
        statement.remove();
      }
    }
    declaration.remove();
  }
}

export function rewriteEstimates(source: SourceFile): void {
  const shipping = source.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find(d => d.getName() === 'estimatedShipping');
  const tax = source.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find(d => d.getName() === 'estimatedTax');
  if (shipping) assertShape(shipping.getInitializerOrThrow(), `useMemo(() => {
    if (pricing.subtotal === 0) return 0; return pricing.subtotal >= 150 ? 0 : 5.99;
  }, [pricing.subtotal])`, 'shipping estimate');
  if (tax) assertShape(tax.getInitializerOrThrow(), `useMemo(() => {
    return Number((pricing.netTotal * 0.05).toFixed(2)); }, [pricing.netTotal])`, 'tax estimate');
  if (shipping) shipping.setInitializer(`useMemo(() => pricing.subtotal === 0 ? 0 :
    calculateShippingCost(pricing.subtotal, 'standard'), [pricing.subtotal])`);
  if (tax) tax.setInitializer(`useMemo(() => calculateStateTax('DEFAULT', pricing.netTotal).taxAmount, [pricing.netTotal])`);
  if (shipping || tax) source.addImportDeclaration({ moduleSpecifier: './domain/pricing.js',
    namedImports: ['calculateShippingCost', 'calculateStateTax'] });
}

export function rewriteApi(project: Project, dir: string, sources: SourceFile[]): string[] {
  const path = join(dir, 'src/services/apiRoutes.ts');
  if (project.getSourceFile(path)) throw new Error('Refusing to overwrite existing services/apiRoutes.ts');
  project.createSourceFile(path, `/** Canonical internal routes; legacy aliases remain accepted at the server boundary. */
export const API_ROUTES = {
  products: 'http://localhost:3000/api/v1/products',
  orders: 'http://localhost:3000/api/v1/orders',
} as const;
export function normalizeApiPath(pathname: string): string {
  return pathname.replace(/^\\/api\\/(orders|products)(?=\\/|$)/, '/api/v1/$1');
}
`);
  for (const source of sources) {
    let changed = false;
    for (const literal of source.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
      const match = literal.getLiteralValue().match(/^http:\/\/localhost:3000\/api\/(?:v1\/)?(products|orders)(\?status=)?$/);
      if (!match) continue;
      literal.replaceWithText(`API_ROUTES.${match[1]}${match[2] ? " + '?status='" : ''}`); changed = true;
    }
    for (const template of source.getDescendantsOfKind(SyntaxKind.TemplateExpression)) {
      const text = template.getText();
      const prefix = '`http://localhost:3000/api/v1/orders/';
      if (text.startsWith(prefix)) {
        template.replaceWithText('`${API_ROUTES.orders}/' + text.slice(prefix.length)); changed = true;
      }
    }
    if (changed) source.addImportDeclaration({ moduleSpecifier: './services/apiRoutes.js', namedImports: ['API_ROUTES'] });
  }
  const backend = project.getSourceFileOrThrow(join(dir, 'src/mockApi.ts'));
  const pathname = backend.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find(d => d.getName() === 'pathname');
  if (!pathname) throw new Error('Unsupported API pathname declaration');
  assertShape(pathname.getInitializerOrThrow(), 'parsedUrl.pathname', 'API pathname');
  const fallback = backend.getDescendantsOfKind(SyntaxKind.TemplateExpression).find(t => t.getText().includes('Not Found:'));
  if (!fallback) throw new Error('Unsupported API fallback');
  assertShape(fallback, '`Not Found: ${method} ${pathname}`', 'API fallback');
  backend.addImportDeclaration({ moduleSpecifier: './services/apiRoutes.js', namedImports: ['normalizeApiPath'] });
  pathname.setInitializer('normalizeApiPath(parsedUrl.pathname)');
  for (const binary of backend.getDescendantsOfKind(SyntaxKind.BinaryExpression).reverse()) {
    if (binary.wasForgotten() || binary.getOperatorToken().getKind() !== SyntaxKind.BarBarToken) continue;
    const resource = binary.getLeft().getText().match(/^pathname === '\/api\/v1\/(orders|products)'$/)?.[1];
    if (resource && matchesShape(binary.getRight(), `pathname === '/api/${resource}'`)) {
      binary.replaceWithText(binary.getLeft().getText());
    }
  }
  // Preserve the original request path in the public 404 message.
  fallback?.replaceWithText('`Not Found: ${method} ${parsedUrl.pathname}`');
  return ['src/services/apiRoutes.ts'];
}
