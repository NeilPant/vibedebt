import { expect, it } from 'vitest';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { startServer } from '../src/generic/runtime/process.js';

it('probes SPA servers with an HTML Accept header rather than treating their route as missing', async () => {
  const port = await new Promise<number>((resolve, reject) => {
    const socket = createServer(); socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address();
      if (!address || typeof address === 'string') throw new Error('Missing port');
      socket.close(() => resolve(address.port));
    });
  });
  const code = 'require("http").createServer((q,r)=>{r.statusCode=(q.headers.accept||"").includes("text/html")?200:404;r.end("app")}).listen(' + port + ',"127.0.0.1")';
  const server = await startServer({ command: process.execPath, args: ['-e', code], cwd: tmpdir(), timeoutMs: 1500 },
    'http://127.0.0.1:' + port);
  try { expect((await fetch('http://127.0.0.1:' + port)).status).toBe(404); }
  finally { await server.stop(); }
}, 10000);
