#!/usr/bin/env node
import { registerHooks } from 'node:module';

// Run the TypeScript sources on Node 22.18+ without emitting into fixtures.
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
await import('../src/cli/index.ts');
