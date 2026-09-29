import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text'],
      reportsDirectory: './coverage',
      include: ['src/routes/**', 'src/validations/**', 'src/middleware/**', 'src/utils/**'],
      exclude: ['**/*.test.ts', 'src/smoke/**'],
    },
  },
});
