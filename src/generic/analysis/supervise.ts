import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

export interface Supervision { timeoutMs: number; semanticTimeoutMs: number; heapMb: number }
export function supervise<T>(data: object, options: Supervision): Promise<T> {
  return new Promise((resolve, reject) => {
    const js = new URL('./worker.js', import.meta.url);
    const entry = existsSync(fileURLToPath(js)) ? js : new URL('./worker.ts', import.meta.url);
    // Source-mode workers use Node's type stripper; built deployments use normal .js modules.
    const bootstrap = `const { registerHooks } = require('node:module'); registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.endsWith('.js')&&e.code==='ERR_MODULE_NOT_FOUND')return n(s.slice(0,-3)+'.ts',c);throw e;}}}); import(${JSON.stringify(entry.href)});`;
    const worker = new Worker(bootstrap, { eval: true, workerData: data, resourceLimits: { maxOldGenerationSizeMb: options.heapMb }, execArgv: [] });
    let phase = 'inventory'; let finished = false;
    const end = (error?: Error, value?: T): void => {
      if (finished) return; finished = true; clearTimeout(timer);
      void worker.terminate().then(() => error ? reject(error) : resolve(value as T), reject);
    };
    let timer = setTimeout(() => end(new Error(`${phase} timeout`)), options.timeoutMs);
    worker.on('message', (message: { phase?: string; result?: T; error?: string }) => {
      if (message.phase === 'semantic') {
        phase = 'semantic'; clearTimeout(timer);
        timer = setTimeout(() => end(new Error('semantic timeout')), options.semanticTimeoutMs);
      } else if (message.error) end(new Error(message.error));
      else if ('result' in message) end(undefined, message.result);
    });
    worker.on('error', error => end(error));
    worker.on('exit', code => { if (!finished) end(new Error(`Analysis worker exited (${code})`)); });
  });
}
