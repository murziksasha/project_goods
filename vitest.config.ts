import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.join(projectRoot, 'frontend');
const requireFromFrontend = createRequire(path.join(frontendDir, 'package.json'));

const { defineConfig } = requireFromFrontend('vitest/config') as typeof import('vitest/config');
const react = requireFromFrontend('@vitejs/plugin-react').default as typeof import('@vitejs/plugin-react').default;

export default defineConfig({
  root: frontendDir,
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-i18next', 'i18next'],
  },
  test: {
    pool: 'vmForks',
    fileParallelism: false,
    maxWorkers: 1,
    environment: 'jsdom',
    setupFiles: [path.join(frontendDir, 'src/test/setup.ts')],
    testTimeout: 30000,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});