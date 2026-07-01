import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'vmForks',
    fileParallelism: false,
    testTimeout: 15000,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});