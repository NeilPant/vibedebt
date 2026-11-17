import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

async function main() {
  const framesDir = resolve('temp-demo-frames');
  mkdirSync(framesDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 560 } });

  const terminalHtml = (title, lines) => `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        width: 900px; height: 560px;
        background: #0b1020;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: #dae1f4;
        padding: 30px;
        display: flex; flex-direction: column;
      }
      .window {
        flex: 1;
        background: #121a2c;
        border: 1px solid #26314b;
        border-radius: 12px;
        overflow: hidden;
        display: flex; flex-direction: column;
        box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      }
      .header {
        height: 38px;
        background: #182238;
        border-bottom: 1px solid #26314b;
        display: flex; align-items: center;
        padding: 0 16px; gap: 8px;
      }
      .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
      .red { background: #fb8e82; }
      .yellow { background: #f6c177; }
      .green { background: #7de2c3; }
      .title { margin-left: 12px; font-size: 13px; color: #9caac9; font-weight: 500; }
      .content {
        flex: 1; padding: 24px; font-size: 14px; line-height: 1.6;
        display: flex; flex-direction: column; justify-content: flex-start;
      }
      .prompt { color: #9e93ff; font-weight: 700; }
      .cmd { color: #ffffff; }
      .info { color: #9caac9; }
      .success { color: #7de2c3; }
      .warn { color: #f6c177; }
      .danger { color: #fb8e82; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; }
      .badge.green { background: rgba(125, 226, 195, 0.15); color: #7de2c3; }
      .badge.red { background: rgba(251, 142, 130, 0.15); color: #fb8e82; }
      .metric-box {
        margin-top: 14px; padding: 14px; background: #182238;
        border: 1px solid #303d5b; border-radius: 8px;
      }
    </style>
  </head>
  <body>
    <div class="window">
      <div class="header">
        <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
        <span class="title">${title}</span>
      </div>
      <div class="content">
        ${lines}
      </div>
    </div>
  </body>
  </html>`;

  // Scene 1: Terminal running map -> anchor -> heal
  await page.setContent(terminalHtml('bash ~ vibedebt run fixtures/vibe-mart', `
    <div><span class="prompt">$</span> <span class="cmd">vibedebt run fixtures/vibe-mart --html observatory.html</span></div>
    <div class="info" style="margin-top:12px">⚡ [Phase 1: MAP] Scanning AST topology & smell clusters...</div>
    <div class="info">&nbsp;&nbsp;→ Found 6 files: 3 monolithic, 37 duplicated math clusters, 6 orphaned states</div>
    <div class="info" style="margin-top:8px">🔒 [Phase 2: ANCHOR] Synthesizing black-box behavioral tests...</div>
    <div class="info">&nbsp;&nbsp;→ Discovered 5 public contracts, synthesized 109 golden test vectors</div>
    <div class="success">&nbsp;&nbsp;✔ Baseline anchor suites passing: 109 / 109 (100%)</div>
    <div class="info" style="margin-top:8px">🩺 [Phase 3: HEAL] Executing transactional module extractions...</div>
    <div class="info">&nbsp;&nbsp;→ Extracted src/domain/pricing.ts & src/services/apiRoutes.ts</div>
    <div class="success">&nbsp;&nbsp;✔ Post-refactor verification: 122 / 122 tests green (tsc: 0 errors)</div>
    <div class="success" style="margin-top:12px; font-weight:bold">🎉 Refactor verified successfully! Written to observatory.html</div>
  `));
  await page.screenshot({ path: resolve(framesDir, 'frame_01.png') });

  // Scene 2: Dashboard metrics overview
  await page.setContent(terminalHtml('VibeDebt Architecture Observatory · Metrics', `
    <div style="font-size:18px; font-weight:bold; margin-bottom:12px; color:#c4bcff;">Architecture Observatory: Before &rarr; After Metrics</div>
    <div class="metric-box">
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <tr style="color:#9caac9; border-bottom:1px solid #303d5b;">
          <th style="text-align:left; padding:6px 0;">Metric</th>
          <th style="text-align:right; padding:6px 0;">Before</th>
          <th style="text-align:right; padding:6px 0;">After</th>
          <th style="text-align:right; padding:6px 0;">Reduction</th>
        </tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:8px 0;">Duplicated AST Clusters</td>
          <td style="text-align:right; color:#fb8e82;">37</td>
          <td style="text-align:right; color:#7de2c3; font-weight:bold;">12</td>
          <td style="text-align:right; color:#7de2c3;">-67.6%</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:8px 0;">Orphaned State Variables</td>
          <td style="text-align:right; color:#fb8e82;">6</td>
          <td style="text-align:right; color:#7de2c3; font-weight:bold;">0</td>
          <td style="text-align:right; color:#7de2c3;">-100%</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:8px 0;">API Path Inconsistencies</td>
          <td style="text-align:right; color:#fb8e82;">2</td>
          <td style="text-align:right; color:#7de2c3; font-weight:bold;">0</td>
          <td style="text-align:right; color:#7de2c3;">-100%</td>
        </tr>
        <tr>
          <td style="padding:8px 0;">Component Source Lines</td>
          <td style="text-align:right; color:#9caac9;">1,812</td>
          <td style="text-align:right; color:#c4bcff; font-weight:bold;">1,576</td>
          <td style="text-align:right; color:#c4bcff;">-13.0%</td>
        </tr>
      </table>
    </div>
    <div style="margin-top:16px; color:#7de2c3; font-size:13px;">
      <span class="badge green">GATE VERIFIED</span> All 13 fixture invariants + 109 behavioral anchors passed.
    </div>
  `));
  await page.screenshot({ path: resolve(framesDir, 'frame_02.png') });

  // Scene 3: Dashboard Dependency Graph View
  await page.setContent(terminalHtml('VibeDebt Architecture Observatory · Dependency Topology', `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <span style="font-size:16px; font-weight:bold; color:#c4bcff;">Interactive Dependency Graph</span>
      <span class="badge green">CLEAN EXTRACTIONS</span>
    </div>
    <div style="padding:14px; background:#182238; border:1px solid #303d5b; border-radius:8px; display:flex; flex-direction:column; gap:10px;">
      <div style="display:flex; gap:10px; font-size:12px;">
        <span style="padding:4px 10px; background:#fb8e82; color:#182238; border-radius:4px; font-weight:bold;">Monoliths (3)</span>
        <span style="padding:4px 10px; background:#c4bcff; color:#182238; border-radius:4px; font-weight:bold;">Smell Clusters (37)</span>
        <span style="padding:4px 10px; background:#7de2c3; color:#182238; border-radius:4px; font-weight:bold;">Extracted Modules (2)</span>
      </div>
      <div style="font-size:13px; color:#9caac9; line-height:1.6; margin-top:6px;">
        <div>&bull; <strong style="color:#ffffff;">src/CheckoutModal.tsx</strong> &rarr; <span style="color:#7de2c3;">src/domain/pricing.ts</span></div>
        <div>&bull; <strong style="color:#ffffff;">src/ShopDashboard.tsx</strong> &rarr; <span style="color:#7de2c3;">src/domain/pricing.ts</span></div>
        <div>&bull; <strong style="color:#ffffff;">src/OrderManagement.tsx</strong> &rarr; <span style="color:#7de2c3;">src/services/apiRoutes.ts</span></div>
      </div>
      <div style="font-size:12px; color:#7de2c3; margin-top:4px;">
        ✔ Subgraphs cleanly grouped by directory · Offline SVG rendered with zero telemetry
      </div>
    </div>
  `));
  await page.screenshot({ path: resolve(framesDir, 'frame_03.png') });

  // Scene 4: Fault Injection & Automated Rollback
  await page.setContent(terminalHtml('bash ~ Fault Injection & Transactional Rollback', `
    <div><span class="prompt">$</span> <span class="cmd"># Injecting subtle bug into refactored pricing module...</span></div>
    <div><span class="prompt">$</span> <span class="cmd">sed -i 's/tier.discount/tier.discount + 0.05/' src/domain/pricing.ts</span></div>
    <div><span class="prompt">$</span> <span class="cmd">vibedebt heal fixtures/vibe-mart --anchor .vibedebt/anchor.test.ts</span></div>
    <div class="info" style="margin-top:10px">🔎 Running verification gates...</div>
    <div class="success">&nbsp;&nbsp;✔ TypeScript typecheck: 0 errors (types are structurally valid!)</div>
    <div class="danger">&nbsp;&nbsp;✘ Behavioral anchor failure: calculatePricing(tier="Gold", total=100)</div>
    <div class="danger">&nbsp;&nbsp;&nbsp;&nbsp;Expected: 80, Received: 75 (regression detected)</div>
    <div class="warn" style="margin-top:10px; font-weight:bold;">⚠️ TRANSACTION FAILED &mdash; Activating RollbackGuard</div>
    <div class="info">&nbsp;&nbsp;Restoring snapshot: 6 files restored byte-for-byte</div>
    <div class="info">&nbsp;&nbsp;Cleaning up uncommitted artifacts...</div>
    <div class="success" style="margin-top:10px; font-weight:bold;">🛡️ ROLLBACK COMPLETE: Working tree returned to 100% clean pristine state</div>
  `));
  await page.screenshot({ path: resolve(framesDir, 'frame_04.png') });

  await browser.close();

  // Run python script to compile into assets/demo.gif
  console.log('Compiling frames into assets/demo.gif...');
  execFileSync('python', ['scripts/compile-gif.py'], { stdio: 'inherit' });
  console.log('Demo GIF generation complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
