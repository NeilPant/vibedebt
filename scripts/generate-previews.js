import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  const htmlPath = resolve('vibedebt-dashboard.html');
  const url = pathToFileURL(htmlPath).href;
  console.log('Loading dashboard from:', url);
  await page.goto(url, { waitUntil: 'networkidle' });

  // Wait for mermaid SVG
  await page.waitForSelector('.graph svg', { timeout: 15000 });
  const svg = await page.$('.graph svg');
  if (!svg) throw new Error('Mermaid SVG not found!');

  const graphText = await page.$eval('.graph', el => el.textContent || '');
  if (graphText.includes('Syntax error') || graphText.includes('Graph could not render')) {
    throw new Error('Mermaid render error detected in .graph: ' + graphText);
  }
  console.log('Mermaid SVG successfully rendered with 0 syntax errors.');

  // Check subgraphs
  const svgHtml = await svg.innerHTML();
  console.log('SVG contains subgraph groups:', svgHtml.includes('dir_') || svgHtml.includes('subgraph'));
  console.log('SVG contains monolith class:', svgHtml.includes('monolith') || svgHtml.includes('#fb8e82'));
  console.log('SVG contains focused class:', svgHtml.includes('focused') || svgHtml.includes('#7de2c3'));
  console.log('SVG contains smell class:', svgHtml.includes('smell') || svgHtml.includes('#c4bcff'));

  // Save 1600px wide dashboard screenshot
  await page.screenshot({ path: resolve('assets/dashboard-preview.png'), fullPage: false });
  console.log('Saved assets/dashboard-preview.png');

  // Now create 1280x640 social preview
  const socialPage = await browser.newPage({ viewport: { width: 1280, height: 640 } });
  const socialHtml = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        width: 1280px;
        height: 640px;
        background: radial-gradient(circle at 20% 20%, #182238 0%, #0b1020 70%);
        font-family: system-ui, -apple-system, sans-serif;
        color: #dae1f4;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 80px 100px;
        position: relative;
        overflow: hidden;
      }
      .badge-tag {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 3px;
        color: #9e93ff;
        margin-bottom: 24px;
      }
      h1 {
        font-size: 68px;
        letter-spacing: -2px;
        line-height: 1.05;
        margin-bottom: 20px;
        color: #ffffff;
      }
      h1 span {
        color: #9e93ff;
      }
      p.subtitle {
        font-size: 26px;
        line-height: 1.4;
        color: #9caac9;
        max-width: 900px;
        margin-bottom: 36px;
      }
      .pillars {
        display: flex;
        gap: 16px;
      }
      .pillar {
        padding: 10px 20px;
        border-radius: 10px;
        background: rgba(24, 34, 56, 0.85);
        border: 1px solid #303d5b;
        font-size: 16px;
        font-weight: 500;
        color: #c6beff;
      }
      .border-glow {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, #fb8e82, #9e93ff, #7de2c3);
      }
    </style>
  </head>
  <body>
    <div class="badge-tag">🛡️ Safety Net for AI Refactors</div>
    <h1>Vibe<span>Debt</span></h1>
    <p class="subtitle">Refactor vibe-coded apps without breaking them. Map AST topology, freeze behavior with synthesized tests, and auto-rollback on any regression.</p>
    <div class="pillars">
      <div class="pillar">1 · MAP AST Smells</div>
      <div class="pillar">2 · ANCHOR Public Contracts</div>
      <div class="pillar">3 · HEAL Pure Modules</div>
      <div class="pillar">4 · Byte-for-Byte Rollback</div>
    </div>
    <div class="border-glow"></div>
  </body>
  </html>`;

  await socialPage.setContent(socialHtml);
  await socialPage.screenshot({ path: resolve('assets/social-preview.png') });
  console.log('Saved assets/social-preview.png');

  await browser.close();
  console.log('Previews generation completed successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
