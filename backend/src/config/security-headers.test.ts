import express from 'express';
import helmet from 'helmet';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildHelmetOptions, cspDirectives } from './security-headers';
import { parseEnv } from './env';

const makeApp = (reportOnly: boolean) => {
  const app = express();
  app.use(helmet(buildHelmetOptions(reportOnly)));
  app.get('/api/ping', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
};

describe('security headers', () => {
  it('defaults CSP to report-only and allows enforcing via CSP_REPORT_ONLY=false', () => {
    expect(parseEnv({}).cspReportOnly).toBe(true);
    expect(parseEnv({ CSP_REPORT_ONLY: 'false' }).cspReportOnly).toBe(false);
    expect(parseEnv({ CSP_REPORT_ONLY: '0' }).cspReportOnly).toBe(false);
  });

  it('sends report-only CSP without HSTS or upgrade-insecure-requests', async () => {
    const response = await request(makeApp(true)).get('/api/ping');
    const csp = response.headers['content-security-policy-report-only'];
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).not.toContain('upgrade-insecure-requests');
    expect(response.headers['content-security-policy']).toBeUndefined();
    expect(response.headers['strict-transport-security']).toBeUndefined();
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('enforces CSP when report-only is off', async () => {
    const response = await request(makeApp(false)).get('/api/ping');
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['content-security-policy-report-only']).toBeUndefined();
  });

  it('matches the frontend proxy directives', async () => {
    const frontend = (await import('../../../frontend/scripts/security-headers.mjs')) as {
      cspDirectives: Record<string, string[]>;
    };
    expect(frontend.cspDirectives).toEqual(
      Object.fromEntries(Object.entries(cspDirectives).map(([k, v]) => [k, [...v]])),
    );
  });
});
