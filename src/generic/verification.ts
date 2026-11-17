import { createServer } from 'node:net';
import type { TargetManifest } from './context.js';
import { runCommand, startServer } from './runtime/process.js';
import { captureBrowser, replayBrowser } from './browser/index.js';
import type { AnchorBundle, BrowserVerification } from './browser/types.js';
import type { CommandResult } from './runtime/process.js';

export interface GateResult extends CommandResult { label: string }
export interface TargetVerification { success: boolean; checks: GateResult[]; browser: BrowserVerification }
async function unusedPort(): Promise<number> {
  return new Promise((done, reject) => {
    const server = createServer(); server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') { server.close(); reject(new Error('Cannot reserve app port')); return; }
      server.close(error => error ? reject(error) : done(address.port));
    });
  });
}
export async function checkCommands(manifest: TargetManifest, signal?: AbortSignal): Promise<GateResult[]> {
  const results: GateResult[] = [];
  for (const entry of manifest.checks) results.push({ label: entry.label, ...await runCommand({
    command: entry.command, args: entry.args, cwd: manifest.root, timeoutMs: entry.timeoutMs ?? 120000, signal,
  }) });
  return results;
}
export async function withApp<T>(manifest: TargetManifest, run: (url: string) => Promise<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  const port = await unusedPort(), url = 'http://127.0.0.1:' + port;
  const app = await startServer({
    command: manifest.server.command, args: manifest.server.args.map(a => a.replaceAll('{{PORT}}', String(port))),
    cwd: manifest.root, timeoutMs: manifest.server.timeoutMs ?? 60000, signal,
  }, url);
  try { return await run(url); } finally { await app.stop(); }
}
export async function captureBoundary(manifest: TargetManifest, signal?: AbortSignal): Promise<AnchorBundle> {
  return withApp(manifest, url => captureBrowser(url, manifest.browser, { signal }), signal);
}
export async function replayBoundary(manifest: TargetManifest, bundle: AnchorBundle, signal?: AbortSignal): Promise<BrowserVerification> {
  return withApp(manifest, url => replayBrowser(url, manifest.browser, bundle, { signal }), signal);
}
export async function verifyTarget(manifest: TargetManifest, bundle: AnchorBundle, signal?: AbortSignal): Promise<TargetVerification> {
  const checks = await checkCommands(manifest, signal);
  let browser: BrowserVerification;
  try { browser = await replayBoundary(manifest, bundle, signal); }
  catch (error) { browser = { success: false, passed: 0, failed: 1, failures: [String(error)] }; }
  return { success: checks.every(c => c.code === 0 && !c.timedOut) && browser.success, checks, browser };
}
