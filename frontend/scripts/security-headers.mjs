import { relative, sep } from 'node:path';
import helmet from 'helmet';

// Content-Security-Policy for the production frontend proxy. Must stay identical to
// backend/src/config/security-headers.ts (backend security-headers.test.ts compares them).
// Plain HTTP inside the shop LAN: HSTS and upgrade-insecure-requests are disabled.
export const cspDirectives = {
  'default-src': ["'self'"],
  'base-uri': ["'self'"],
  'connect-src': ["'self'"],
  'font-src': ["'self'", 'data:'],
  'form-action': ["'self'"],
  'frame-ancestors': ["'self'"],
  'img-src': ["'self'", 'data:'],
  'object-src': ["'none'"],
  'script-src': ["'self'"],
  'script-src-attr': ["'none'"],
  // React style={...} attributes and the print window <style> block.
  'style-src': ["'self'", "'unsafe-inline'"],
};

const falseValues = new Set(['0', 'false', 'no', 'off']);
const trueValues = new Set(['1', 'true', 'yes', 'on']);

// Stage 1 of the rollout is report-only; set CSP_REPORT_ONLY=false to enforce.
export const parseCspReportOnly = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (falseValues.has(normalized)) return false;
  if (trueValues.has(normalized)) return true;
  return true;
};

export const buildHelmetOptions = (reportOnly) => ({
  strictTransportSecurity: false,
  frameguard: { action: 'sameorigin' },
  contentSecurityPolicy: {
    useDefaults: false,
    reportOnly,
    directives: Object.fromEntries(
      Object.entries(cspDirectives).map(([name, values]) => [name, [...values]]),
    ),
  },
});

// Returns a function that sets the security headers on a node:http response.
export const createSecurityHeaders = (reportOnly = parseCspReportOnly(process.env.CSP_REPORT_ONLY)) => {
  const middleware = helmet(buildHelmetOptions(reportOnly));
  return (request, response) =>
    new Promise((resolvePromise, reject) => {
      middleware(request, response, (error) => (error ? reject(error) : resolvePromise()));
    });
};

// Hashed Vite build output may be cached forever; everything else must revalidate
// (index.html, theme-init.js and other files from public/ keep their names).
export const immutableCacheControl = 'public, max-age=31536000, immutable';
export const noCacheControl = 'no-cache, no-store, must-revalidate';

export const getCacheControl = (filePath, distDir) => {
  const relativePath = relative(distDir, filePath).split(sep).join('/');
  return relativePath.startsWith('assets/') ? immutableCacheControl : noCacheControl;
};
