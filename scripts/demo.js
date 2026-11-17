#!/usr/bin/env node
import { execFileSync, fork } from 'node:child_process';
import { resolve } from 'node:path';

console.log('=== VibeDebt End-to-End Showcase Demo ===\n');

console.log('1. Resetting fixture to clean author-constructed baseline...');
execFileSync(process.execPath, [resolve('scripts/reset-fixture.js')], { stdio: 'inherit' });

console.log('\n2. Compiling VibeDebt engine...');
execFileSync('npm', ['run', 'build', '--silent'], { stdio: 'inherit', shell: true });

console.log('\n3. Running full pipeline (map -> anchor -> heal -> report)...');
execFileSync(process.execPath, [
  resolve('dist/cli/index.js'),
  'run',
  'fixtures/vibe-mart',
  '--html',
  'vibedebt-dashboard.html',
], { stdio: 'inherit' });

console.log('\n4. Launching local Architecture Observatory at http://localhost:3000 ...');
fork(resolve('scripts/serve-dashboard.js'));
