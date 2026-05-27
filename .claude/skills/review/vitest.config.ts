import { defineConfig } from 'vitest/config';

/**
 * Dedicated Vitest config for the /review skill.
 *
 * The main project vitest.config.ts restricts test discovery to `src/**`,
 * so tests for skill scripts living under `.claude/` need their own config.
 *
 * Run with:
 *   npx vitest run --config .claude/skills/review/vitest.config.ts
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['.claude/skills/review/__tests__/**/*.test.ts'],
    isolate: true,
    pool: 'forks',
  },
});
