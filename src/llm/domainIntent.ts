import { relative } from 'node:path';
import { Node, SyntaxKind, type FunctionDeclaration, type SourceFile } from 'ts-morph';
import type { BusinessIntent } from '../contracts/types.js';

const candidates = new Set(['computeCartPricing','calculateFinalPricing','recalculateOrderFinancials',
  'calculateStateTax','calculateShippingCost','getNextOrderStatus','canRefundOrder']);
function summarize(fn: FunctionDeclaration): string {
  const name = fn.getName() ?? 'Anonymous function';
  const label=name.replace(/([a-z0-9])([A-Z])/g,'$1 $2').toLowerCase();
  const branches=fn.getDescendantsOfKind(SyntaxKind.IfStatement).length;
  const facts=[branches?`${branches} conditional branches`:'no conditional branches'];
  const methods=fn.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap(call=>{
    const expression=call.getExpression();return Node.isPropertyAccessExpression(expression)?[expression.getName()]:[];
  });
  if(methods.includes('trim')) facts.push('text trimming');
  if(methods.includes('toUpperCase')) facts.push('uppercase normalization');
  if(methods.includes('toFixed')) facts.push('decimal rounding with toFixed');
  return `Intent inferred from name: ${label}. Observed AST operations: ${facts.join(', ')}.`;
}
export function inferIntents(sources: SourceFile[], dir: string): BusinessIntent[] {
  return sources.flatMap(source => source.getFunctions().filter(fn => fn.isExported() && !!fn.getBody() &&
    (candidates.has(fn.getName() ?? '') || /\/domain\//.test(source.getFilePath()))).map(fn => ({
      name: fn.getName() ?? 'Anonymous', file: relative(dir, source.getFilePath()).replaceAll('\\','/'),
      line: fn.getStartLineNumber(), parameters: fn.getParameters().map(p => p.getName()), summary: summarize(fn),
      evidence: [...new Set(fn.getDescendants().filter(n => n.getKind() === SyntaxKind.StringLiteral ||
        n.getKind() === SyntaxKind.NumericLiteral).map(n => n.getText()))].slice(0,30), source: 'heuristic' as const,
    })));
}
