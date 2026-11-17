import { Node } from 'ts-morph';
import { relative, join } from 'node:path';
import { scanProject } from '../cartographer/astScanner.js';
import type { PublicContract } from '../contracts/types.js';

export function extractContracts(targetDir: string): PublicContract[] {
  const { project, dir } = scanProject(targetDir);
  const entry = project.getSourceFile(join(dir, 'src/index.ts'));
  if (!entry) throw new Error('Unsupported target: public entry src/index.ts is required');
  return [...entry.getExportedDeclarations()].map(([name, declarations]): PublicContract => {
    const declaration = declarations[0];
    const component = Node.isVariableDeclaration(declaration) &&
      declaration.getDescendants().some(n => Node.isJsxElement(n) || Node.isJsxSelfClosingElement(n));
    return { name, file: relative(dir, declaration.getSourceFile().getFilePath()).replaceAll('\\', '/'),
      line: declaration.getStartLineNumber(),
      kind: Node.isInterfaceDeclaration(declaration) || Node.isTypeAliasDeclaration(declaration) ? 'type' :
        component ? 'component' : Node.isFunctionDeclaration(declaration) ? 'function' : 'value',
      signature: declaration.getType().getText(declaration),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
