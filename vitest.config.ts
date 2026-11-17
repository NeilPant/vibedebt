import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    globalSetup: ['./tests/setup-fixture.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'fixtures/**/*.test.ts'],
  },
});
