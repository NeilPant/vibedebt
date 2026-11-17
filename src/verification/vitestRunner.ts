import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import type { VerificationResult } from '../contracts/types.js';

const require = createRequire(import.meta.url);
export const workspace = process.cwd();

function failureDetails(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return [];
  const messages: string[] = [];
  if ('message' in value && typeof value.message === 'string' && value.message) messages.push(value.message);
  if ('failureMessages' in value && Array.isArray(value.failureMessages)) {
    messages.push(...value.failureMessages.filter((m): m is string => typeof m === 'string'));
  }
  const groups: unknown[] = ['testResults' in value ? value.testResults : undefined,
    'assertionResults' in value ? value.assertionResults : undefined];
  for (const children of groups) {
    if (Array.isArray(children)) for (const child of children) messages.push(...failureDetails(child));
  }
  return messages;
}

export function runProcess(command: string, args: string[], cwd = workspace): Promise<{ code: number; output: string }> {
  return new Promise((done, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const collect = (chunk: Buffer): void => { output = (output + chunk.toString()).slice(-200000); };
    child.stdout.on('data', collect); child.stderr.on('data', collect);
    const timer = setTimeout(() => { child.kill(); }, 90000);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); done({ code: code ?? 1, output }); });
  });
}

/** An isolated config prevents recursive E2E discovery and supports arbitrary output paths. */
export async function runVitest(testFiles: string[]): Promise<VerificationResult> {
  if (!testFiles.length) throw new Error('At least one verification test file is required');
  mkdirSync(resolve(workspace, '.vibedebt'), { recursive: true });
  const dir = mkdtempSync(resolve(workspace, '.vibedebt/verify-'));
  try {
    const config = join(dir, 'vitest.config.mjs'), results = join(dir, 'results.json');
    writeFileSync(config, `export default ${JSON.stringify({ root: workspace, test: {
      include: testFiles.map(f => resolve(f).replaceAll('\\', '/')), exclude: [],
      globals: true, environment: 'node', fileParallelism: false, testTimeout: 30000,
    } })};\n`);
    const vitestBin = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
    const command = await runProcess(process.execPath, [vitestBin, 'run',
      '--config', config, '--reporter=json', '--outputFile', results]);
    let passed = 0, failed = 0, details = '';
    try {
      const data: unknown = JSON.parse(readFileSync(results, 'utf8'));
      details = failureDetails(data).join('\n').slice(-100000);
      if (typeof data === 'object' && data !== null) {
        if ('numPassedTests' in data && typeof data.numPassedTests === 'number') passed = data.numPassedTests;
        if ('numFailedTests' in data && typeof data.numFailedTests === 'number') failed = data.numFailedTests;
      }
    } catch { /* Missing/malformed results remain a failed verification. */ }
    return { success: command.code === 0 && passed > 0 && failed === 0, passed, failed,
      output: command.output + details + (command.code !== 0 ? `\nExit code: ${command.code}` : '') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

export async function typecheck(): Promise<VerificationResult> {
  const result = await runProcess(process.execPath, [require.resolve('typescript/bin/tsc'), '--noEmit']);
  return { success: result.code === 0, passed: 0, failed: result.code === 0 ? 0 : 1, output: result.output };
}
