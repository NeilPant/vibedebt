import { Node, Project, SyntaxKind } from 'ts-morph';

function tokens(node: Node): string {
  if ([SyntaxKind.SingleLineCommentTrivia, SyntaxKind.MultiLineCommentTrivia].includes(node.getKind())) return '';
  const children = node.getChildren();
  return children.length ? children.map(tokens).filter(Boolean).join(' ') :
    node.getKind() === SyntaxKind.SyntaxList ? '' : node.getText();
}
export function matchesShape(node: Node, expression: string): boolean {
  const project = new Project({ useInMemoryFileSystem: true });
  const source = project.createSourceFile('expected.ts', `const expected = ${expression};`);
  return tokens(node) === tokens(source.getVariableDeclarationOrThrow('expected').getInitializerOrThrow());
}
export function assertShape(node: Node, expression: string, label: string): void {
  if (!matchesShape(node, expression)) throw new Error(`Unsupported ${label} shape; no refactor was saved`);
}

export const timerEffects: Record<string, string> = {
  sessionTimeoutId: `useEffect(() => { if (isOpen) {
    const timerId = setTimeout(() => {}, 60000); setSessionTimeoutId(timerId);
  } }, [isOpen])`,
  lastPollingTime: `useEffect(() => { const interval = setInterval(() => {
    setLastPollingTime(Date.now()); }, 5000); return () => clearInterval(interval); }, [])`,
};
export const deadMutations: Record<string, string[]> = {
  totalCatalogImpressions: ['totalCatalogImpressions += data.length'],
  inMemoryAuditQueue: [
    `inMemoryAuditQueue.push({action: 'ADVANCE_STATUS', orderId: order.id,
      previousStatus: order.status, newStatus: nextStatus, timestamp: new Date().toISOString(),})`,
    `inMemoryAuditQueue.push({action: 'REFUND_ORDER', orderId: order.id, timestamp: new Date().toISOString(),})`,
  ],
};
