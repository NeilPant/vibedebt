#!/usr/bin/env node
/**
 * Cross-platform fixture reset utility for VibeDebt.
 * Deterministically restores fixtures/vibe-mart from fixtures/vibe-mart-pristine.
 * Safe for Windows paths, paths with spaces, and modern Node.js runtimes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root is one level above the scripts directory
const projectRoot = path.resolve(__dirname, '..');
const pristineDir = path.join(projectRoot, 'fixtures', 'vibe-mart-pristine');
const targetDir = path.join(projectRoot, 'fixtures', 'vibe-mart');

function resetFixture() {
  console.log(`[VibeDebt] Resetting fixture...`);
  console.log(`  Source: ${pristineDir}`);
  console.log(`  Target: ${targetDir}`);

  if (!fs.existsSync(pristineDir)) {
    console.error(`[Error] Pristine fixture directory not found at: ${pristineDir}`);
    process.exit(1);
  }

  try {
    // Remove current target fixture directory if it exists
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    // Recreate target directory and copy all contents from pristine
    fs.mkdirSync(targetDir, { recursive: true });
    fs.cpSync(pristineDir, targetDir, { recursive: true });

    console.log(`[VibeDebt] Successfully reset fixtures/vibe-mart from fixtures/vibe-mart-pristine.`);
  } catch (err) {
    console.error(`[Error] Failed to reset fixture:`, err);
    process.exit(1);
  }
}

resetFixture();
