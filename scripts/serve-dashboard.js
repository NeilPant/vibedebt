#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dashboardFile = path.join(rootDir, 'vibedebt-dashboard.html');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const server = http.createServer((req, res) => {
  const url = req.url?.split('?')[0] || '/';
  
  if (url === '/' || url === '/vibedebt-dashboard.html') {
    if (!fs.existsSync(dashboardFile)) {
      res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!doctype html>
        <html>
          <head><title>VibeDebt · Dashboard Not Generated</title><style>body{background:#0b1020;color:#dae1f4;font-family:sans-serif;padding:40px;text-align:center}code{background:#182238;padding:4px 8px;border-radius:4px}</style></head>
          <body>
            <h1>VibeDebt Dashboard Not Yet Generated</h1>
            <p>Run <code>npm run vibedebt:run -- fixtures/vibe-mart --html</code> to generate <code>vibedebt-dashboard.html</code> first.</p>
          </body>
        </html>
      `);
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(dashboardFile).pipe(res);
    return;
  }

  // Health check endpoint for Firebase App Hosting / Cloud Run
  if (url === '/health' || url === '/_health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', version: '0.1.0' }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[VibeDebt Observatory] Running at http://localhost:${PORT}`);
  console.log(`Press Ctrl+C to terminate.`);
});
