#!/usr/bin/env node
import { existsSync } from 'node:fs';

const distEntry = new URL('../dist/cli/index.js', import.meta.url);
const srcEntry = new URL('../src/cli/index.ts', import.meta.url);

if (existsSync(distEntry)) {
  await import(distEntry.href);
} else {
  // Fallback to running TypeScript sources on Node 22.18+
  const { registerHooks } = await import('node:module');
  const sourceRoot = new URL('../src/', import.meta.url).href;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      try {
        return nextResolve(specifier, context);
      } catch (error) {
        if (error.code === 'ERR_MODULE_NOT_FOUND' &&
            context.parentURL?.startsWith(sourceRoot) &&
            specifier.startsWith('.') && specifier.endsWith('.js')) {
          return nextResolve(specifier.slice(0, -3) + '.ts', context);
        }
        throw error;
      }
    },
  });
  await import(srcEntry.href);
}
