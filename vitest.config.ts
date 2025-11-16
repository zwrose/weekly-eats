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
    poolOptions: {
      forks: {
        singleFork: true, // Use single fork for better isolation
      },
    },
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
      include: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.{test,spec}.{ts,tsx}',
        '!src/types/**',
        '!src/**/*.d.ts',
      ],
      exclude: [
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
      // Ensure coverage only processes source files, not compiled output
      all: false,
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});


