import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const coverageInclude = [
  // Baseline for runtime modules that are already covered as deterministic units.
  // Keep entrypoints, generated assets, pure types, and broad orchestration/UI
  // modules out of this list until they have full behavioral tests.
  'src/entities/product/lib/filter-products.ts',
  'src/shared/api/queryClient.ts',
  'src/shared/lib/phoneFormatter.ts',
  'src/widgets/dashboard/model/order-request.ts',
  'src/widgets/dashboard/model/print-form-builder.ts',
  'src/widgets/dashboard/ui/accounting/AccountingPanel.tsx',
  'src/widgets/dashboard/ui/accounting/AccountingCashboxesView.tsx',
  'src/widgets/dashboard/ui/orders/modals/PrinterIcon.tsx',
  'src/widgets/dashboard/ui/accounting/useAccountingFinanceData.ts',
  'src/widgets/dashboard/ui/accounting/useAccountingPreferences.ts',
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-i18next', 'i18next'],
  },
  test: {
    pool: 'vmForks',
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 15000,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: coverageInclude,
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/test/**'],
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
    },
  },
});
