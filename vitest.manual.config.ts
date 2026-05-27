import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    name: 'manual-engine',
    environment: 'node',
    include: ['test/manual/**/*.test.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 20_000,
    hookTimeout: 20_000,
    setupFiles: [],
  },
});
