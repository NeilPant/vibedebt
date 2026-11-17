import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw error;
  }
  if (process.platform === 'linux') {
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
      const lastParen = stat.lastIndexOf(')');
      if (lastParen !== -1) {
        const state = stat.slice(lastParen + 1).trimStart().charAt(0);
        if (state === 'Z') return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}
export const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

async function utility(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Process cleanup utility timed out: ${command}`)); }, 5000);
    child.stdout.on('data', (data: Buffer) => { output += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { output += data.toString(); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(new Error(`Process cleanup utility failed (${code}): ${output}`));
    });
  });
}
interface ProcessRow { ProcessId: number; ParentProcessId: number }
async function windowsDescendants(pid: number): Promise<number[]> {
  const output = await utility('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress']);
  const data: unknown = JSON.parse(output);
  if (!Array.isArray(data)) throw new Error('Cannot enumerate processes for cleanup');
  const rows: ProcessRow[] = data.filter((row: unknown): row is ProcessRow => !!row && typeof row === 'object' && 'ProcessId' in row && typeof row.ProcessId === 'number' && 'ParentProcessId' in row && typeof row.ParentProcessId === 'number');
  const result = new Set([pid]);
  for (let changed = true; changed;) {
    changed = false;
    for (const row of rows) {
      if (result.has(row.ParentProcessId) && !result.has(row.ProcessId)) { result.add(row.ProcessId); changed = true; }
    }
  }
  return [...result];
}
export async function terminateTree(pid: number): Promise<void> {
  if (process.platform === 'win32') {
    let enumerationError: unknown;
    const pids = await windowsDescendants(pid).catch(error => { enumerationError = error; return [pid]; });
    // Kill root first with /T while parent relationships still exist. Then clean up
    // descendants observed after a wrapper's early exit, even if root has gone.
    for (const member of pids) {
      if (!isAlive(member)) continue;
      try { await utility('taskkill.exe', ['/PID', String(member), '/T', '/F']); } catch (error) {
        if (isAlive(member)) throw error;
      }
    }
    const deadline = Date.now() + 3000;
    while (pids.some(isAlive) && Date.now() < deadline) await delay(30);
    if (pids.some(isAlive)) throw new Error(`Process tree termination unconfirmed: ${pids.filter(isAlive).join(', ')}`);
    if (enumerationError) throw new Error(`Process descendant enumeration failed: ${String(enumerationError)}`);
  } else {
    try { process.kill(-pid, 'SIGKILL'); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
    const deadline = Date.now() + 3000;
    while (isAlive(pid) && Date.now() < deadline) await delay(30);
    if (isAlive(pid)) throw new Error(`Process termination unconfirmed: ${pid}`);
  }
}
