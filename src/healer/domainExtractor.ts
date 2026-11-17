import { type Project, type SourceFile } from 'ts-morph';
import { join } from 'node:path';
import { signature } from '../cartographer/smellDetector.js';

export const pricingNames = ['computeCartPricing', 'calculateFinalPricing', 'recalculateOrderFinancials'];
export const helperNames = ['calculateStateTax', 'calculateShippingCost', 'getNextOrderStatus', 'canRefundOrder'];
export const componentNames = ['ShopDashboard', 'CheckoutModal', 'OrderManagement'];

/** Move existing implementations verbatim; reject non-equivalent pricing bodies before writes. */
export function extractDomain(project: Project, dir: string): { sources: SourceFile[]; modules: string[]; alreadyHealed: boolean } {
  const sources = componentNames.map(name => project.getSourceFileOrThrow(join(dir, `src/${name}.tsx`)));
  const destination = join(dir, 'src/domain/pricing.ts');
  if (project.getSourceFile(destination)) {
    if (sources.every(s => s.getImportDeclarations().some(i => i.getModuleSpecifierValue() === './domain/pricing.js')) &&
        sources.every((s, i) => !s.getFunction(pricingNames[i]))) {
      return { sources, modules: [], alreadyHealed: true };
    }
    throw new Error('Refusing to overwrite existing domain/pricing.ts');
  }
  const pricing = sources.map((source, i) => source.getFunctionOrThrow(pricingNames[i]));
  if (new Set(pricing.map(fn => signature(fn.getBodyOrThrow()))).size !== 1 ||
      new Set(pricing.map(fn => JSON.stringify(fn.getParameters().map(parameter => signature(parameter))))).size !== 1 ||
      pricing.some(fn => fn.isAsync() || !!fn.getAsteriskToken())) {
    throw new Error('Unsupported pricing bodies: duplicated implementations are not equivalent');
  }
  const helpers = helperNames.map(name => sources.flatMap(s => s.getFunctions()).find(fn => fn.getName() === name));
  if (helpers.some(fn => !fn)) throw new Error('Unsupported VibeMart profile: missing domain helper');
  const domainText = `import type { CartItem, PricingCalculationResult, ShippingMethod, OrderStatus, Order } from '../types.js';\n\n` +
    pricing[0].getText().replace('function computeCartPricing', 'function calculatePricing') + '\n\n' +
    helpers.map(fn => fn!.getText()).join('\n\n') + '\n';
  project.createSourceFile(destination, domainText);
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i], name = pricingNames[i];
    const names = [name, ...helperNames.filter(helper => !!source.getFunction(helper))];
    for (const moved of names) source.getFunctionOrThrow(moved).remove();
    source.addImportDeclaration({ moduleSpecifier: './domain/pricing.js', namedImports: names.map(n =>
      pricingNames.includes(n) ? { name: 'calculatePricing', alias: n } : { name: n }) });
    source.addExportDeclaration({ namedExports: names });
  }
  return { sources, modules: ['src/domain/pricing.ts'], alreadyHealed: false };
}
