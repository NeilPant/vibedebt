import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, renameSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { extractContracts } from './contractExtractor.js';
import { synthesize } from './vitestSynthesizer.js';
import { scenarios } from './scenarios.js';
import { runVitest, workspace } from '../verification/vitestRunner.js';
import type { AnchorResult, VerificationResult } from '../contracts/types.js';
import { assertArtifactPath } from '../verification/pathSafety.js';
import { anchorMarker } from './anchorIdentity.js';

export async function anchor(targetDir: string, options: { out?: string } = {}): Promise<AnchorResult> {
  const target = resolve(targetDir), entryPoint = join(target, 'src/index.ts');
  const contracts = extractContracts(target);
  const required = ['CartItem', 'computeCartPricing', 'calculateFinalPricing', 'recalculateOrderFinancials',
    'calculateStateTax', 'calculateShippingCost', 'getNextOrderStatus', 'canRefundOrder', 'resetMockDb',
    'getMockProducts', 'getMockOrders', 'getMockProductById', 'getMockOrderById', 'INITIAL_ORDERS',
    'createMockOrder', 'updateMockOrderStatus', 'refundMockOrder', 'validateMockCoupon',
    'handleMockRestRequest', 'mockFetch', 'installMockApiInterceptor', 'restoreOriginalFetch',
    'VibeMart', 'ShopDashboard', 'CheckoutModal', 'OrderManagement'];
  const missing = required.filter(name => !contracts.some(c => c.name === name));
  if (missing.length) throw new Error(`Unsupported public VibeMart profile; missing: ${missing.join(', ')}`);
  const output = resolve(options.out ?? join(workspace, '.vibedebt/generated-anchor.test.ts'));
  assertArtifactPath(output);
  if (existsSync(output) && !readFileSync(output, 'utf8').startsWith(anchorMarker)) {
    throw new Error(`Refusing to overwrite a hand-written test file: ${output}`);
  }
  if (!/\.test\.tsx?$/.test(output)) throw new Error('Anchor output must end in .test.ts or .test.tsx');
  mkdirSync(join(workspace, '.vibedebt'), { recursive: true });
  const temp = mkdtempSync(join(workspace, '.vibedebt/capture-'));
  try {
    const probe = join(temp, 'probe.test.ts'), observations = join(temp, 'observed.json');
    writeFileSync(probe, synthesize(entryPoint, probe, undefined, observations));
    const capture = await runVitest([probe]);
    if (!capture.success) throw new Error(`Cannot capture public behavior: ${capture.output}`);
    const expected: Record<string, unknown> = JSON.parse(readFileSync(observations, 'utf8')) as Record<string, unknown>;
    if (Object.keys(expected).length !== scenarios().length) throw new Error('Incomplete characterization capture');
    mkdirSync(dirname(output), { recursive: true });
    const candidateDir = mkdtempSync(join(dirname(output), '.anchor-'));
    let verification: VerificationResult;
    try {
      const candidate = join(candidateDir, 'candidate.test.ts');
      writeFileSync(candidate, synthesize(entryPoint, candidate, expected));
      verification = await runVitest([candidate]);
      if (!verification.success) throw new Error(`Generated anchor failed: ${verification.output}`);
      writeFileSync(candidate, synthesize(entryPoint, output, expected));
      renameSync(candidate, output);
    } finally { rmSync(candidateDir, { recursive: true, force: true }); }
    return { targetDir: target, entryPoint, testFile: output, contracts,
      testCount: scenarios().length, verification };
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
