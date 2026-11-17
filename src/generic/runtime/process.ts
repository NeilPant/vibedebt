import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { delay, terminateTree } from './process-tree.js';

export interface Command { command: string; args: string[]; cwd: string; timeoutMs?: number; signal?: AbortSignal }
export interface CommandResult { code: number; output: string; timedOut: boolean }
function deadline(value: number | undefined, fallback: number): number {
  const result = value ?? fallback;
  if (!Number.isFinite(result) || result <= 0 || result > 2147483647) throw new Error('Command timeout must be positive and finite');
  return result;
}
function launch(command: Command) {
  // cmd scripts require the Windows command interpreter; reject shell metacharacters
  // rather than interpolate arbitrary executable/argument strings into a shell.
  const batch = process.platform === 'win32' && /(?:\.(?:cmd|bat)$|^(?:npm|npx)$)/i.test(command.command);
  let executable = command.command;
  let args = command.args;
  if (batch) {
    const script = /\.(cmd|bat)$/i.test(command.command) ? command.command : `${command.command}.cmd`;
    const candidates = /[\\/]/.test(script) ? [path.resolve(command.cwd, script)] : (process.env.PATH ?? '').split(path.delimiter).map(directory => path.join(directory, script));
    const resolved = candidates.find(existsSync);
    if (!resolved) throw new Error(`Windows batch executable not found: ${script}`);
    const words = [resolved, ...command.args];
    if (words.some(word => /["%\r\n&|<>^!]/.test(word))) throw new Error('Unsafe argument for Windows batch command');
    executable = process.env.ComSpec ?? 'cmd.exe';
    args = ['/d', '/s', '/c', `"${words.map(word => `"${word}"`).join(' ')}"`];
  }
  const child = spawn(executable, args, { cwd: command.cwd, detached: process.platform !== 'win32', windowsHide: true, windowsVerbatimArguments: batch, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const collect = (data: Buffer) => { output = (output + data.toString()).slice(-8 * 1024 * 1024); };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  let finished = false;
  let exitCode = -1;
  const exited = new Promise<number>(resolve => {
    child.once('error', error => { collect(Buffer.from(error.message)); finished = true; resolve(-1); });
    child.once('close', code => { finished = true; exitCode = code ?? -1; resolve(exitCode); });
  });
  let stopping: Promise<void> | undefined;
  return {
    child, exited, output: () => output, finished: () => finished, code: () => exitCode,
    stop: () => stopping ??= child.pid === undefined ? Promise.resolve() : terminateTree(child.pid),
  };
}
export async function runCommand(command: Command): Promise<CommandResult> {
  command.signal?.throwIfAborted();
  const timeout = deadline(command.timeoutMs, 120000);
  const running = launch(command);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const timeoutReached = new Promise<number>(resolve => {
    timer = setTimeout(() => { timedOut = true; resolve(-1); }, timeout);
  });
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(command.signal?.reason ?? new Error('Command aborted'));
    command.signal?.addEventListener('abort', onAbort, { once: true });
  });
  try {
    const code = await Promise.race([running.exited, timeoutReached, aborted]);
    return { code: timedOut ? -1 : code, output: running.output(), timedOut };
  } finally {
    clearTimeout(timer);
    command.signal?.removeEventListener('abort', onAbort);
    await running.stop();
  }
}
function probe(url: URL, timeout: number): Promise<boolean> {
  return new Promise(resolve => {
    const requestHandle = request(url, { timeout, headers: { accept: 'text/html, */*' } }, response => {
      response.resume();
      resolve((response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 400);
    });
    requestHandle.on('timeout', () => requestHandle.destroy(new Error('Readiness probe timeout')));
    requestHandle.on('error', () => resolve(false));
    requestHandle.end();
  });
}
export async function startServer(command: Command, readyUrl: string): Promise<{ stop(): Promise<void> }> {
  command.signal?.throwIfAborted();
  const timeout = deadline(command.timeoutMs, 60000);
  const url = new URL(readyUrl);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Readiness URL must use loopback HTTP');
  if (await probe(url, Math.min(timeout, 500))) throw new Error('Readiness address is already occupied by a server');
  command.signal?.throwIfAborted();
  const running = launch(command);
  const stop = () => {
    command.signal?.removeEventListener('abort', onAbort);
    return running.stop();
  };
  const onAbort = () => { void stop().catch(() => {}); };
  command.signal?.addEventListener('abort', onAbort, { once: true });
  const until = Date.now() + timeout;
  try {
    while (Date.now() < until) {
      command.signal?.throwIfAborted();
      if (running.finished()) throw new Error(`Server exited before readiness (${running.code()}): ${running.output()}`);
      if (await probe(url, Math.min(500, Math.max(1, until - Date.now())))) {
        command.signal?.throwIfAborted();
        if (running.finished()) throw new Error(`Server exited during readiness: ${running.output()}`);
        return { stop };
      }
      await delay(Math.min(50, Math.max(1, until - Date.now())));
    }
    throw new Error(`Server readiness timed out after ${timeout}ms: ${running.output()}`);
  } catch (error) {
    await stop();
    throw error;
  }
}
