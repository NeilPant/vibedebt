import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

function resetFixture() {
  try {
    execFileSync(process.execPath, [resolve('scripts/reset-fixture.js')], { stdio: 'ignore' });
  } catch (error) {
    console.error('Failed to reset fixture in test hook:', error);
  }
}

export function setup() {
  resetFixture();
}

export function teardown() {
  resetFixture();
}
