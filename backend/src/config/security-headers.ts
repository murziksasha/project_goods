import type { HelmetOptions } from 'helmet';

/**
 * Content-Security-Policy shared by the API (backend/src/app.ts) and the
 * production frontend proxy (frontend/scripts/security-headers.mjs).
 * Keep both lists identical; security-headers.test.ts compares them.
 *
 * Access is plain HTTP inside the shop LAN, so HSTS and
 * upgrade-insecure-requests are disabled on purpose.
 */
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
} as const;

export const buildHelmetOptions = (reportOnly: boolean): HelmetOptions => ({
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
