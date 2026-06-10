import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const configuredApiTarget = process.env.API_PROXY_TARGET ?? process.env.VITE_API_URL;
const apiProxyTarget =
  configuredApiTarget?.startsWith('http') ? configuredApiTarget : 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': apiProxyTarget,
    },
  },
});
