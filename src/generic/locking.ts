import { open, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { canonicalPath } from '../verification/pathSafety.js';

export async function withTargetLock<T>(root: string, work: () => Promise<T>): Promise<T> {
  const canonical = canonicalPath(root), key = process.platform === 'win32' ? canonical.toLowerCase() : canonical;
  const dir = join(tmpdir(), 'vibedebt-target-locks');
  await mkdir(dir, { recursive: true });
  const path = join(dir, createHash('sha256').update(key).digest('hex') + '.lock');
  const file = await open(path, 'wx').catch(() => { throw new Error('Target is already locked; inspect the lock before recovery'); });
  try { await file.writeFile(JSON.stringify({ root: canonical, pid: process.pid })); return await work(); }
  finally { await file.close(); await rm(path); }
}
