import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./react-act.setup.ts', './vitest.setup.ts'],
    isolate: true, // Ensure each test file runs in isolation
    pool: 'forks',
    // Vitest 4 removed poolOptions.forks.singleFork; maxWorkers: 1 is the
    // equivalent (one forked process, modules re-isolated per file via isolate).
    maxWorkers: 1,
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    testTimeout: 20000,
    hookTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Sustainable fix: Only include source files, exclude all build artifacts
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/types/**',
        'src/**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/*.setup.{js,ts}',
        '**/*.map',
        '**/*.js.map',
        '**/*.ts.map',
        '.next/**',
        'node_modules/**',
        'coverage/**',
        'dist/**',
        'build/**',
      ],
    },
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      '.claude/**/*.{test,spec}.ts',
      'test/manual/**/*.{test,spec}.ts',
    ],
    css: false,
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});
