import { defineConfig } from 'vitest/config';

const coverageInclude = [
  // Baseline for runtime modules that are already covered as deterministic units.
  // Keep bootstrap, database wiring, CLI scripts, schema declarations, and static
  // seed/demo data out of this list; add domain/service files here only together
  // with behavioral tests that cover every branch.
  'src/config/env.ts',
  'src/domain/client/constants.ts',
  'src/domain/sale/stock.ts',
];

export default defineConfig({
  test: {
    pool: 'vmForks',
    testTimeout: 15000,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: coverageInclude,
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
    },
  },
});