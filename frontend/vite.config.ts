import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const configuredApiTarget = process.env.API_PROXY_TARGET ?? process.env.VITE_API_URL;
const apiProxyTarget =
  configuredApiTarget?.startsWith('http') ? configuredApiTarget : 'http://localhost:5000';

const resolveGitSha = () => {
  const dockerSha = process.env.VITE_BUILD_SHA?.trim();
  if (dockerSha) {
    return dockerSha;
  }

  try {
    return execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'nogit';
  }
};

const buildInfo = {
  gitSha: resolveGitSha(),
  builtAt: new Date().toISOString(),
};

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD_SHA__: JSON.stringify(buildInfo.gitSha),
    __APP_BUILD_TIME__: JSON.stringify(buildInfo.builtAt),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
          if (id.includes('@tanstack/react-query')) return 'vendor-query';
          if (id.includes('i18next') || id.includes('react-i18next')) return 'vendor-i18n';
          if (id.includes('xlsx')) return 'vendor-xlsx';
          if (id.includes('dompurify')) return 'vendor-sanitize';
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': apiProxyTarget,
    },
  },
});